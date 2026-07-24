const collector = require('./collector.js');

function fmtWhen(event) {
  if (!event.start) return '';
  const d = new Date(event.start);
  if (event.allDay) return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
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
  container.innerHTML = `
    <div class="stat-block">
      <div class="sub-heading">UPCOMING</div>
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

module.exports = { render };
