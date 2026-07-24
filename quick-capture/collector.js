const fs = require('fs');
const path = require('path');

// Deliberately writes straight into productivity's data.json rather than
// keeping its own separate inbox - a captured item shows up as a normal
// open task immediately, no separate triage step.
const PRODUCTIVITY_DATA_PATH = path.join(__dirname, '..', 'productivity', 'data.json');

function readData() {
  return JSON.parse(fs.readFileSync(PRODUCTIVITY_DATA_PATH, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(PRODUCTIVITY_DATA_PATH, JSON.stringify(data, null, 2));
}

async function getStatus() {
  const data = readData();
  const openCount = data.tasks.filter((t) => (t.status || (t.done ? 'done' : 'todo')) !== 'done').length;
  return {
    name: 'quick-capture',
    state: 'ok',
    metrics: { openCount },
    lastUpdated: new Date().toISOString(),
  };
}

function capture(text) {
  const trimmed = text.trim();
  if (!trimmed) return;
  const data = readData();
  data.tasks.push({ text: trimmed, status: 'todo' });
  writeData(data);
}

module.exports = { getStatus, capture };
