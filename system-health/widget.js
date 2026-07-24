function fmtUptime(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h ${m}m`;
}

const DOT_CLASS = { ok: '', warn: 'urgent', error: 'urgent', unconfigured: '' };
const LEVEL_RANK = { error: 0, warn: 1, unconfigured: 2, ok: 3 };

function render(container, data) {
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  const m = data.metrics;
  const summary =
    m.errorCount > 0
      ? `${m.errorCount} NODE${m.errorCount > 1 ? 'S' : ''} ERRORING`
      : m.warnCount > 0
        ? `${m.warnCount} NEEDS ATTENTION`
        : 'ALL SYSTEMS NOMINAL';

  // Most-actionable first, so if the tile's too short to show everything,
  // it's the "ok" rows that get trimmed, not the ones needing attention.
  const sortedNodes = [...m.nodes].sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level]);

  const rows = sortedNodes
    .map(
      (n) => `<div class="row">
        <span class="row-label">${n.label}</span>
        <span class="row-value ${DOT_CLASS[n.level]}">${n.state}</span>
      </div>`
    )
    .join('');

  container.innerHTML = `
    <div class="stat-block">
      <div class="status-pill ${m.errorCount > 0 ? 'status-offline' : 'status-online'}">${summary}</div>
      <div class="row">
        <span class="row-label">Jarvis uptime</span>
        <span class="row-value">${fmtUptime(m.uptimeSec)}</span>
      </div>
      <div class="sub-heading">NODES (${m.nodeCount})</div>
      <div class="fit-zone">${rows}</div>
    </div>
  `;
}

module.exports = { render };
