const WORK_SEC = 25 * 60;
const BREAK_SEC = 5 * 60;

// In-memory only - resets on app restart, which is fine for a session timer.
const state = {
  mode: 'work', // 'work' | 'break'
  running: false,
  remainingSec: WORK_SEC,
  startedAt: null,
};

function computeRemaining() {
  if (!state.running || !state.startedAt) return state.remainingSec;
  const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
  return Math.max(0, state.remainingSec - elapsed);
}

async function getState() {
  let justFinished = false;
  if (state.running && computeRemaining() <= 0) {
    justFinished = true;
    state.running = false;
    state.mode = state.mode === 'work' ? 'break' : 'work';
    state.remainingSec = state.mode === 'work' ? WORK_SEC : BREAK_SEC;
    state.startedAt = null;
  }

  return {
    name: 'pomodoro',
    state: 'ok',
    metrics: {
      mode: state.mode,
      running: state.running,
      remainingSec: computeRemaining(),
      totalSec: state.mode === 'work' ? WORK_SEC : BREAK_SEC,
      justFinished,
    },
    lastUpdated: new Date().toISOString(),
  };
}

function start() {
  if (state.running) return;
  state.running = true;
  state.startedAt = Date.now();
}

function pause() {
  if (!state.running) return;
  state.remainingSec = computeRemaining();
  state.running = false;
  state.startedAt = null;
}

function reset() {
  state.running = false;
  state.startedAt = null;
  state.remainingSec = state.mode === 'work' ? WORK_SEC : BREAK_SEC;
}

function skip() {
  state.mode = state.mode === 'work' ? 'break' : 'work';
  state.running = false;
  state.startedAt = null;
  state.remainingSec = state.mode === 'work' ? WORK_SEC : BREAK_SEC;
}

module.exports = { getState, start, pause, reset, skip };
