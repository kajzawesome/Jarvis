function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">${data && data.metrics.error ? data.metrics.error : 'NO SIGNAL'}</div>`;
    return;
  }
  const m = data.metrics;
  const trend = m.change_pct_7d == null ? '' : m.change_pct_7d >= 0 ? '▲' : '▼';
  const trendClass = m.change_pct_7d == null ? '' : m.change_pct_7d >= 0 ? 'urgent' : '';

  container.innerHTML = `
    <div class="stat-block">
      <div class="row">
        <span class="row-label stat-hero" style="width:auto;">R$${m.rate.toFixed(3)}</span>
      </div>
      <div class="sub-heading">1 USD = ${m.rate.toFixed(4)} BRL</div>
      <div class="foot-line">1 BRL = $${m.inverse.toFixed(4)} USD</div>
      <div class="row">
        <span class="row-label">7d change</span>
        <span class="row-value ${trendClass}">${trend} ${m.change_pct_7d != null ? Math.abs(m.change_pct_7d) + '%' : '--'}</span>
      </div>
      <div class="foot-line">${m.date}</div>
    </div>
  `;
}

module.exports = { render };
