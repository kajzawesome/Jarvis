const { ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { readLayouts, writeLayouts } = require('../layouts-store');

const params = new URLSearchParams(location.search);
const PRIMARY = params.get('primary') === '1';
const SCREEN_INDEX = params.get('screen') || '0';
const TOTAL_SCREENS = parseInt(params.get('totalScreens') || '1', 10);

// ---- toast notifications ----
// Exposed globally so any node's widget.js can call window.jarvisToast(...)
// directly (widgets run in this same renderer/global scope) to broadcast a
// notification to every open screen, not just its own. Defined this early
// (before node discovery/grid setup) deliberately - the very first layout
// load can itself trigger a toast (see pruneOffscreenItems below), and a
// call to window.jarvisToast before this assignment ran would silently
// no-op instead of showing anything.
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

// ---- theme presets ----
// Every shared HUD class (buttons, borders, glow, the ambient background,
// text) reads these same 3 CSS custom properties (--green/--green-dim/
// --green-faint/--glow) from :root in style.css - the property names stuck
// with the original green theme's naming, but they're just the "accent
// color" slots now, regardless of which preset is active. Applying a theme
// is just overriding those 4 custom properties on the root element - no
// separate stylesheet per theme, no class-per-theme CSS to maintain.
const THEMES = {
  green: {
    green: '#00ff9c',
    greenDim: '#0a5c38',
    greenFaint: '#063321',
    glow: '0 0 6px rgba(0, 255, 156, 0.55), 0 0 18px rgba(0, 255, 156, 0.15)',
  },
  blue: {
    green: '#00c3ff',
    greenDim: '#0a4a6b',
    greenFaint: '#052635',
    glow: '0 0 6px rgba(0, 195, 255, 0.55), 0 0 18px rgba(0, 195, 255, 0.15)',
  },
  amber: {
    green: '#ffb300',
    greenDim: '#6b4a0a',
    greenFaint: '#352505',
    glow: '0 0 6px rgba(255, 179, 0, 0.55), 0 0 18px rgba(255, 179, 0, 0.15)',
  },
  purple: {
    green: '#b877ff',
    greenDim: '#4a2a6b',
    greenFaint: '#251535',
    glow: '0 0 6px rgba(184, 119, 255, 0.55), 0 0 18px rgba(184, 119, 255, 0.15)',
  },
};

function applyTheme(name) {
  const theme = THEMES[name] || THEMES.green;
  const root = document.documentElement.style;
  root.setProperty('--green', theme.green);
  root.setProperty('--green-dim', theme.greenDim);
  root.setProperty('--green-faint', theme.greenFaint);
  root.setProperty('--glow', theme.glow);
  const select = document.getElementById('theme-select');
  if (select) select.value = THEMES[name] ? name : 'green';
}

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
const refreshFns = {};
const pendingMoves = {}; // nodeId -> { el } while awaiting move-node-result

// ---- pause background work while hidden/minimized ----
// Electron only stops rendering/compositing a hidden or minimized window -
// it keeps running the renderer's JS at full speed, so every node's
// setInterval (including the ones that shell out to PowerShell/WMI/docker/
// network calls every few seconds) kept firing even after hiding Jarvis to
// go play a game, fighting it for CPU. document.visibilityState/
// visibilitychange fires 'hidden' for both an explicit hide() (the tray's
// Show/Hide All, Ctrl+Alt+J, the X button) and a plain OS minimize
// (confirmed live, not assumed) - use it to stop every node's timer while
// nothing's visible anyway, and catch up with one immediate refresh each
// plus restart them the moment this screen is visible again.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    Object.entries(timers).forEach(([nodeId, id]) => clearInterval(id));
  } else {
    Object.entries(refreshFns).forEach(([nodeId, refresh]) => {
      refresh();
      const node = NODES[nodeId];
      if (node && node.refreshMs > 0) timers[nodeId] = setInterval(refresh, node.refreshMs);
    });
  }
});

const GRID_CELL_HEIGHT = 70;
const GRID_MARGIN = 8;

const grid = GridStack.init(
  { cellHeight: GRID_CELL_HEIGHT, margin: GRID_MARGIN, float: true, staticGrid: true },
  '#grid'
);

// How many grid rows actually fit in this screen's visible grid area right
// now. There's no vertical scrolling (by design - see the "no scroll"
// comment below), so a row beyond this is invisible and, until the fixes
// below landed, unremovable - the grid had no ceiling on how far down an
// auto-placed or resized tile could land.
function maxVisibleRows() {
  const wrap = document.querySelector('.grid-wrap');
  return Math.max(1, Math.floor((wrap.clientHeight + GRID_MARGIN) / (GRID_CELL_HEIGHT + GRID_MARGIN)));
}

