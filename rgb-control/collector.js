const fs = require('fs');
const path = require('path');
const { Client, utils } = require('openrgb-sdk');

const HOST = '127.0.0.1';
const PORT = 6742;
const JARVIS_ENV_PATH = path.join(__dirname, '..', '.env');

// OpenRGB's install location varies per machine (this one was a portable
// download to a versioned folder, not a fixed install path) - read from
// Jarvis's own .env (OPENRGB_EXE_PATH) instead of hardcoding one person's
// path. The LAUNCH OPENRGB button just stays hidden if it's unset - the
// SDK connection check (getStatus/setColor) doesn't need this at all, only
// the manual launch shortcut does.
function getOpenRgbExePath() {
  try {
    const content = fs.readFileSync(JARVIS_ENV_PATH, 'utf-8');
    const match = content.match(/^OPENRGB_EXE_PATH=(.+)$/m);
    return match ? match[1].trim() || null : null;
  } catch {
    return null;
  }
}

async function withClient(fn) {
  const client = new Client('Jarvis', PORT, HOST);
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.disconnect();
  }
}

async function getStatus() {
  try {
    const devices = await withClient(async (client) => {
      const count = await client.getControllerCount();
      const list = [];
      for (let i = 0; i < count; i++) {
        const data = await client.getControllerData(i);
        list.push({ id: i, name: data.name, ledCount: data.colors.length, activeMode: (data.modes[data.activeMode] || {}).name });
      }
      return list;
    });

    return { name: 'rgb-control', state: 'ok', metrics: { devices }, lastUpdated: new Date().toISOString() };
  } catch (err) {
    const notRunning = /ECONNREFUSED/.test(err.message || '');
    return {
      name: 'rgb-control',
      state: notRunning ? 'not_running' : 'error',
      metrics: { error: err.message },
      lastUpdated: new Date().toISOString(),
    };
  }
}

async function setColor(deviceId, hex) {
  await withClient(async (client) => {
    const data = await client.getControllerData(deviceId);
    const color = utils.hexColor(hex);
    const colors = Array(data.colors.length).fill(color);
    await client.updateLeds(deviceId, colors);
  });
}

function launchOpenRgb() {
  const exePath = getOpenRgbExePath();
  if (!exePath) return;
  require('electron').shell.openPath(exePath);
}

module.exports = { getStatus, setColor, launchOpenRgb, getOpenRgbExePath };
