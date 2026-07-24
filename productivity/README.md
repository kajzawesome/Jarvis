# productivity

Everything about running your last year of college and landing the first dev job — the one module that's about you, not your hardware.

## Status: 🟢 active

## What it covers

- **Deadlines** — an inline **ADD DEADLINE** form (title + due date + optional course) right on the tile, visible only in edit mode (same pattern as other editing controls — `.deadline-form` gated by `.edit-mode` in CSS). Submitting appends to `data.json`'s `deadlines` array; the list below it always shows every deadline sorted soonest-first with a day countdown (`Nd`, or `past` once it's gone by).
- **Applications** — company/role/status/date tracker, shown as a simple list. Hand-edit `data.json`'s `applications` array for now (no in-tile add form yet — could get the same treatment as deadlines if wanted later).
- **Open task count** — a live count pulled from the same shared task list [quick-capture](../quick-capture/README.md) writes into. Updating individual task status (to-do/in-progress/done) happens on the [todo](../todo/README.md) tile, not here — this is just the summary number.

## Data

`data.json` — `deadlines` (`title`, `due`, `course`), `applications` (`company`, `role`, `status`, `applied`), `tasks` (shared with quick-capture/todo — `text` + `status`).

## Why this is separate from the telemetry modules

This module isn't a "status" feed to poll — it's closer to a personal tracker/database (tasks, applications, deadlines) than a live metric. It can be built independently of the telemetry stack and doesn't need the same `{name, state, metrics, lastUpdated}` shape as much, though it still follows that contract for consistency with every other node.
