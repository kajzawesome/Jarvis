const collector = require('./collector.js');

function targetRow(t) {
  return `
    <div class="row">
      <span class="row-label">${t.name}</span>
      <span class="row-value ${t.ok ? '' : 'urgent'}">${t.ok ? (t.responseMs + 'ms') : 'DOWN'}</span>
      <span class="node-panel-close" data-remove="${t.index}" title="remove" style="position:static;">&times;</span>
    </div>
  `;
}

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const targets = data.metrics.targets || [];

  targets
    .filter((t) => t.changed)
    .forEach((t) => {
      if (window.jarvisToast) {
        window.jarvisToast(t.ok ? 'Back up' : 'DOWN', `${t.name} is ${t.ok ? 'reachable again' : 'not responding'} (${t.detail})`);
      }
    });

  const downCount = targets.filter((t) => !t.ok).length;

  container.innerHTML = `
    <div class="stat-block">
      <div class="status-pill ${downCount ? 'status-offline' : 'status-online'}">${downCount ? downCount + ' DOWN' : 'ALL UP'}</div>
      <div class="fit-zone">
        ${targets.map(targetRow).join('') || '<div class="foot-line">no targets - add one below</div>'}
      </div>
      <div class="sub-heading">ADD TARGET</div>
      <div class="deadline-form">
        <input type="text" class="app-picker-search" placeholder="name" data-field="name" />
        <select class="app-status-select" data-field="type">
          <option value="http">HTTP</option>
          <option value="tcp">TCP</option>
        </select>
        <input type="text" class="app-picker-search" placeholder="url or host" data-field="target" />
        <input type="text" class="app-picker-search" placeholder="port (tcp)" data-field="port" style="max-width:56px;" />
        <button class="hud-btn" data-action="add">ADD</button>
      </div>
    </div>
  `;

  container.querySelectorAll('[data-remove]').forEach((el) => {
    el.addEventListener('click', async () => {
      collector.removeTarget(Number(el.dataset.remove));
      const fresh = await collector.getStatus();
      render(container, fresh);
    });
  });

  container.querySelector('[data-action="add"]').addEventListener('click', async () => {
    const name = container.querySelector('[data-field="name"]').value;
    const type = container.querySelector('[data-field="type"]').value;
    const target = container.querySelector('[data-field="target"]').value;
    const port = container.querySelector('[data-field="port"]').value;
    if (!name.trim() || !target.trim()) return;
    collector.addTarget({ name, type, target, port });
    const fresh = await collector.getStatus();
    render(container, fresh);
  });
}

module.exports = { render };
