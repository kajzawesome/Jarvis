const fs = require('fs');
const path = require('path');

const LAYOUTS_PATH = path.join(__dirname, 'layouts.json');

function readLayouts() {
  if (!fs.existsSync(LAYOUTS_PATH)) {
    return { presets: { default: {} }, activePreset: 'default' };
  }
  const data = JSON.parse(fs.readFileSync(LAYOUTS_PATH, 'utf-8'));
  if (!data.presets || !Object.keys(data.presets).length) data.presets = { default: {} };
  if (!data.activePreset || !data.presets[data.activePreset]) {
    data.activePreset = Object.keys(data.presets)[0];
  }
  return data;
}

function writeLayouts(data) {
  fs.writeFileSync(LAYOUTS_PATH, JSON.stringify(data, null, 2));
}

module.exports = { readLayouts, writeLayouts, LAYOUTS_PATH };
