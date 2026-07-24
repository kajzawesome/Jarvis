function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  if (data.state === 'not_configured') {
    container.innerHTML = `<div class="node-empty">not configured - add ROUTER_USER/ROUTER_PASSWORD to .env (see router-network/README.md)</div>`;
    return;
  }
  if (data.state === 'error') {
    container.innerHTML = `<div class="node-empty">error: ${data.metrics.error}</div>`;
    return;
  }

  const m = data.metrics;
  const devices = (m.devices || [])
    .slice(0, 8)
    .map(
      (d) => `<div class="row">
        <span class="row-label">${d.name}</span>
        <span class="row-value">${d.ip || ''}</span>
      </div>`
    )
    .join('');

  container.innerHTML = `
    <div class="stat-block">
      <div class="status-pill ${m.wan_connected ? 'status-online' : 'status-offline'}">${m.wan_connected ? 'WAN UP' : 'WAN DOWN'}</div>
      <div class="row">
        <span class="row-label">Public IP</span>
        <span class="row-value">${m.wan_ip || '--'}</span>
      </div>
      <div class="sub-heading">DEVICES (${m.connected_devices})</div>
      ${devices}
    </div>
  `;
}

module.exports = { render };
