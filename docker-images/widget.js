const collector = require('./collector.js');

async function openLogViewer(container, containerName) {
  const panel = document.createElement('div');
  panel.className = 'app-picker';
  panel.innerHTML = `
    <div class="sub-heading">${containerName} — LOGS</div>
    <pre class="log-viewer-content">loading...</pre>
    <button class="hud-btn app-picker-close">CLOSE</button>
  `;
  container.appendChild(panel);
  panel.querySelector('.app-picker-close').addEventListener('click', () => panel.remove());

  const logs = await collector.getLogs(containerName);
  panel.querySelector('.log-viewer-content').textContent = logs;
}

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }

  if (data.state === 'daemon_down') {
    container.innerHTML = `
      <div class="stat-block">
        <div class="status-pill status-offline">DOCKER NOT RUNNING</div>
        <div class="btn-row">
          <button class="hud-btn" data-action="launch">LAUNCH DOCKER DESKTOP</button>
        </div>
      </div>
    `;
    container.querySelector('[data-action="launch"]').addEventListener('click', () => {
      collector.launchDockerDesktop();
    });
    return;
  }

  if (data.state === 'error') {
    container.innerHTML = `<div class="node-empty">error: ${data.metrics.error}</div>`;
    return;
  }

  const m = data.metrics;
  const running = m.containers.filter((c) => c.running);
  const stopped = m.containers.filter((c) => !c.running);

  container.innerHTML = `
    <div class="stat-block">
      <div class="sub-heading">CONTAINERS (${running.length} running / ${m.containers.length})</div>
      ${running
        .map(
          (c) => `<div class="row">
            <span class="row-label">${c.name}</span>
            <span class="row-value">up</span>
            <button class="hud-btn" data-logs="${c.name}" style="margin-left:4px;">LOGS</button>
          </div>`
        )
        .join('')}
      ${stopped
        .slice(0, 4)
        .map((c) => `<div class="row"><span class="row-label">${c.name}</span><span class="row-value urgent">stopped</span></div>`)
        .join('')}
      <div class="sub-heading">IMAGES (${m.images.length})</div>
      ${m.images
        .slice(0, 5)
        .map((i) => `<div class="row"><span class="row-label">${i.repo}:${i.tag}</span><span class="row-value">${i.size}</span></div>`)
        .join('')}
    </div>
  `;

  container.querySelectorAll('[data-logs]').forEach((btn) => {
    btn.addEventListener('click', () => openLogViewer(container, btn.dataset.logs));
  });
}

module.exports = { render };
