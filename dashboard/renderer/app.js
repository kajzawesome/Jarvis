const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { readLayouts, writeLayouts } = require('../layouts-store');

const params = new URLSearchParams(location.search);
const PRIMARY = params.get('primary') === '1';
const SCREEN_INDEX = params.get('screen') || '0';
const TOTAL_SCREENS = parseInt(params.get('totalScreens') || '1', 10);

const ROOT = path.resolve(__dirname, '..', '..'); // Jarvis/

// ---- node discovery: any Jarvis/<folder>/node.json is a node ----
function discoverNodes() {
  const nodes = {};
  for (const entry of fs.readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const manifestPath = path.join(ROOT, entry.name, 'node.json');
    if (!fs.existsSync(manifestPath)) continue;
    try {
      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
      manifest._dir = path.join(ROOT, entry.name);
      nodes[manifest.id] = manifest;
    } catch (err) {
      console.error(`[jarvis] bad node.json in ${entry.name}:`, err.message);
    }
  }
  return nodes;
}

function loadModule(node, relPath) {
  return require(path.join(node._dir, relPath));
}

function itemsForThisScreen(layoutsData) {
  const preset = layoutsData.presets[layoutsData.activePreset] || {};
  return preset[SCREEN_INDEX] || [];
}

const NODES = discoverNodes();
const timers = {};
const placedIds = new Set();
const pendingMoves = {}; // nodeId -> { el } while awaiting move-node-result

const grid = GridStack.init(
  { cellHeight: 70, margin: 8, float: true, staticGrid: true },
  '#grid'
);

let editMode = false;

function setEditMode(on) {
  editMode = on;
  grid.setStatic(!on);
  document.body.classList.toggle('edit-mode', on);
  document.getElementById('edit-toggle').classList.toggle('active', on);
  document.getElementById('palette').classList.toggle('visible', on);
  renderPalette();
}

// Widgets that render an open-ended list (more items than could ever
// reliably fit) wrap those rows in `<div class="fit-zone">...</div>`. After
// every render, trim trailing rows out of each zone until the tile's body
// actually fits its own box - "auto adjust based on size" instead of a
// scrollbar or content quietly overflowing the tile's border.
function trimFitZones(bodyEl) {
  const zones = bodyEl.querySelectorAll('.fit-zone');
  zones.forEach((zone) => {
    let guard = 300;
    while (bodyEl.scrollHeight > bodyEl.clientHeight && zone.lastElementChild && guard-- > 0) {
      zone.lastElementChild.remove();
    }
  });
}

function mountNode(nodeId, el) {
  const node = NODES[nodeId];
  const content = el.querySelector('.grid-stack-item-content');
  if (!node) {
    content.innerHTML = `<div class="node-empty">UNKNOWN NODE: ${nodeId}</div>`;
    return;
  }
  const otherScreens = Array.from({ length: TOTAL_SCREENS }, (_, i) => i).filter((i) => String(i) !== SCREEN_INDEX);

  content.innerHTML = `
    <div class="node-panel">
      <div class="node-panel-head">
        <span>${node.label}</span>
        ${
          otherScreens.length
            ? `<select class="node-panel-move" title="move to another screen">
                <option value="">→</option>
                ${otherScreens.map((i) => `<option value="${i}">SCR ${i}</option>`).join('')}
              </select>`
            : ''
        }
        <span class="node-panel-toggle" title="hide this header outside edit mode">${el.dataset.headerHidden === 'true' ? '◉' : '○'}</span>
        <span class="node-panel-close">&times;</span>
      </div>
      <div class="node-panel-body"></div>
    </div>
  `;
  const bodyEl = content.querySelector('.node-panel-body');

  const toggleBtn = content.querySelector('.node-panel-toggle');
  toggleBtn.classList.toggle('active', el.dataset.headerHidden === 'true');
  toggleBtn.addEventListener('click', () => {
    const hidden = el.dataset.headerHidden === 'true';
    el.dataset.headerHidden = (!hidden).toString();
    toggleBtn.classList.toggle('active', !hidden);
    toggleBtn.textContent = !hidden ? '◉' : '○';
  });

  const moveSelect = content.querySelector('.node-panel-move');
  if (moveSelect) {
    moveSelect.addEventListener('change', (e) => {
      const toScreen = e.target.value;
      if (toScreen === '') return;
      moveSelect.disabled = true;
      pendingMoves[nodeId] = { el };
      ipcRenderer.send('move-node-to-screen', {
        nodeId,
        toScreen: Number(toScreen),
        headerHidden: el.dataset.headerHidden === 'true',
      });
    });
  }

  const collectorMod = loadModule(node, node.collector);
  const widgetMod = loadModule(node, node.widget);
  const args = node.collectorArgs || [];

  async function refresh() {
    try {
      const data = await collectorMod[node.collectorFn](...args);
      widgetMod.render(bodyEl, data);
      trimFitZones(bodyEl);
    } catch (err) {
      bodyEl.innerHTML = `<div class="node-empty">ERROR: ${err.message}</div>`;
    }
  }

  refresh();
  if (node.refreshMs > 0) {
    timers[nodeId] = setInterval(refresh, node.refreshMs);
  }

  content.querySelector('.node-panel-close').addEventListener('click', () => {
    clearInterval(timers[nodeId]);
    delete timers[nodeId];
    grid.removeWidget(el);
    placedIds.delete(nodeId);
    renderPalette();
  });
}

