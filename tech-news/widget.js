const { shell } = require('electron');

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">${data && data.metrics.error ? data.metrics.error : 'NO SIGNAL'}</div>`;
    return;
  }

  container.innerHTML = `
    <div class="stat-block">
      <div class="fit-zone">
        ${data.metrics.stories
          .map(
            (s, i) => `<div class="row clip-row" data-i="${i}">
              <span class="row-label">${s.title}</span>
              <span class="row-value">▲${s.score}</span>
            </div>`
          )
          .join('')}
      </div>
    </div>
  `;

  container.querySelectorAll('.clip-row').forEach((el) => {
    el.addEventListener('click', () => {
      shell.openExternal(data.metrics.stories[Number(el.dataset.i)].url);
    });
  });
}

module.exports = { render };
