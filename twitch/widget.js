const collector = require('./collector.js');

function statBlock(data) {
  const m = data.metrics;
  const connectBtn = !m.connected
    ? `<button class="hud-btn" data-action="connect">CONNECT FOR FOLLOWERS/SUBS</button>`
    : '';

  const followRows =
    m.followers != null || m.subs != null
      ? `
      ${m.followers != null ? `<div class="row"><span class="row-label">Followers</span><span class="row-value">${m.followers}</span></div>` : ''}
      ${m.subs != null ? `<div class="row"><span class="row-label">Subs</span><span class="row-value">${m.subs}</span></div>` : ''}
    `
      : '';

  if (data.state === 'live') {
    return `
      <div class="stat-block">
        <div class="status-pill status-online">LIVE</div>
        <div class="row">
          <span class="row-label">Viewers</span>
          <span class="row-value">${m.viewers}</span>
        </div>
        ${followRows}
        <div class="sub-heading">${m.category || ''}</div>
        <div class="foot-line">${m.title || ''}</div>
        <div class="btn-row">${connectBtn}</div>
        <div class="foot-line" data-status-line></div>
      </div>
    `;
  }

  return `
    <div class="stat-block">
      <div class="status-pill status-offline">OFFLINE</div>
      ${followRows}
      <div class="foot-line">${m.channel}</div>
      <div class="btn-row">${connectBtn}</div>
      <div class="foot-line" data-status-line></div>
    </div>
  `;
}

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  if (data.state === 'not_configured') {
    container.innerHTML = `<div class="node-empty">not configured - add Twitch credentials to .env (see twitch/README.md)</div>`;
    return;
  }
  if (data.state === 'error') {
    container.innerHTML = `<div class="node-empty">error: ${data.metrics.error}</div>`;
    return;
  }

  container.innerHTML = statBlock(data);

  const connectBtn = container.querySelector('[data-action="connect"]');
  if (connectBtn) {
    connectBtn.addEventListener('click', async () => {
      connectBtn.disabled = true;
      connectBtn.textContent = 'CHECK YOUR BROWSER...';
      const statusLine = container.querySelector('[data-status-line]');
      try {
        await collector.connectUserAuth();
        const fresh = await collector.getStreamStatus();
        render(container, fresh);
      } catch (err) {
        if (statusLine) statusLine.textContent = 'connect failed: ' + err.message;
        connectBtn.disabled = false;
        connectBtn.textContent = 'CONNECT FOR FOLLOWERS/SUBS';
      }
    });
  }
}

module.exports = { render };
