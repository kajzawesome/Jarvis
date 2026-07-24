function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }

  container.innerHTML = `
    <div class="stat-block">
      ${data.metrics.zones
        .map(
          (z) => `
        <div class="row">
          <span class="row-label">${z.label}</span>
          <span class="row-value stat-hero" style="width:auto;">${z.time}</span>
        </div>
        <div class="foot-line">${z.date}</div>
      `
        )
        .join('')}
    </div>
  `;
}

module.exports = { render };
