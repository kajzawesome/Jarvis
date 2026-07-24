const { Client, utils } = require('openrgb-sdk');

const HOST = '127.0.0.1';
const PORT = 6742;
// Path found via the desktop-links taskbar scan - update if OpenRGB moves.
const OPENRGB_EXE =
  'C:\\Users\\USERNAME\\Downloads\\OpenRGB_0.9_Windows_64_b5f46e3\\OpenRGB Windows 64-bit\\OpenRGB.exe';

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
  require('electron').shell.openPath(OPENRGB_EXE);
}

module.exports = { getStatus, setColor, launchOpenRgb };
