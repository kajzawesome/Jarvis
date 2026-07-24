function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  if (data.state === 'unavailable') {
    container.innerHTML = `<div class="node-empty">NWS alerts are US-only, not available for this location</div>`;
    return;
  }
  if (data.state === 'error') {
    container.innerHTML = `<div class="node-empty">${data.metrics.error}</div>`;
    return;
  }

  const m = data.metrics;

  if (m.newAlerts && m.newAlerts.length && window.jarvisToast) {
    m.newAlerts.forEach((a) => window.jarvisToast('Weather Alert', a.headline || a.event));
  }

  if (!m.alerts.length) {
    container.innerHTML = `<div class="stat-block"><div class="status-pill status-online">NO ACTIVE ALERTS</div></div>`;
    return;
  }

  container.innerHTML = `
    <div class="stat-block">
      <div class="status-pill status-offline">${m.alerts.length} ACTIVE ALERT${m.alerts.length > 1 ? 'S' : ''}</div>
      ${m.alerts
        .map(
          (a) => `<div class="row">
            <span class="row-label urgent" style="width:auto;flex:1;">${a.event}</span>
          </div>
          <div class="foot-line">${a.headline || ''}</div>`
        )
        .join('')}
    </div>
  `;
}

module.exports = { render };
