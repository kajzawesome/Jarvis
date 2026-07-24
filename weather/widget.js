function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">${data && data.metrics.error ? data.metrics.error : 'NO SIGNAL'}</div>`;
    return;
  }
  const m = data.metrics;

  container.innerHTML = `
    <div class="stat-block">
      <div class="row">
        <span class="row-label stat-hero" style="width:auto;">${m.temp_f}&deg;F</span>
      </div>
      <div class="sub-heading">${m.condition}</div>
      <div class="row">
        <span class="row-label">Humidity</span>
        <span class="row-value">${m.humidity_pct}%</span>
      </div>
      <div class="row">
        <span class="row-label">Wind</span>
        <span class="row-value">${m.wind_mph} mph</span>
      </div>
      <div class="foot-line">${m.place}</div>
    </div>
  `;
}

module.exports = { render };
