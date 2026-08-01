const collector = require('./collector.js');

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const m = data.metrics;
  const stale = m.daysSinceChecked == null || m.daysSinceChecked >= 14;

  const history = m.history
    .map((h) => `<div class="row"><span class="row-label">${h.date}</span><span class="row-value">${h.stage}</span></div>`)
    .join('');

  container.innerHTML = `
    <div class="stat-block">
      <div class="status-pill ${stale ? 'status-offline' : 'status-online'}">${m.currentStage}</div>
      <div class="row">
        <span class="row-label">Last checked</span>
        <span class="row-value ${stale ? 'urgent' : ''}">${m.lastChecked ? m.daysSinceChecked + 'd ago' : 'never'}</span>
      </div>
      ${history ? `<div class="sub-heading">HISTORY</div>${history}` : ''}
      <div class="btn-row">
        <button class="hud-btn" data-action="open">OPEN CEAC</button>
        <button class="hud-btn" data-action="log">LOG CHECK</button>
      </div>
    </div>
  `;

  container.querySelector('[data-action="open"]').addEventListener('click', () => collector.openCeac());

  container.querySelector('[data-action="log"]').addEventListener('click', async () => {
    const stage = await window.jarvisPrompt('Current stage (leave blank to keep "' + m.currentStage + '"):', m.currentStage);
    if (stage === null) return;
    const note = (await window.jarvisPrompt('Any note? (optional)')) || '';
    collector.logCheck({ stage, note });
    const fresh = await collector.getStatus();
    render(container, fresh);
  });
}

module.exports = { render };
