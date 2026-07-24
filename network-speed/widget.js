const collector = require('./collector.js');

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }

  const body =
    data.state === 'ok'
      ? `
        <div class="row"><span class="row-label">Download</span><span class="row-value">${data.metrics.downMbps} Mbps</span></div>
        <div class="row"><span class="row-label">Upload</span><span class="row-value">${data.metrics.upMbps} Mbps</span></div>
        <div class="foot-line">${new Date(data.metrics.testedAt).toLocaleTimeString()}</div>
      `
      : `<div class="foot-line">no test run yet</div>`;

  container.innerHTML = `
    <div class="stat-block">
      ${body}
      <div class="btn-row"><button class="hud-btn" data-action="run">RUN TEST</button></div>
      <div class="foot-line" data-status-line></div>
    </div>
  `;

  container.querySelector('[data-action="run"]').addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'TESTING...';
    try {
      await collector.runTest();
      const fresh = await collector.getStatus();
      render(container, fresh);
    } catch (err) {
      container.querySelector('[data-status-line]').textContent = 'error: ' + err.message;
      btn.disabled = false;
      btn.textContent = 'RUN TEST';
    }
  });
}

module.exports = { render };
