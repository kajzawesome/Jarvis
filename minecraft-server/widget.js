const collector = require('./collector.js');

const STATE_LABEL = { running: 'ONLINE', stopped: 'OFFLINE', partial: 'PARTIAL' };

function renderInner(data) {
  const m = data.metrics;
  const stateLabel = STATE_LABEL[data.state] || data.state.toUpperCase();
  const stateClass = data.state === 'running' ? 'status-online' : 'status-offline';

  const rows = (m.containers || [])
    .map(
      (c) => `
      <div class="row">
        <span class="row-label">${c.name}</span>
        <span class="row-value ${c.status === 'running' ? '' : 'urgent'}">${c.status}</span>
      </div>`
    )
    .join('');

  return `
    <div class="stat-block">
      <div class="status-pill ${stateClass}">${stateLabel}</div>
      ${rows}
      <div class="row">
        <span class="row-label">Relay</span>
        <span class="row-value ${m.relay && m.relay.ok ? '' : 'urgent'}">${m.relay && m.relay.ok ? 'up' : 'down'}</span>
      </div>
      <div class="btn-row">
        <button class="hud-btn" data-action="toggle">${data.state === 'running' ? 'STOP' : 'START'}</button>
        <button class="hud-btn" data-action="restart">RESTART</button>
        <button class="hud-btn" data-action="files">FILES</button>
      </div>
      <div class="foot-line" data-status-line></div>
    </div>
  `;
}

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }

  if (data.state === 'daemon_down') {
    collector.stopWatchingLogs();
    container.innerHTML = `
      <div class="stat-block">
        <div class="status-pill status-offline">DOCKER NOT RUNNING</div>
        <div class="btn-row"><button class="hud-btn" data-action="launch">LAUNCH DOCKER DESKTOP</button></div>
      </div>
    `;
    container.querySelector('[data-action="launch"]').addEventListener('click', () => collector.launchDockerDesktop());
    return;
  }

  if (data.state === 'running') {
    collector.watchJoinLeave((evt) => {
      if (window.jarvisToast) {
        window.jarvisToast(evt.type === 'join' ? 'MC: player joined' : 'MC: player left', evt.player);
      }
    });
  } else {
    collector.stopWatchingLogs();
  }

  container.innerHTML = renderInner(data);

  const statusLine = container.querySelector('[data-status-line]');
  const buttons = container.querySelectorAll('.hud-btn');

  buttons.forEach((btn) => {
    btn.addEventListener('click', async () => {
      buttons.forEach((b) => (b.disabled = true));
      const action = btn.dataset.action;
      try {
        if (action === 'files') {
          collector.openServerFiles();
        } else if (action === 'toggle') {
          statusLine.textContent = data.state === 'running' ? 'stopping...' : 'starting...';
          if (data.state === 'running') await collector.stopServer();
          else await collector.startServer();
        } else if (action === 'restart') {
          statusLine.textContent = 'restarting...';
          await collector.restartServer();
        }
        if (action !== 'files') {
          const fresh = await collector.getStatus();
          render(container, fresh);
        } else {
          buttons.forEach((b) => (b.disabled = false));
        }
      } catch (err) {
        statusLine.textContent = 'error: ' + err.message;
        buttons.forEach((b) => (b.disabled = false));
      }
    });
  });
}

module.exports = { render };
