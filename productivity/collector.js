const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data.json');

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

async function getData() {
  const raw = readData();

  const today = new Date();
  const deadlines = [...raw.deadlines]
    .map((d) => ({ ...d, daysLeft: Math.ceil((new Date(d.due) - today) / 86400000) }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  const openTasks = (raw.tasks || []).filter((t) => (t.status || (t.done ? 'done' : 'todo')) !== 'done');

  return {
    name: 'productivity',
    state: 'ok',
    metrics: {
      deadlines,
      applications: raw.applications,
      openTaskCount: openTasks.length,
    },
    lastUpdated: new Date().toISOString(),
  };
}

function addDeadline({ title, due, course }) {
  if (!title || !due) return;
  const data = readData();
  data.deadlines.push({ title: title.trim(), due, course: (course || '').trim() });
  writeData(data);
}

module.exports = { getData, addDeadline, DATA_PATH };
