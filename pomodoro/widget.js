const collector = require('./collector.js');

function fmt(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const m = data.metrics;

  if (m.justFinished && window.jarvisToast) {
    const finishedMode = m.mode === 'work' ? 'break' : 'work';
    window.jarvisToast(
      'Pomodoro',
      finishedMode === 'break' ? 'Work session done — take a break.' : 'Break over — back to it.'
    );
  }

  const pct = Math.round(((m.totalSec - m.remainingSec) / m.totalSec) * 100);

  container.innerHTML = `
    <div class="stat-block">
      <div class="status-pill ${m.mode === 'work' ? 'status-online' : 'status-offline'}">${m.mode.toUpperCase()}</div>
      <div class="row">
        <span class="row-label stat-hero" style="width:auto;">${fmt(m.remainingSec)}</span>
      </div>
      ${bar(pct)}
      <div class="btn-row">
        <button class="hud-btn" data-action="toggle">${m.running ? 'PAUSE' : 'START'}</button>
        <button class="hud-btn" data-action="reset">RESET</button>
        <button class="hud-btn" data-action="skip">SKIP</button>
      </div>
    </div>
  `;

  container.querySelector('[data-action="toggle"]').addEventListener('click', () => {
    m.running ? collector.pause() : collector.start();
  });
  container.querySelector('[data-action="reset"]').addEventListener('click', () => collector.reset());
  container.querySelector('[data-action="skip"]').addEventListener('click', () => collector.skip());
}

function bar(pct) {
  return `<div class="meter"><div class="meter-fill" style="width:${pct}%"></div></div>`;
}

module.exports = { render };
