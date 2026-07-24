const collector = require('./collector.js');

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  if (data.state === 'not_configured') {
    container.innerHTML = `<div class="node-empty">not configured - add STREAMLABS_API_TOKEN to .env (see streamlabs/README.md)</div>`;
    return;
  }
  if (data.state === 'not_running') {
    container.innerHTML = `
      <div class="stat-block">
        <div class="status-pill status-offline">STREAMLABS NOT RUNNING</div>
        <div class="btn-row"><button class="hud-btn" data-action="launch">LAUNCH STREAMLABS</button></div>
      </div>
    `;
    container.querySelector('[data-action="launch"]').addEventListener('click', () => collector.launchStreamlabs());
    return;
  }
  if (data.state === 'error') {
    container.innerHTML = `<div class="node-empty">${data.metrics.error}</div>`;
    return;
  }

  const m = data.metrics;
  container.innerHTML = `
    <div class="stat-block">
      <div class="row">
        <span class="row-label">Streaming</span>
        <span class="row-value ${m.streaming ? '' : 'urgent'}">${m.streaming ? 'LIVE' : 'off'}</span>
      </div>
      <div class="row">
        <span class="row-label">Recording</span>
        <span class="row-value ${m.recording ? '' : 'urgent'}">${m.recording ? 'ON' : 'off'}</span>
      </div>
      <div class="btn-row">
        <button class="hud-btn" data-action="stream">${m.streaming ? 'STOP STREAM' : 'START STREAM'}</button>
        <button class="hud-btn" data-action="record">${m.recording ? 'STOP REC' : 'START REC'}</button>
      </div>
      <div class="foot-line" data-status-line></div>
    </div>
  `;

  container.querySelector('[data-action="stream"]').addEventListener('click', async (e) => {
    await runAction(e.target, container, collector.toggleStreaming);
  });
  container.querySelector('[data-action="record"]').addEventListener('click', async (e) => {
    await runAction(e.target, container, collector.toggleRecording);
  });
}

async function runAction(btn, container, fn) {
  btn.disabled = true;
  try {
    await fn();
    const fresh = await collector.getStatus();
    render(container, fresh);
  } catch (err) {
    container.querySelector('[data-status-line]').textContent = 'error: ' + err.message;
    btn.disabled = false;
  }
}

module.exports = { render };