// Bounded first-fit scan for a genuinely-visible empty slot, row-major
// (top-left first) - unlike GridStack's own built-in auto-position, which
// has no concept of "visible" and will happily hand back a slot below the
// fold if nothing higher up fits. Returns null if nothing on-screen fits.
function findVisibleSlot(w, h) {
  const cols = grid.getColumn();
  const rows = maxVisibleRows();
  if (w > cols || h > rows) return null;
  for (let y = 0; y <= rows - h; y++) {
    for (let x = 0; x <= cols - w; x++) {
      if (grid.isAreaEmpty(x, y, w, h)) return { x, y };
    }
  }
  return null;
}

// Warns (but no longer deletes - see removeNodeFromGrid/the palette-list ×
// below for how to actually get rid of an off-screen tile) about any
// currently-placed tile whose position/size doesn't fit entirely within the
// visible grid. Auto-deleting here used to be the "fix" for an off-screen
// tile being unremovable (its own on-grid × is off-screen too) - but that
// meant the app was silently deleting arranged content on load/save, which
// read as broken/untrustworthy even when the bounds math itself was
// correct. The actual fix for "unremovable" is a removal path that doesn't
// depend on the tile being visible at all (the palette list's × below,
// always reachable in edit mode) - so nothing needs to be auto-deleted
// anymore, this is purely informational.
function pruneOffscreenItems(reason) {
  const cols = grid.getColumn();
  const rows = maxVisibleRows();
  const offscreenLabels = [];

  Array.from(placedIds).forEach((nodeId) => {
    const el = grid.el.querySelector(`[gs-id="${nodeId}"]`);
    const n = el && el.gridstackNode;
    if (!n) return;
    const outOfBounds = n.x < 0 || n.y < 0 || n.x + n.w > cols || n.y + n.h > rows;
    if (outOfBounds) offscreenLabels.push(NODES[nodeId]?.label || nodeId);
  });

  if (offscreenLabels.length && window.jarvisToast) {
    const plural = offscreenLabels.length > 1;
    window.jarvisToast(
      `Tile${plural ? 's' : ''} off-screen`,
      `${offscreenLabels.join(', ')} ${plural ? "don't" : "doesn't"} fit this screen's visible area${reason ? ' ' + reason : ''}. Nothing was deleted — remove ${plural ? 'them' : 'it'} from the palette list (left panel, edit mode) if you don't want ${plural ? 'them' : 'it'} anymore.`
    );
  }
}

// Shared by the on-tile × (mountNode) and the palette list's × (renderPalette)
// - the palette one works even when the tile is off-screen, since it doesn't
// look the element up by visibility, just by nodeId.
function removeNodeFromGrid(nodeId) {
  const el = grid.el.querySelector(`[gs-id="${nodeId}"]`);
  clearInterval(timers[nodeId]);
  delete timers[nodeId];
  delete refreshFns[nodeId];
  if (el) grid.removeWidget(el);
  placedIds.delete(nodeId);
  renderPalette();
}

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
  refreshFns[nodeId] = refresh;
  // Don't start a live interval while this screen is hidden/minimized (e.g.
  // a node just got moved here from another screen while this one was
  // hidden) - the visibilitychange handler below is what starts/stops
  // every node's timer together, and starting one here too would double it
  // up once this screen becomes visible again.
  if (node.refreshMs > 0 && document.visibilityState !== 'hidden') {
    timers[nodeId] = setInterval(refresh, node.refreshMs);
  }

  content.querySelector('.node-panel-close').addEventListener('click', () => removeNodeFromGrid(nodeId));
}

// "Never show a scrollbar" is enforced entirely at the CSS level
// (.grid-wrap and .node-panel-body are both overflow:hidden) - earlier this
// was ALSO enforced here in JS by reverting/rejecting any add or resize
// that pushed the grid's total height past the visible area. That doubled
// up badly: the JS check looks at the *whole* grid's height, so on a grid
// with several tiles already placed, almost any resize (even one that only
// grows a little) could tip the total over the edge and get silently
// undone - which just reads as "resizing is broken." The CSS guarantee is
// sufficient on its own (an oversized tile is clipped, never scrollable),
// so the JS-level reject/revert was removed rather than tuned - it was
// fighting normal use, not preventing scrollbars that wouldn't already be
// blocked anyway.

