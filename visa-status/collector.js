const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

async function getStatus() {
  const data = readData();
  const daysSinceChecked = data.lastChecked
    ? Math.floor((Date.now() - new Date(data.lastChecked)) / 86400000)
    : null;

  return {
    name: 'visa-status',
    state: 'ok',
    metrics: {
      caseType: data.caseType,
      currentStage: data.currentStage,
      lastChecked: data.lastChecked,
      daysSinceChecked,
      history: data.history.slice(-5).reverse(),
      ceacUrl: data.ceacUrl,
    },
    lastUpdated: new Date().toISOString(),
  };
}

function logCheck({ stage, note }) {
  const data = readData();
  const today = new Date().toISOString().slice(0, 10);
  data.currentStage = stage || data.currentStage;
  data.lastChecked = today;
  data.history.push({ date: today, stage: data.currentStage, note: note || '' });
  writeData(data);
}

function openCeac() {
  require('electron').shell.openExternal(readData().ceacUrl);
}

module.exports = { getStatus, logCheck, openCeac };
