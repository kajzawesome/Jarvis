const collector = require('./collector.js');

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const m = data.metrics;

  const deadlineRows =
    m.deadlines
      .map(
        (d) => `
      <div class="row">
        <span class="row-label">${d.title}${d.course ? ` (${d.course})` : ''}</span>
        <span class="row-value ${d.daysLeft <= 3 ? 'urgent' : ''}">${d.daysLeft >= 0 ? d.daysLeft + 'd' : 'past'}</span>
      </div>`
      )
      .join('') || '<div class="foot-line">no deadlines</div>';

  const apps = m.applications
    .slice(0, 4)
    .map(
      (a) => `
      <div class="row">
        <span class="row-label">${a.company}</span>
        <span class="row-value">${a.status}</span>
      </div>`
    )
    .join('') || '<div class="foot-line">no applications</div>';

  container.innerHTML = `
    <div class="stat-block">
      <div class="sub-heading">ADD DEADLINE</div>
      <div class="deadline-form">
        <input type="text" class="app-picker-search" placeholder="title" data-field="title" />
        <input type="date" class="app-picker-search" data-field="due" />
        <input type="text" class="app-picker-search" placeholder="course" data-field="course" style="max-width:64px;" />
        <button class="hud-btn" data-action="add-deadline">ADD</button>
      </div>
      <div class="sub-heading">DEADLINES</div>
      <div class="fit-zone">${deadlineRows}</div>
      <div class="sub-heading">APPLICATIONS</div>
      ${apps}
      <div class="sub-heading">OPEN TASKS (${m.openTaskCount})</div>
      <div class="foot-line">see the To Do tile to update task status</div>
    </div>
  `;

  container.querySelector('[data-action="add-deadline"]').addEventListener('click', async () => {
    const title = container.querySelector('[data-field="title"]').value;
    const due = container.querySelector('[data-field="due"]').value;
    const course = container.querySelector('[data-field="course"]').value;
    if (!title.trim() || !due) return;
    collector.addDeadline({ title, due, course });
    const fresh = await collector.getData();
    render(container, fresh);
  });
}

module.exports = { render };
