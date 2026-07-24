const collector = require('./collector.js');

function taskRow(task) {
  return `
    <div class="row todo-row">
      <span class="row-label">${task.text}</span>
      <span class="todo-status-btns">
        ${collector.STATUSES.map(
          (s) =>
            `<button class="hud-btn todo-status-btn ${task.status === s ? 'active' : ''}" data-index="${task.index}" data-status="${s}" title="${s}">${s === 'todo' ? 'T' : s === 'in_progress' ? 'P' : 'D'}</button>`
        ).join('')}
      </span>
    </div>
  `;
}

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const m = data.metrics;

  // Priority order: TO DO first (most actionable), DONE last (trimmed
  // first if the tile's too short for everything).
  const sections = [
    `<div class="sub-heading">TO DO (${m.todo.length})</div>${m.todo.map(taskRow).join('') || '<div class="foot-line">nothing queued</div>'}`,
    m.inProgress.length ? `<div class="sub-heading">IN PROGRESS (${m.inProgress.length})</div>${m.inProgress.map(taskRow).join('')}` : '',
    m.done.length ? `<div class="sub-heading">DONE (${m.done.length})</div>${m.done.map(taskRow).join('')}` : '',
  ].filter(Boolean);

  container.innerHTML = `
    <div class="stat-block">
      <div class="fit-zone">${sections.join('')}</div>
    </div>
  `;

  container.querySelectorAll('.todo-status-btn').forEach((btn) => {
    btn.addEventListener('click', async () => {
      collector.setStatus(Number(btn.dataset.index), btn.dataset.status);
      const fresh = await collector.getTasks();
      render(container, fresh);
    });
  });
}

module.exports = { render };
