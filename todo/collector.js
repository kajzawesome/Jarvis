const fs = require('fs');
const path = require('path');

// Shares the same task list quick-capture writes into and productivity
// summarizes - one source of truth in productivity/data.json, this node is
// just a status-focused (kanban-style) view onto the same `tasks` array.
const DATA_PATH = path.join(__dirname, '..', 'productivity', 'data.json');
const STATUSES = ['todo', 'in_progress', 'done'];

function readData() {
  return JSON.parse(fs.readFileSync(DATA_PATH, 'utf-8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2));
}

// Older tasks only have a `done` boolean - normalize to `status` on read,
// without needing a one-time migration script.
function normalize(task) {
  if (task.status && STATUSES.includes(task.status)) return task;
  return { ...task, status: task.done ? 'done' : 'todo' };
}

// Tasks carry their real index into data.tasks (not just their position
// within a status group) so setStatus() can update the right one even
// after filtering/regrouping, and so duplicate-text tasks don't collide.
async function getTasks() {
  const data = readData();
  const tasks = (data.tasks || []).map((t, index) => ({ ...normalize(t), index }));
  return {
    name: 'todo',
    state: 'ok',
    metrics: {
      todo: tasks.filter((t) => t.status === 'todo'),
      inProgress: tasks.filter((t) => t.status === 'in_progress'),
      done: tasks.filter((t) => t.status === 'done'),
    },
    lastUpdated: new Date().toISOString(),
  };
}

function setStatus(index, status) {
  if (!STATUSES.includes(status)) return;
  const data = readData();
  const tasks = (data.tasks || []).map(normalize);
  if (!tasks[index]) return;
  tasks[index].status = status;
  delete tasks[index].done; // fully migrated once touched
  data.tasks = tasks;
  writeData(data);
}

module.exports = { getTasks, setStatus, STATUSES };
