const { shell, ipcRenderer } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const collector = require('./collector.js');

function iconMarkup(link) {
  if (link.icon) {
    const abs = path.join(__dirname, link.icon);
    return `<img class="link-tile-icon-img" src="${pathToFileURL(abs).href}" draggable="false" />`;
  }
  return `<div class="link-tile-icon">${(link.label || '?').slice(0, 1).toUpperCase()}</div>`;
}

function parseArgs(argString) {
  const matches = argString.match(/"[^"]*"|\S+/g) || [];
  return matches.map((a) => a.replace(/^"|"$/g, ''));
}

function launch(link) {
  if (link.type === 'url') {
    shell.openExternal(link.target);
  } else if (link.args) {
    // shell.openPath can't pass arguments - needed for shortcuts like
    // "MC Server" that launch powershell.exe with a -File script.
    spawn(link.target, parseArgs(link.args), { detached: true, stdio: 'ignore' }).unref();
  } else {
    shell.openPath(link.target);
  }
}

async function refreshAndRerender(container) {
  const fresh = await collector.getLinks();
  render(container, fresh);
}

async function openAppPicker(container) {
  const panel = document.createElement('div');
  panel.className = 'app-picker';
  panel.innerHTML = `
    <input class="app-picker-search" type="text" placeholder="search detected apps..." />
    <div class="app-picker-list"><div class="node-empty">loading...</div></div>
    <button class="hud-btn app-picker-close">CANCEL</button>
  `;
  container.appendChild(panel);

  const searchInput = panel.querySelector('.app-picker-search');
  const listEl = panel.querySelector('.app-picker-list');
  searchInput.focus();

  panel.querySelector('.app-picker-close').addEventListener('click', () => panel.remove());

  let apps = [];
  try {
    apps = await collector.listInstalledApps();
  } catch (err) {
    listEl.innerHTML = `<div class="node-empty">could not list apps: ${err.message}</div>`;
    return;
  }

  function renderList(filter) {
    const q = filter.trim().toLowerCase();
    const matches = (q ? apps.filter((a) => a.name.toLowerCase().includes(q)) : apps).slice(0, 40);
    listEl.innerHTML =
      matches.map((a, i) => `<div class="app-picker-item" data-i="${i}">${a.name}</div>`).join('') ||
      '<div class="node-empty">no matches</div>';

    listEl.querySelectorAll('.app-picker-item').forEach((el) => {
      el.addEventListener('click', async () => {
        const app = matches[Number(el.dataset.i)];
        panel.remove();
        await collector.addLink({ label: app.name, type: 'app', target: app.target, args: app.args || null });
        await refreshAndRerender(container);
      });
    });
  }

  renderList('');
  searchInput.addEventListener('input', () => renderList(searchInput.value));
}

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const links = data.metrics.links || [];

  container.innerHTML = `
    <div class="link-grid">
      ${links
        .map(
          (l, i) => `<div class="link-tile" data-index="${i}">
            <div class="link-tile-remove" data-remove="${i}" title="remove">&times;</div>
            ${iconMarkup(l)}
            <div class="link-tile-label">${l.label}</div>
          </div>`
        )
        .join('')}
      <div class="link-tile link-tile-add" data-add="app">
        <div class="link-tile-icon">+</div>
        <div class="link-tile-label">ADD APP</div>
      </div>
      <div class="link-tile link-tile-add" data-add="file">
        <div class="link-tile-icon">…</div>
        <div class="link-tile-label">BROWSE</div>
      </div>
      <div class="link-tile link-tile-add" data-add="url">
        <div class="link-tile-icon">U</div>
        <div class="link-tile-label">ADD URL</div>
      </div>
    </div>
  `;

  container.querySelectorAll('.link-tile[data-index]').forEach((el) => {
    el.addEventListener('click', () => {
      const link = links[Number(el.dataset.index)];
      if (link) launch(link);
    });
  });

  container.querySelectorAll('.link-tile-remove').forEach((el) => {
    el.addEventListener('click', async (e) => {
      e.stopPropagation();
      collector.removeLink(Number(el.dataset.remove));
      await refreshAndRerender(container);
    });
  });

  container.querySelector('[data-add="app"]').addEventListener('click', () => openAppPicker(container));

  container.querySelector('[data-add="file"]').addEventListener('click', async () => {
    const picked = await ipcRenderer.invoke('pick-path');
    if (!picked) return;
    const label = prompt('Label for this shortcut:', path.basename(picked));
    if (!label) return;
    const isDir = fs.statSync(picked).isDirectory();
    await collector.addLink({ label, type: isDir ? 'folder' : 'app', target: picked });
    await refreshAndRerender(container);
  });

  container.querySelector('[data-add="url"]').addEventListener('click', async () => {
    const url = prompt('URL (include https://):');
    if (!url) return;
    const label = prompt('Label:', url.replace(/^https?:\/\//, '').split('/')[0]);
    if (!label) return;
    await collector.addLink({ label, type: 'url', target: url });
    await refreshAndRerender(container);
  });
}

module.exports = { render };
