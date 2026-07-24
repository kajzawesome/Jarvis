function bar(pct) {
  const p = Math.max(0, Math.min(100, pct || 0));
  return `<div class="meter"><div class="meter-fill" style="width:${p}%"></div></div>`;
}

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const m = data.metrics;
  const disks = (m.disks || [])
    .map(
      (d) => `
      <div class="row">
        <span class="row-label">${d.mount}</span>
        ${bar(d.used_pct)}
        <span class="row-value">${d.used_pct}%</span>
      </div>`
    )
    .join('');

  container.innerHTML = `
    <div class="stat-block">
      <div class="row">
        <span class="row-label">CPU</span>
        ${bar(m.cpu_pct)}
        <span class="row-value">${m.cpu_pct}%</span>
      </div>
      <div class="row">
        <span class="row-label">RAM</span>
        ${bar(m.ram_pct)}
        <span class="row-value">${m.ram_used_gb}/${m.ram_total_gb}GB</span>
      </div>
      ${
        m.gpu
          ? `<div class="row">
              <span class="row-label">GPU</span>
              ${bar(m.gpu.utilization_pct)}
              <span class="row-value">${m.gpu.utilization_pct ?? '--'}%</span>
            </div>`
          : ''
      }
      <div class="sub-heading">TEMPS / FANS</div>
      <div class="row">
        <span class="row-label">CPU TEMP</span>
        <span class="row-value">${m.cpu_temp_c != null ? m.cpu_temp_c + '&deg;C' : '--'}</span>
      </div>
      <div class="row">
        <span class="row-label">CPU FAN</span>
        <span class="row-value">${m.cpu_fan_rpm != null ? m.cpu_fan_rpm + ' RPM' : '--'}</span>
      </div>
      ${
        m.gpu
          ? `<div class="row">
              <span class="row-label">GPU TEMP</span>
              <span class="row-value">${m.gpu.temp_c != null ? m.gpu.temp_c + '&deg;C' : '--'}</span>
            </div>
            <div class="row">
              <span class="row-label">GPU FAN</span>
              <span class="row-value">${m.gpu.fan_pct != null ? m.gpu.fan_pct + '%' : '--'}</span>
            </div>
            <div class="row">
              <span class="row-label">GPU PWR</span>
              <span class="row-value">${m.gpu.power_draw_w != null ? Math.round(m.gpu.power_draw_w) + 'W' : '--'}</span>
            </div>`
          : ''
      }
      ${!m.sensors_available ? '<div class="foot-line">install LibreHardwareMonitor for CPU temp/fan</div>' : ''}
      <div class="sub-heading">DISKS</div>
      ${disks}
      <div class="foot-line">${m.cpu_model || ''}</div>
      <div class="foot-line">UPTIME ${Math.floor(m.uptime_s / 3600)}h ${Math.floor((m.uptime_s % 3600) / 60)}m</div>
    </div>
  `;
}

module.exports = { render };
