const collector = require('./collector.js');

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function truncate(str, n) {
  const oneLine = str.replace(/\s+/g, ' ').trim();
  return oneLine.length > n ? oneLine.slice(0, n) + '…' : oneLine;
}

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const history = data.metrics.history || [];

  if (!history.length) {
    container.innerHTML = `<div class="node-empty">clipboard history empty - copy something</div>`;
    return;
  }

  container.innerHTML = `
    <div class="stat-block">
      ${history
        .map((entry, i) => {
          if (entry.type === 'image') {
            return `<div class="row" style="align-items:center;">
              <img src="${entry.thumb}" style="width:32px;height:32px;object-fit:cover;border:1px solid var(--green-dim);" />
              <span class="row-label" style="width:auto;opacity:0.6;">(image, view only)</span>
            </div>`;
          }
          return `<div class="row clip-row" data-index="${i}" title="click to copy">
            <span class="row-label" style="width:auto;">${escapeHtml(truncate(entry.value, 42))}</span>
          </div>`;
        })
        .join('')}
    </div>
  `;

  container.querySelectorAll('.clip-row').forEach((el) => {
    el.addEventListener('click', () => {
      const entry = history[Number(el.dataset.index)];
      collector.copyToClipboard(entry.value);
      const label = el.querySelector('.row-label');
      const original = label.textContent;
      label.textContent = 'copied!';
      setTimeout(() => (label.textContent = original), 900);
    });
  });
}

module.exports = { render };
