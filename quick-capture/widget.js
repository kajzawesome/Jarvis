const collector = require('./collector.js');

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }

  container.innerHTML = `
    <div class="stat-block">
      <div class="sub-heading">QUICK CAPTURE</div>
      <input class="app-picker-search" type="text" placeholder="jot a task, hit enter..." data-capture-input />
      <div class="foot-line">${data.metrics.openCount} open task(s) in productivity</div>
      <div class="foot-line" data-status-line></div>
    </div>
  `;

  const input = container.querySelector('[data-capture-input]');
  input.addEventListener('keydown', async (e) => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    collector.capture(input.value);
    input.value = '';
    const statusLine = container.querySelector('[data-status-line]');
    statusLine.textContent = 'added!';
    const fresh = await collector.getStatus();
    setTimeout(() => render(container, fresh), 700);
  });
}

module.exports = { render };