function fitsWithoutScroll() {
  const wrap = document.querySelector('.grid-wrap');
  return wrap.scrollHeight <= wrap.clientHeight + 1;
}

// Resizing an existing tile bigger (its own resize handle, not a fresh add)
// doesn't go through addNodeToGrid at all - guard it here too, since the
// grid-wrap being overflow:hidden means an oversized tile would otherwise
// just get silently clipped instead of visibly reverting.
let resizeStartSize = null;

grid.on('resizestart', (event, el) => {
  resizeStartSize = el.gridstackNode ? { w: el.gridstackNode.w, h: el.gridstackNode.h } : null;
});

grid.on('resizestop', (event, el) => {
  if (resizeStartSize && !fitsWithoutScroll()) {
    grid.update(el, resizeStartSize);
    if (window.jarvisToast) window.jarvisToast('No room', "Resize reverted — wouldn't fit without scrolling");
  }
  resizeStartSize = null;
});

function addNodeToGrid(nodeId, opts = {}) {
  const node = NODES[nodeId];
  if (!node || placedIds.has(nodeId)) return false;
  const w = opts.w || node.defaultSize?.w || 4;
  const h = opts.h || node.defaultSize?.h || 4;
  // Explicit x/y means this came from a saved layout/preset - trust it as
  // intentional even if it doesn't fit today's screen. Only free-placement
  // adds (dragged in from the palette, or a move from another screen) get
  // rejected for not fitting, since gridstack auto-packs those and
  // scrolling isn't wanted.
  const isFreePlacement = opts.x == null && opts.y == null;

  const el = grid.addWidget({
    w,
    h,
    x: opts.x,
    y: opts.y,
    id: nodeId,
    content: '<div class="grid-stack-item-content"></div>',
  });
  el.setAttribute('gs-id', nodeId);

  if (isFreePlacement && !fitsWithoutScroll()) {
    grid.removeWidget(el);
    if (window.jarvisToast) window.jarvisToast('No room', `${node.label} doesn't fit without scrolling`);
    return false;
  }

  el.dataset.headerHidden = opts.headerHidden ? 'true' : 'false';
  placedIds.add(nodeId);
  mountNode(nodeId, el);
  renderPalette();
  return true;
}

function renderPalette() {
  const list = document.getElementById('palette-list');
  list.innerHTML = '';
  Object.values(NODES).forEach((node) => {
    const item = document.createElement('div');
    const isPlaced = placedIds.has(node.id);
    item.className = 'palette-item' + (isPlaced ? ' placed' : '');
    item.textContent = node.label;
    if (!isPlaced) {
      item.draggable = true;
      item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/node-id', node.id);
      });
    }
    list.appendChild(item);
  });
}

// ---- layout load/save ----
function applyLayout(items) {
  Object.values(timers).forEach(clearInterval);
  Object.keys(timers).forEach((k) => delete timers[k]);
  grid.removeAll();
  placedIds.clear();
  items.forEach((it) => addNodeToGrid(it.id, it));
}

function populateLayoutSelect(layoutsData) {
  const sel = document.getElementById('layout-select');
  sel.innerHTML = '';
  Object.keys(layoutsData.presets).forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name.toUpperCase();
    if (name === layoutsData.activePreset) opt.selected = true;
    sel.appendChild(opt);
  });
}

let layoutsData = readLayouts();
populateLayoutSelect(layoutsData);
applyLayout(itemsForThisScreen(layoutsData));

const gridWrap = document.querySelector('.grid-wrap');
gridWrap.addEventListener('dragover', (e) => {
  if (editMode) e.preventDefault();
});
gridWrap.addEventListener('drop', (e) => {
  if (!editMode) return;
  e.preventDefault();
  const nodeId = e.dataTransfer.getData('text/node-id');
  if (nodeId) addNodeToGrid(nodeId, {});
});

