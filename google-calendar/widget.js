const collector = require('./collector.js');

const VIEW_KEY = 'jarvis-google-calendar-view';
const VIEWS = ['list', 'day', 'week', 'month'];

function getView() {
  const saved = localStorage.getItem(VIEW_KEY);
  return VIEWS.includes(saved) ? saved : 'list';
}

function setView(mode) {
  localStorage.setItem(VIEW_KEY, mode);
}

// Which day DAY view is currently showing, as an offset from today (0 =
// today). Deliberately not persisted (localStorage) like the view mode is -
// this is a transient "I'm browsing forward a bit" state, and should land
// back on today next time you open the tile, not wherever you last paged
// to. A module-level variable is enough since this module is require()'d
// once per renderer and stays cached across refresh() calls.
let dayOffset = 0;

function fmtWhen(event) {
  if (!event.start) return '';
  const d = new Date(event.start);
  if (event.allDay) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function fmtTime(event) {
  if (event.allDay) return 'ALL DAY';
  return new Date(event.start).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

// Google's all-day "date" field is a bare "YYYY-MM-DD" - `new Date(str)`
// parses that as UTC midnight, which can land on the wrong local calendar
// day depending on timezone (a classic off-by-one). Parsed as local
// year/month/day components instead for correct day-bucketing below.
function eventDateKey(event) {
  if (event.allDay) return event.start; // already "YYYY-MM-DD", no shift needed
  const d = new Date(event.start);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function groupByDay(events) {
  const map = {};
  events.forEach((e) => {
    const key = eventDateKey(e);
    (map[key] = map[key] || []).push(e);
  });
  return map;
}

function renderList(events) {
  return `
    <div class="sub-heading">UPCOMING</div>
    <div class="fit-zone">
      ${
        events
          .map(
            (e) => `<div class="row">
              <span class="row-label" style="width:auto;flex:1;">${e.title}</span>
              <span class="row-value">${fmtWhen(e)}</span>
            </div>`
          )
          .join('') || '<div class="foot-line">nothing upcoming</div>'
      }
    </div>
  `;
}

function renderDay(events) {
  const day = new Date();
  day.setDate(day.getDate() + dayOffset);
  const dayEvents = (groupByDay(events)[dateKey(day)] || []).slice();

  return `
    <div class="cal-day-nav">
      <button class="hud-btn cal-day-nav-btn" data-day-nav="-1" title="previous day">‹</button>
      <span class="cal-day-label">${day.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}${dayOffset === 0 ? ' · TODAY' : ''}</span>
      <button class="hud-btn cal-day-nav-btn" data-day-nav="1" title="next day">›</button>
    </div>
    <div class="fit-zone">
      ${
        dayEvents
          .map(
            (e) => `<div class="row">
              <span class="row-label" style="width:auto;flex:1;">${e.title}</span>
              <span class="row-value">${fmtTime(e)}</span>
            </div>`
          )
          .join('') || '<div class="foot-line">nothing scheduled</div>'
      }
    </div>
  `;
}

function renderWeek(events) {
  const byDay = groupByDay(events);
  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    return { date: d, key: dateKey(d), isToday: dateKey(d) === dateKey(today) };
  });

  return `
    <div class="cal-week-grid">
      ${days
        .map((day) => {
          const dayEvents = byDay[day.key] || [];
          return `
            <div class="cal-week-day${day.isToday ? ' today' : ''}">
              <div class="cal-week-day-head">
                <span class="cal-week-day-name">${day.date.toLocaleDateString([], { weekday: 'short' })}</span>
                <span class="cal-week-day-num">${day.date.getDate()}</span>
              </div>
              <div class="cal-week-events">
                ${dayEvents
                  .map((e) => `<div class="cal-event-chip" title="${e.title}">${fmtTime(e)} ${e.title}</div>`)
                  .join('')}
              </div>
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function renderMonth(events) {
  const byDay = groupByDay(events);
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  const firstOfMonth = new Date(year, month, 1);
  const startDow = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells = [];
  for (let i = startDow - 1; i >= 0; i--) {
    cells.push({ date: new Date(year, month - 1, prevMonthDays - i), inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const next = new Date(last);
    next.setDate(next.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }

  const todayKey = dateKey(today);
  const dow = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return `
    <div class="cal-month-label">${firstOfMonth.toLocaleDateString([], { month: 'long', year: 'numeric' })}</div>
    <div class="cal-month-grid">
      ${dow.map((d) => `<div class="cal-month-dow">${d}</div>`).join('')}
      ${cells
        .map((cell) => {
          const key = dateKey(cell.date);
          const dayEvents = byDay[key] || [];
          const classes = ['cal-month-day'];
          if (key === todayKey) classes.push('today');
          if (!cell.inMonth) classes.push('outside');
          const titles = dayEvents.map((e) => e.title).join(', ');
          return `
            <div class="${classes.join(' ')}" ${titles ? `title="${titles}"` : ''}>
              <span class="cal-month-day-num">${cell.date.getDate()}</span>
              ${dayEvents.length ? `<span class="cal-month-day-dot">${dayEvents.length}</span>` : ''}
            </div>
          `;
        })
        .join('')}
    </div>
  `;
}

function toDateInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// In-DOM modal, not window.prompt() - native dialogs are avoided project-
// wide (see dashboard/README.md's "Prompts" section), and this needs
// multiple fields anyway, which window.jarvisPrompt (single text field)
// can't do. Defaults the date to whatever day is currently in view (DAY
// view's dayOffset if that's the active view, otherwise today).
function openAddEventModal(container) {
  const defaultDate = new Date();
  defaultDate.setDate(defaultDate.getDate() + (getView() === 'day' ? dayOffset : 0));

  const overlay = document.createElement('div');
  overlay.className = 'jarvis-modal-overlay';
  overlay.innerHTML = `
    <div class="jarvis-modal cal-add-modal">
      <div class="jarvis-modal-message">ADD EVENT</div>
      <input type="text" class="app-picker-search jarvis-modal-input" data-field="title" placeholder="Title" />
      <div class="cal-add-modal-row">
        <input type="date" class="app-picker-search jarvis-modal-input" data-field="date" value="${toDateInputValue(defaultDate)}" />
        <input type="time" class="app-picker-search jarvis-modal-input" data-field="time" value="12:00" />
      </div>
      <label class="cal-add-modal-allday">
        <input type="checkbox" data-field="allDay" /> All day
      </label>
      <div class="cal-add-modal-error" data-error></div>
      <div class="btn-row">
        <button class="hud-btn" data-action="cancel">CANCEL</button>
        <button class="hud-btn" data-action="add">ADD</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const titleInput = overlay.querySelector('[data-field="title"]');
  const timeInput = overlay.querySelector('[data-field="time"]');
  const allDayInput = overlay.querySelector('[data-field="allDay"]');
  const errorEl = overlay.querySelector('[data-error]');
  titleInput.focus();

  allDayInput.addEventListener('change', () => {
    timeInput.disabled = allDayInput.checked;
  });

  function close() {
    overlay.remove();
  }
  overlay.querySelector('[data-action="cancel"]').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  overlay.querySelector('[data-action="add"]').addEventListener('click', async () => {
    const title = titleInput.value.trim();
    const date = overlay.querySelector('[data-field="date"]').value;
    const allDay = allDayInput.checked;
    const time = timeInput.value;
    if (!title || !date || (!allDay && !time)) {
      errorEl.textContent = 'title and date are required';
      return;
    }
    const addBtn = overlay.querySelector('[data-action="add"]');
    addBtn.disabled = true;
    addBtn.textContent = 'ADDING...';
    try {
      await collector.addEvent({ title, date, time, allDay });
      close();
      const fresh = await collector.getEvents();
      render(container, fresh);
      if (window.jarvisToast) window.jarvisToast('Event added', `"${title}" added to your calendar.`);
    } catch (err) {
      errorEl.textContent = err.message;
      addBtn.disabled = false;
      addBtn.textContent = 'ADD';
    }
  });
}

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  if (data.state === 'not_configured') {
    container.innerHTML = `<div class="node-empty">not configured - add Google credentials to .env (see google-calendar/README.md)</div>`;
    return;
  }
  if (data.state === 'error') {
    container.innerHTML = `<div class="node-empty">error: ${data.metrics.error}</div>`;
    return;
  }
  if (data.state === 'not_connected') {
    container.innerHTML = `
      <div class="stat-block">
        <div class="node-empty">not connected</div>
        <div class="btn-row"><button class="hud-btn" data-action="connect">CONNECT GOOGLE CALENDAR</button></div>
        <div class="foot-line" data-status-line></div>
      </div>
    `;
    container.querySelector('[data-action="connect"]').addEventListener('click', async (e) => {
      const btn = e.target;
      btn.disabled = true;
      btn.textContent = 'CHECK YOUR BROWSER...';
      try {
        await collector.connectAccount();
        const fresh = await collector.getEvents();
        render(container, fresh);
      } catch (err) {
        container.querySelector('[data-status-line]').textContent = 'connect failed: ' + err.message;
        btn.disabled = false;
        btn.textContent = 'CONNECT GOOGLE CALENDAR';
      }
    });
    return;
  }

  const events = data.metrics.events || [];
  const view = getView();
  const body =
    view === 'day' ? renderDay(events) : view === 'week' ? renderWeek(events) : view === 'month' ? renderMonth(events) : renderList(events);

  container.innerHTML = `
    <div class="stat-block cal-block">
      <div class="cal-view-toggle">
        ${VIEWS.map((v) => `<button class="cal-view-btn${v === view ? ' active' : ''}" data-view="${v}">${v.toUpperCase()}</button>`).join('')}
        <button class="hud-btn cal-add-btn" data-action="add-event" title="Add event">+</button>
      </div>
      ${body}
    </div>
  `;

  container.querySelectorAll('[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      setView(btn.dataset.view);
      render(container, data);
    });
  });

  container.querySelector('[data-action="add-event"]').addEventListener('click', () => openAddEventModal(container));

  const prevDayBtn = container.querySelector('[data-day-nav="-1"]');
  if (prevDayBtn) {
    prevDayBtn.addEventListener('click', () => {
      // No point paging before today - the API never returns past events,
      // so anything before today would just always show "nothing scheduled".
      dayOffset = Math.max(0, dayOffset - 1);
      render(container, data);
    });
  }
  const nextDayBtn = container.querySelector('[data-day-nav="1"]');
  if (nextDayBtn) {
    nextDayBtn.addEventListener('click', () => {
      dayOffset += 1;
      render(container, data);
    });
  }
}

module.exports = { render };
