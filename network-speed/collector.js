// Runs on demand only (refreshMs: 0 in node.json) rather than polling on a
// timer - a real speed test moves real bandwidth (10MB down + 5MB up per
// run), which shouldn't fire in the background while you're streaming or
// gaming. Uses Cloudflare's public speed-test endpoints (speed.cloudflare.com)
// - no CLI install, no API key.
const DOWN_BYTES = 10_000_000;
const UP_BYTES = 5_000_000;

let lastResult = null;

async function measureDownload() {
  const start = Date.now();
  const res = await fetch(`https://speed.cloudflare.com/__down?bytes=${DOWN_BYTES}`);
  const buf = await res.arrayBuffer();
  const secs = (Date.now() - start) / 1000;
  return (buf.byteLength * 8) / 1e6 / secs;
}

async function measureUpload() {
  const payload = Buffer.alloc(UP_BYTES, 'a');
  const start = Date.now();
  await fetch('https://speed.cloudflare.com/__up', { method: 'POST', body: payload });
  const secs = (Date.now() - start) / 1000;
  return (payload.length * 8) / 1e6 / secs;
}

async function runTest() {
  const [downMbps, upMbps] = await Promise.all([measureDownload(), measureUpload()]);
  lastResult = {
    downMbps: Math.round(downMbps * 10) / 10,
    upMbps: Math.round(upMbps * 10) / 10,
    testedAt: new Date().toISOString(),
  };
}

async function getStatus() {
  if (!lastResult) {
    return { name: 'network-speed', state: 'idle', metrics: {}, lastUpdated: new Date().toISOString() };
  }
  return {
    name: 'network-speed',
    state: 'ok',
    metrics: lastResult,
    lastUpdated: new Date().toISOString(),
  };
}

module.exports = { getStatus, runTest };