// Every screen has its own grid content, but presets are linked: switching
// or saving a preset from any screen affects every open screen together.
document.getElementById('edit-toggle').addEventListener('click', () => setEditMode(!editMode));

const autostartBtn = document.getElementById('autostart-toggle');
ipcRenderer.invoke('get-autostart').then((on) => autostartBtn.classList.toggle('active', on));
autostartBtn.addEventListener('click', async () => {
  const on = await ipcRenderer.invoke('toggle-autostart');
  autostartBtn.classList.toggle('active', on);
});

document.getElementById('layout-select').addEventListener('change', (e) => {
  layoutsData.activePreset = e.target.value;
  writeLayouts(layoutsData);
  applyLayout(itemsForThisScreen(layoutsData));
  ipcRenderer.send('layouts-changed');
});

document.getElementById('save-layout-btn').addEventListener('click', () => {
  const name = prompt('Save current arrangement on ALL screens as:');
  if (!name) return;
  ipcRenderer.send('save-all-request', name);
});

// Confirms the save actually landed - writeLayouts() + the report-layout
// round trip are otherwise silent, which reads as "did that even work?"
ipcRenderer.on('save-all-complete', (event, presetName) => {
  if (window.jarvisToast) {
    window.jarvisToast('Layout saved', `Saved as "${presetName}" and set active — restores automatically on next launch/reboot.`);
  }
});

// Main process asks every open window to report its current grid so a
// save-all can bundle them into one linked preset.
ipcRenderer.on('report-layout', () => {
  const items = grid.save(false).map((it) => {
    const el = document.querySelector(`[gs-id="${it.id}"]`);
    return {
      id: it.id,
      x: it.x,
      y: it.y,
      w: it.w,
      h: it.h,
      headerHidden: el ? el.dataset.headerHidden === 'true' : false,
    };
  });
  ipcRenderer.send('layout-report', SCREEN_INDEX, items);
});

// Another window (a different monitor, or a completed save-all) changed
// layouts.json - re-sync the dropdown and this screen's grid to match.
ipcRenderer.on('layouts-changed', () => {
  const previousPreset = layoutsData.activePreset;
  layoutsData = readLayouts();
  populateLayoutSelect(layoutsData);
  if (layoutsData.activePreset !== previousPreset) {
    applyLayout(itemsForThisScreen(layoutsData));
  }
});

// This screen was asked (by another screen) to accept a moved node. Try to
// place it, then report back whether it actually fit - the source screen
// only removes its copy once it hears back "yes."
ipcRenderer.on('receive-moved-node', (event, payload) => {
  const success = addNodeToGrid(payload.nodeId, { headerHidden: payload.headerHidden });
  ipcRenderer.send('move-node-result', {
    nodeId: payload.nodeId,
    fromWebContentsId: payload.fromWebContentsId,
    success,
  });
});

// The screen we tried to move a node to just confirmed whether it fit.
ipcRenderer.on('move-node-result', (event, { nodeId, success }) => {
  const pending = pendingMoves[nodeId];
  delete pendingMoves[nodeId];
  if (!pending) return;
  const { el } = pending;
  if (success) {
    clearInterval(timers[nodeId]);
    delete timers[nodeId];
    grid.removeWidget(el);
    placedIds.delete(nodeId);
    renderPalette();
  } else {
    const moveSelect = el.querySelector('.node-panel-move');
    if (moveSelect) {
      moveSelect.disabled = false;
      moveSelect.value = '';
    }
    if (window.jarvisToast) window.jarvisToast('Move failed', "No room on that screen");
  }
});

document.getElementById('min-btn').addEventListener('click', () => ipcRenderer.send('window-minimize'));
document.getElementById('close-btn').addEventListener('click', () => ipcRenderer.send('window-hide'));

setEditMode(false);

// ---- toast notifications ----
// Exposed globally so any node's widget.js can call window.jarvisToast(...)
// directly (widgets run in this same renderer/global scope) to broadcast a
// notification to every open screen, not just its own.
function showToast(title, body) {
  const stack = document.getElementById('toast-stack');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<div class="toast-title">${title}</div><div class="toast-body">${body}</div>`;
  stack.appendChild(el);
  setTimeout(() => el.remove(), 6200);
}

window.jarvisToast = (title, body) => {
  showToast(title, body);
  ipcRenderer.send('toast-broadcast', { title, body });
};

ipcRenderer.on('show-toast', (event, { title, body }) => showToast(title, body));

function tickClock() {
  document.getElementById('clock').textContent = new Date().toLocaleString([], { hour12: false });
}
tickClock();
setInterval(tickClock, 1000);