function addNodeToGrid(nodeId, opts = {}) {
  const node = NODES[nodeId];
  if (!node || placedIds.has(nodeId)) return false;
  const w = opts.w || node.defaultSize?.w || 4;
  const h = opts.h || node.defaultSize?.h || 4;

  let { x, y } = opts;
  if (x == null || y == null) {
    // No explicit position (palette drag, or a cross-screen move landing
    // here) - find a slot that's actually visible rather than letting
    // GridStack's own auto-position hand back the first empty cell
    // anywhere, fold or no fold (that's what put an unreachable, unclosable
    // weather tile below the visible area on a second monitor).
    const slot = findVisibleSlot(w, h);
    if (!slot) {
      if (window.jarvisToast) {
        window.jarvisToast('No room', `${node.label} doesn't fit anywhere on this screen — remove or resize something first.`);
      }
      return false;
    }
    x = slot.x;
    y = slot.y;
  }

  const el = grid.addWidget({
    w,
    h,
    x,
    y,
    id: nodeId,
    content: '<div class="grid-stack-item-content"></div>',
  });
  el.setAttribute('gs-id', nodeId);

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

    const label = document.createElement('span');
    label.className = 'palette-item-label';
    label.textContent = node.label;
    item.appendChild(label);

    if (isPlaced) {
      // Works even if this tile is currently off-screen (cut off below the
      // fold) - looked up by nodeId, not by finding a visible element to
      // click on, which is the whole point: an off-screen tile's own
      // on-grid × is off-screen too, so this is the one removal path
      // that's always reachable regardless of where the tile actually is.
      const removeBtn = document.createElement('span');
      removeBtn.className = 'palette-item-remove';
      removeBtn.textContent = '×';
      removeBtn.title = 'Remove from this screen (works even if off-screen)';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeNodeFromGrid(node.id);
      });
      item.appendChild(removeBtn);
    } else {
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
  Object.keys(refreshFns).forEach((k) => delete refreshFns[k]);
  grid.removeAll();
  placedIds.clear();
  items.forEach((it) => addNodeToGrid(it.id, it));
  // A saved item's x/y is trusted as-is above (unlike a fresh drag, which
  // already gets a bounds-checked slot) - this is what surfaces a stale
  // saved layout that predates the bounds check, or one saved on a bigger
  // screen than this one. Purely informational - nothing gets deleted.
  pruneOffscreenItems('when this layout was loaded');
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

  const presetCount = Object.keys(layoutsData.presets).length;
  document.getElementById('update-layout-btn').textContent = `UPDATE "${layoutsData.activePreset.toUpperCase()}"`;
  const deleteBtn = document.getElementById('delete-layout-btn');
  deleteBtn.disabled = presetCount <= 1;
  deleteBtn.title = presetCount <= 1 ? "Can't delete the only remaining preset" : '';
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

// Off by default - the ambient background (3 always-running CSS animations)
// is cheap on a desktop GPU but adds up on a laptop/lower-power one running
// on battery. A single global setting, not per-screen - toggling it on any
// screen applies to every open window at once via main.js's broadcast.
const reduceMotionBtn = document.getElementById('reduce-motion-toggle');
function applyReduceMotion(on) {
  document.body.classList.toggle('reduce-motion', on);
  reduceMotionBtn.classList.toggle('active', on);
}
ipcRenderer.invoke('get-reduce-motion').then(applyReduceMotion);
reduceMotionBtn.addEventListener('click', async () => {
  const on = await ipcRenderer.invoke('toggle-reduce-motion');
  applyReduceMotion(on);
});
ipcRenderer.on('reduce-motion-changed', (event, on) => applyReduceMotion(on));

// Global (not per-screen) accent color theme - same broadcast pattern as
// reduce-motion above. THEMES/applyTheme are defined near the top of this
// file (before node discovery) so a node's very first render already has
// the right colors, not just the default green for one frame.
const themeSelect = document.getElementById('theme-select');
ipcRenderer.invoke('get-theme').then(applyTheme);
themeSelect.addEventListener('change', async () => {
  const name = await ipcRenderer.invoke('set-theme', themeSelect.value);
  applyTheme(name);
});
ipcRenderer.on('theme-changed', (event, name) => applyTheme(name));

function switchPreset(name) {
  if (!layoutsData.presets[name]) return false;
  layoutsData.activePreset = name;
  writeLayouts(layoutsData);
  applyLayout(itemsForThisScreen(layoutsData));
  ipcRenderer.send('layouts-changed');
  document.getElementById('layout-select').value = name;
  return true;
}

// Exposed so nodes like voice-control can switch presets without owning
// layout state themselves - same pattern as window.jarvisToast.
window.jarvisSwitchPreset = switchPreset;

document.getElementById('layout-select').addEventListener('change', (e) => switchPreset(e.target.value));

document.getElementById('save-layout-btn').addEventListener('click', async () => {
  const name = await window.jarvisPrompt('Save current arrangement on ALL screens as:');
  if (!name) return;
  ipcRenderer.send('save-all-request', name);
});

// Re-saves the CURRENTLY active preset in place, under its exact existing
// name - same round trip as SAVE ALL AS but skips the naming prompt, so
// there's no chance of a retyped name silently creating a near-duplicate
// preset instead of updating the one you meant (that's exactly how a
// "Defaiult" typo preset can end up sitting next to "Default").
document.getElementById('update-layout-btn').addEventListener('click', () => {
  ipcRenderer.send('save-all-request', layoutsData.activePreset);
});

// Deletes the active preset. Retyping its name is the confirmation step
// (same jarvisPrompt-based pattern as everywhere else in this app - no
// native confirm(), which can render behind these fullscreen windows).
document.getElementById('delete-layout-btn').addEventListener('click', async () => {
  const name = layoutsData.activePreset;
  const typed = await window.jarvisPrompt(`Type "${name}" to permanently delete this preset:`);
  if (typed !== name) return;
  ipcRenderer.send('delete-preset-request', name);
});

// Confirms the save actually landed - writeLayouts() + the report-layout
// round trip are otherwise silent, which reads as "did that even work?"
ipcRenderer.on('save-all-complete', (event, presetName) => {
  if (window.jarvisToast) {
    window.jarvisToast('Layout saved', `Saved as "${presetName}" and set active — restores automatically on next launch/reboot.`);
  }
});

ipcRenderer.on('preset-deleted', (event, { presetName, newActivePreset }) => {
  if (window.jarvisToast) {
    window.jarvisToast('Preset deleted', `"${presetName}" removed — switched to "${newActivePreset}".`);
  }
});

// Main process asks every open window to report its current grid so a
// save-all can bundle them into one linked preset. Warn about anything
// off-screen right before it saves - purely informational, the save still
// captures the exact arrangement as-is, off-screen tiles included.
ipcRenderer.on('report-layout', () => {
  pruneOffscreenItems('before this layout was saved');
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
    delete refreshFns[nodeId];
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

// main.js re-syncs desktop-links against the real Windows Desktop on every
// launch (see syncDesktopLinks in main.js); once that write lands, force
// this tile to re-pull links.json rather than waiting on its refreshMs: 0
// (manual-only) interval, which would otherwise leave the newly-synced
// links invisible until an unrelated add/remove triggered a re-render.
ipcRenderer.on('force-refresh-node', (event, nodeId) => {
  if (refreshFns[nodeId]) refreshFns[nodeId]();
});

// ---- in-page prompt, replacing window.prompt() ----
// Native OS dialogs (window.prompt/confirm) could end up rendered behind an
// exclusive-fullscreen window on Windows (back when these windows used
// fullscreen: true - since removed, see main.js, but no reason to bring
// native dialogs back). A blocked/invisible prompt looks identical to
// "nothing happened," which is exactly what SAVE ALL AS... looked like.
// This is an in-DOM replacement so there's no native dialog to get hidden.
function jarvisPrompt(message, defaultValue = '') {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'jarvis-modal-overlay';
    overlay.innerHTML = `
      <div class="jarvis-modal">
        <div class="jarvis-modal-message">${message}</div>
        <input type="text" class="app-picker-search jarvis-modal-input" />
        <div class="btn-row">
          <button class="hud-btn" data-action="ok">OK</button>
          <button class="hud-btn" data-action="cancel">CANCEL</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    const input = overlay.querySelector('.jarvis-modal-input');
    input.value = defaultValue;
    input.focus();
    input.select();

    function finish(value) {
      overlay.remove();
      resolve(value);
    }

    // OK resolves with the raw value (even "") so callers can tell "typed
    // nothing, but confirmed" apart from "cancelled" (visa-status's log
    // check relies on this - blank+confirmed means "keep current stage").
    // Only Cancel/Escape resolve null.
    overlay.querySelector('[data-action="ok"]').addEventListener('click', () => finish(input.value.trim()));
    overlay.querySelector('[data-action="cancel"]').addEventListener('click', () => finish(null));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') finish(input.value.trim());
      if (e.key === 'Escape') finish(null);
    });
  });
}

window.jarvisPrompt = jarvisPrompt;

function tickClock() {
  document.getElementById('clock').textContent = new Date().toLocaleString([], { hour12: false });
}
tickClock();
setInterval(tickClock, 1000);
