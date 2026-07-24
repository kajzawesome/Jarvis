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
      .join('') || '<div class="foot-line">no deadlines - add one below</div>';

  const appRows =
    m.applications
      .map(
        (a) => `
      <div class="row">
        <span class="row-label">${a.company} — ${a.role}</span>
        <select class="app-status-select" data-index="${a.index}">
          ${collector.APPLICATION_STATUSES.map((s) => `<option value="${s}" ${a.status === s ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
        </select>
      </div>`
      )
      .join('') || '<div class="foot-line">no applications - add one below</div>';

  container.innerHTML = `
    <div class="stat-block">
      <div class="sub-heading">ADD DEADLINE</div>
      <div class="deadline-form">
        <input type="text" class="app-picker-search" placeholder="title" data-field="d-title" />
        <input type="date" class="app-picker-search" data-field="d-due" />
        <input type="text" class="app-picker-search" placeholder="course" data-field="d-course" style="max-width:64px;" />
        <button class="hud-btn" data-action="add-deadline">ADD</button>
      </div>
      <div class="sub-heading">DEADLINES</div>
      <div class="fit-zone">${deadlineRows}</div>

      <div class="sub-heading">ADD APPLICATION</div>
      <div class="deadline-form">
        <input type="text" class="app-picker-search" placeholder="company" data-field="a-company" />
        <input type="text" class="app-picker-search" placeholder="role" data-field="a-role" />
        <button class="hud-btn" data-action="add-application">ADD</button>
      </div>
      <div class="sub-heading">APPLICATIONS</div>
      <div class="fit-zone">${appRows}</div>

      <div class="sub-heading">OPEN TASKS (${m.openTaskCount})</div>
      <div class="foot-line">see the To Do tile to update task status</div>
    </div>
  `;

  container.querySelector('[data-action="add-deadline"]').addEventListener('click', async () => {
    const title = container.querySelector('[data-field="d-title"]').value;
    const due = container.querySelector('[data-field="d-due"]').value;
    const course = container.querySelector('[data-field="d-course"]').value;
    if (!title.trim() || !due) return;
    collector.addDeadline({ title, due, course });
    const fresh = await collector.getData();
    render(container, fresh);
  });

  container.querySelector('[data-action="add-application"]').addEventListener('click', async () => {
    const company = container.querySelector('[data-field="a-company"]').value;
    const role = container.querySelector('[data-field="a-role"]').value;
    if (!company.trim() || !role.trim()) return;
    collector.addApplication({ company, role });
    const fresh = await collector.getData();
    render(container, fresh);
  });

  container.querySelectorAll('.app-status-select').forEach((sel) => {
    sel.addEventListener('change', async (e) => {
      collector.setApplicationStatus(Number(sel.dataset.index), e.target.value);
      const fresh = await collector.getData();
      render(container, fresh);
    });
  });
}

module.exports = { render };
