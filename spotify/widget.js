const collector = require('./collector.js');

function fmtMs(ms) {
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, '0')}`;
}

const REPEAT_LABEL = { off: 'REPEAT', context: 'REPEAT: ALL', track: 'REPEAT: ONE' };

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  if (data.state === 'not_configured') {
    container.innerHTML = `<div class="node-empty">not configured - add Spotify credentials to .env (see spotify/README.md)</div>`;
    return;
  }
  if (data.state === 'error') {
    container.innerHTML = `<div class="node-empty">error: ${data.metrics.error}</div>`;
    return;
  }
  if (data.state === 'not_connected') {
    container.innerHTML = `
      <div class="stat-block">
        <div class="node-empty">not connected</div>
        <div class="btn-row"><button class="hud-btn" data-action="connect">CONNECT SPOTIFY</button></div>
        <div class="foot-line" data-status-line></div>
      </div>
    `;
    container.querySelector('[data-action="connect"]').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'CHECK YOUR BROWSER...';
      try {
        await collector.connectAccount();
        const fresh = await collector.getNowPlaying();
        render(container, fresh);
      } catch (err) {
        container.querySelector('[data-status-line]').textContent = 'connect failed: ' + err.message;
        btn.disabled = false;
        btn.textContent = 'CONNECT SPOTIFY';
      }
    });
    return;
  }
  if (data.state === 'idle') {
    container.innerHTML = `<div class="node-empty">nothing playing</div>`;
    return;
  }

  const m = data.metrics;
  const pct = Math.round((m.progressMs / m.durationMs) * 100);

  container.innerHTML = `
    <div class="stat-block">
      <div class="status-pill ${data.state === 'playing' ? 'status-online' : 'status-offline'}">${data.state.toUpperCase()}</div>
      <div class="row"><span class="row-label" style="width:auto;color:var(--green);">${m.track}</span></div>
      <div class="foot-line">${m.artist}</div>
      <div class="foot-line">${m.album}</div>
      <div class="meter"><div class="meter-fill" style="width:${pct}%"></div></div>
      <div class="foot-line">${fmtMs(m.progressMs)} / ${fmtMs(m.durationMs)}</div>
      <div class="btn-row">
        <button class="hud-btn" data-action="previous">◀◀</button>
        <button class="hud-btn" data-action="playpause">${data.state === 'playing' ? '❚❚' : '▶'}</button>
        <button class="hud-btn" data-action="next">▶▶</button>
      </div>
      <div class="btn-row">
        <button class="hud-btn ${m.shuffle ? 'active' : ''}" data-action="shuffle">SHUFFLE</button>
        <button class="hud-btn ${m.repeat !== 'off' ? 'active' : ''}" data-action="repeat">${REPEAT_LABEL[m.repeat] || 'REPEAT'}</button>
      </div>
      <div class="foot-line" data-status-line></div>
    </div>
  `;

  const statusLine = container.querySelector('[data-status-line]');

  async function runAction(fn) {
    try {
      await fn();
      const fresh = await collector.getNowPlaying();
      render(container, fresh);
    } catch (err) {
      statusLine.textContent = err.message;
    }
  }

  container.querySelector('[data-action="previous"]').addEventListener('click', () => runAction(collector.previous));
  container.querySelector('[data-action="next"]').addEventListener('click', () => runAction(collector.next));
  container.querySelector('[data-action="playpause"]').addEventListener('click', () =>
    runAction(data.state === 'playing' ? collector.pause : collector.play)
  );
  container.querySelector('[data-action="shuffle"]').addEventListener('click', () => runAction(() => collector.setShuffle(!m.shuffle)));
  container.querySelector('[data-action="repeat"]').addEventListener('click', () => runAction(() => collector.cycleRepeat(m.repeat)));
}

module.exports = { render };
