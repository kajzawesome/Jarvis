const fs = require('fs');
const path = require('path');
const net = require('net');

const DATA_PATH = path.join(__dirname, 'targets.json');
const CHECK_TIMEOUT_MS = 6000;

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

function addTarget({ name, type, target, port }) {
  if (!name || !target) return;
  const data = readData();
  data.targets.push({
    name: name.trim(),
    type: type === 'tcp' ? 'tcp' : 'http',
    target: target.trim(),
    port: port ? Number(port) : null,
  });
  writeData(data);
}

function removeTarget(index) {
  const data = readData();
  data.targets.splice(index, 1);
  writeData(data);
}

async function checkHttp(url) {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    const ms = Date.now() - start;
    // A response at all means the network path + server process are up -
    // even a 4xx is "reachable." Only 5xx (server-side failure) or a
    // network-level throw (timeout/DNS/connection refused) count as down.
    return { ok: res.status < 500, responseMs: ms, detail: `HTTP ${res.status}` };
  } catch (err) {
    return { ok: false, responseMs: Date.now() - start, detail: err.name === 'AbortError' ? 'timeout' : err.message };
  }
}

function checkTcp(host, port) {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    const finish = (ok, detail) => {
      socket.destroy();
      resolve({ ok, responseMs: Date.now() - start, detail });
    };
    socket.setTimeout(CHECK_TIMEOUT_MS);
    socket.once('connect', () => finish(true, `${host}:${port} open`));
    socket.once('timeout', () => finish(false, 'timeout'));
    socket.once('error', (err) => finish(false, err.message));
    socket.connect(port, host);
  });
}

function checkTarget(t) {
  return t.type === 'tcp' ? checkTcp(t.target, t.port || 80) : checkHttp(t.target);
}

// Tracks the last known state per target (by name) so a down<->up
// transition can be toasted instead of just silently reflected in the tile.
const lastKnownUp = new Map();

async function getStatus() {
  const data = readData();
  const results = await Promise.all(
    data.targets.map(async (t, index) => {
      const result = await checkTarget(t);
      const prevUp = lastKnownUp.get(t.name);
      const changed = prevUp !== undefined && prevUp !== result.ok;
      lastKnownUp.set(t.name, result.ok);
      return { index, name: t.name, type: t.type, target: t.target, ...result, changed };
    })
  );

  return {
    name: 'down-tracker',
    state: 'ok',
    metrics: { targets: results },
    lastUpdated: new Date().toISOString(),
  };
}

module.exports = { getStatus, addTarget, removeTarget };
