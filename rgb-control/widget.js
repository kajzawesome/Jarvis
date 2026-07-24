const collector = require('./collector.js');

const PRESETS = ['#00ff9c', '#ff3b3b', '#3b8cff', '#ffdd33', '#ffffff', '#000000'];

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }

  if (data.state === 'not_running') {
    container.innerHTML = `
      <div class="stat-block">
        <div class="status-pill status-offline">OPENRGB NOT RUNNING</div>
        <div class="foot-line">also needs the SDK Server started in OpenRGB's settings</div>
        <div class="btn-row"><button class="hud-btn" data-action="launch">LAUNCH OPENRGB</button></div>
      </div>
    `;
    container.querySelector('[data-action="launch"]').addEventListener('click', () => collector.launchOpenRgb());
    return;
  }

  if (data.state === 'error') {
    container.innerHTML = `<div class="node-empty">error: ${data.metrics.error}</div>`;
    return;
  }

  const devices = data.metrics.devices || [];

  container.innerHTML = `
    <div class="stat-block">
      ${devices
        .map(
          (d) => `
        <div class="sub-heading">${d.name}</div>
        <div class="foot-line">${d.ledCount} LEDs · mode: ${d.activeMode || '?'}</div>
        <div class="btn-row" data-device="${d.id}">
          ${PRESETS.map((c) => `<button class="hud-btn rgb-swatch" data-hex="${c}" style="background:${c};width:20px;height:20px;padding:0;"></button>`).join('')}
          <input type="color" class="rgb-picker" value="#00ff9c" />
        </div>
      `
        )
        .join('') || '<div class="foot-line">no devices detected</div>'}
    </div>
  `;

  container.querySelectorAll('[data-device]').forEach((row) => {
    const deviceId = Number(row.dataset.device);
    row.querySelectorAll('.rgb-swatch').forEach((btn) => {
      btn.addEventListener('click', () => collector.setColor(deviceId, btn.dataset.hex));
    });
    row.querySelector('.rgb-picker').addEventListener('change', (e) => {
      collector.setColor(deviceId, e.target.value);
    });
  });
}

module.exports = { render };
