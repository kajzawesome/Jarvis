const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OK_STATES = new Set(['ok', 'running', 'live', 'offline', 'stopped']);
const WARN_STATES = new Set(['partial', 'daemon_down']);

function discoverNodeDirs() {
  return fs
    .readdirSync(ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .filter((name) => name !== 'system-health' && fs.existsSync(path.join(ROOT, name, 'node.json')));
}

async function pollNode(nodeName) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, nodeName, 'node.json'), 'utf-8'));
    const collectorMod = require(path.join(ROOT, nodeName, manifest.collector));
    const args = manifest.collectorArgs || [];
    const data = await collectorMod[manifest.collectorFn](...args);
    return { id: manifest.id, label: manifest.label, state: data.state };
  } catch (err) {
    return { id: nodeName, label: nodeName, state: 'error' };
  }
}

function classify(state) {
  if (OK_STATES.has(state)) return 'ok';
  if (WARN_STATES.has(state)) return 'warn';
  if (state === 'not_configured') return 'unconfigured';
  return 'error';
}

async function getHealth() {
  const dirs = discoverNodeDirs();
  const results = await Promise.all(dirs.map(pollNode));
  const withClass = results.map((r) => ({ ...r, level: classify(r.state) }));

  const uptimeSec = Math.floor(process.uptime());
  const errorCount = withClass.filter((r) => r.level === 'error').length;
  const warnCount = withClass.filter((r) => r.level === 'warn').length;

  return {
    name: 'system-health',
    state: 'ok',
    metrics: {
      uptimeSec,
      nodeCount: withClass.length,
      errorCount,
      warnCount,
      nodes: withClass,
    },
    lastUpdated: new Date().toISOString(),
  };
}

module.exports = { getHealth };
