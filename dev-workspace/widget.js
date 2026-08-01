const collector = require('./collector.js');

function windowRow(w) {
  return `
    <div class="row" data-focus="${w.pid}" style="cursor:pointer;">
      <span class="row-label">${w.processName}</span>
      <span class="row-value">${w.title}</span>
    </div>
  `;
}

function projectRow(p) {
  const dirty = p.git.dirtyCount > 0;
  const state = dirty ? `${p.git.dirtyCount} changed` : 'clean';
  const aheadBehind = p.git.ahead || p.git.behind ? ` ${p.git.ahead}↑${p.git.behind}↓` : '';
  return `
    <div class="row" data-open="${encodeURIComponent(p.path)}" title="open in VS Code" style="cursor:pointer;">
      <span class="row-label">${p.name}${p.open ? ' ●' : ''}</span>
      <span class="row-value ${dirty ? 'urgent' : ''}">${p.git.branch}${aheadBehind} · ${state}</span>
    </div>
  `;
}

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const windows = data.metrics.windows || [];
  const projects = data.metrics.projects || [];

  container.innerHTML = `
    <div class="stat-block">
      <div class="sub-heading">OPEN EDITORS</div>
      <div class="fit-zone">
        ${windows.map(windowRow).join('') || '<div class="foot-line">none detected</div>'}
      </div>
      <div class="sub-heading">PROJECT GIT STATUS</div>
      <div class="fit-zone">
        ${projects.map(projectRow).join('') || '<div class="foot-line">no known VS Code git repos found</div>'}
      </div>
    </div>
  `;

  container.querySelectorAll('[data-focus]').forEach((el) => {
    el.addEventListener('click', () => collector.focusWindow(Number(el.dataset.focus)));
  });

  container.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', () => collector.openInEditor(decodeURIComponent(el.dataset.open)));
  });
}

module.exports = { render };
