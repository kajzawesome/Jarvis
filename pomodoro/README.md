# pomodoro

Standard 25/5 focus timer. No external dependency — pairs naturally with the `focus` preset.

## Status: 🟢 active

Ticks every second (`refreshMs: 1000` in `node.json`). Toasts when a session ends and auto-switches work↔break. State is in-memory only (`collector.js`) — resets on app restart, which is fine for a session timer. Change `WORK_SEC`/`BREAK_SEC` at the top of `collector.js` if 25/5 isn't your preferred split.
