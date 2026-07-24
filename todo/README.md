# todo

A kanban-style status view (TO DO / IN PROGRESS / DONE) over the same task list [quick-capture](../quick-capture/README.md) feeds into and [productivity](../productivity/README.md) summarizes.

## Status: 🟢 active

Previously this folder was `now-doing` (an active-window/foreground-app tracker) — scrapped and replaced with this at the user's request. If you want the old foreground-window behavior back, it's simple enough to re-add as a separate node (Win32 `GetForegroundWindow` via a small PowerShell script), just wasn't kept as part of this rename.

## How it works

- One shared source of truth: `productivity/data.json`'s `tasks` array. This node, `productivity`, and `quick-capture` all read/write the same file — no separate data store to keep in sync.
- Each task gets three small status buttons (T / P / D = To Do / In Progress / Done) — click any to set that task's status directly (not a cycle, an explicit set).
- Old tasks using the original `{ text, done: true|false }` shape are read fine — normalized to `status` on the fly (`done` → `done`/`todo`), and get fully migrated (the old `done` field dropped) the first time you touch their status.
- Sections are ordered TO DO → IN PROGRESS → DONE (most actionable first) — if the tile's too short to show everything, DONE items are the first to get trimmed (see the root README's note on `.fit-zone` auto-fit behavior), not the active work.
