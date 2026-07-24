const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');
const WS_URL = 'ws://127.0.0.1:59650/api/websocket';
const REQUEST_TIMEOUT_MS = 4000;
const STREAMLABS_EXE = 'C:\\Program Files\\Streamlabs OBS\\Streamlabs OBS.exe';

function readEnv() {
  const env = {};
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    });
  } catch {
    // no .env yet - treated as not configured below
  }
  return env;
}

// Streamlabs Desktop's Remote Control API (JSON-RPC 2.0 over WebSocket,
// same protocol the mobile remote-control app uses) - written from the
// documented protocol shape but not yet live-tested against a running
// instance. If method/resource names differ from what's here, adjust based
// on what Settings > Remote Control's docs / the response payloads show.
let idCounter = 1;

function callApi(token, calls) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocket(WS_URL);
    } catch (err) {
      reject(new Error('could not open websocket - is Streamlabs Desktop running with Remote Control enabled?'));
      return;
    }

    const results = {};
    const received = new Set();
    let authed = false;
    const timeout = setTimeout(() => {
      ws.close();
      reject(new Error('timed out talking to Streamlabs (is it running with Remote Control enabled?)'));
    }, REQUEST_TIMEOUT_MS);

    ws.addEventListener('open', () => {
      ws.send(JSON.stringify({ jsonrpc: '2.0', id: idCounter++, method: 'auth', params: { resource: 'TcpServerService', args: [token] } }));
    });

    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (!authed) {
        authed = true;
        calls.forEach((call) => {
          ws.send(JSON.stringify({ jsonrpc: '2.0', id: call.id, method: call.method, params: { resource: call.resource, args: call.args || [] } }));
        });
        return;
      }
      const call = calls.find((c) => c.id === msg.id);
      if (call) {
        results[call.key] = msg.result;
        received.add(call.id);
        if (calls.every((c) => received.has(c.id))) {
          clearTimeout(timeout);
          ws.close();
          resolve(results);
        }
      }
    });

    ws.addEventListener('error', () => {
      clearTimeout(timeout);
      reject(new Error('websocket error - is Streamlabs Desktop running with Remote Control enabled?'));
    });
  });
}

async function getStatus() {
  const env = readEnv();
  const token = env.STREAMLABS_API_TOKEN;

  if (!token) {
    return { name: 'streamlabs', state: 'not_configured', metrics: {}, lastUpdated: new Date().toISOString() };
  }

  try {
    const results = await callApi(token, [
      { key: 'streaming', id: idCounter++, method: 'getModel', resource: 'StreamingService' },
    ]);

    const model = results.streaming && results.streaming.result;
    const streaming = model && model.streamingStatus && model.streamingStatus !== 'offline';
    const recording = model && model.recordingStatus && model.recordingStatus !== 'offline';

    return {
      name: 'streamlabs',
      state: 'ok',
      metrics: { streaming: !!streaming, recording: !!recording },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    const notRunning = /websocket|timed out/i.test(err.message || '');
    return {
      name: 'streamlabs',
      state: notRunning ? 'not_running' : 'error',
      metrics: { error: err.message },
      lastUpdated: new Date().toISOString(),
    };
  }
}

function launchStreamlabs() {
  require('electron').shell.openPath(STREAMLABS_EXE);
}

async function toggleStreaming() {
  const { STREAMLABS_API_TOKEN: token } = readEnv();
  if (!token) throw new Error('not configured');
  await callApi(token, [{ key: 'toggle', id: idCounter++, method: 'toggleStreaming', resource: 'StreamingService' }]);
}

async function toggleRecording() {
  const { STREAMLABS_API_TOKEN: token } = readEnv();
  if (!token) throw new Error('not configured');
  await callApi(token, [{ key: 'toggle', id: idCounter++, method: 'toggleRecording', resource: 'StreamingService' }]);
}

module.exports = { getStatus, toggleStreaming, toggleRecording, launchStreamlabs };
