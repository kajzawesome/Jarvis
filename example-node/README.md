# example-node

The starting point for building a new node — a small, real, working example (not a disabled/half-built stub) that demonstrates the full contract: `node.json` manifest, `collector.js` (data + an action function), `widget.js` (render + a button), and this README.

## Status: 🟢 active — genuinely works, safe to leave on your dashboard

Shows the current time (updates every 5s) and a click counter with a button, so you can see the whole refresh → render → action → re-render cycle live. Drag it onto the grid, resize it (the time display scales with tile size), click the button a few times.

## Using this as a template

1. **Copy the whole folder** to `Jarvis/your-node-name/`.
2. Edit **`node.json`** — change `id` (must be unique, matches the folder convention but doesn't have to match the folder name exactly), `label` (what shows in the tile header/palette), and `defaultSize`.
3. Edit **`collector.js`** — replace the body of `getData()` (or rename it — just keep `node.json`'s `collectorFn` in sync) with whatever your node actually fetches. Read `.env` for a credential? Copy the `readEnv()` pattern from `twitch/collector.js`. Need to persist your own data (not just `.env`)? Copy the `readData()`/`writeData()` JSON-file pattern from `down-tracker/collector.js`.
4. Edit **`widget.js`** — replace the HTML in `render()`. Stick to the shared classes (`.stat-block`, `.stat-hero`, `.row`, `.status-pill`, `.hud-btn`, `.btn-row`, `.fit-zone` — see [dashboard/renderer/style.css](../dashboard/renderer/style.css)) rather than hardcoding your own colors/fonts, so it matches the theme (and any future theme change) automatically.
5. Delete this README and write a real one for your node (or don't — up to you).
6. Restart Jarvis (or drag your new node in from the palette in edit mode, no restart needed if you're just iterating on an already-discovered node).

No registration step anywhere else — any top-level folder with a `node.json` is auto-discovered on launch.

See the root [README.md](../README.md)'s "Adding a new node" section for the full contract in one place, or look at a real node for a specific pattern: [pc-stats/](../pc-stats/) (simple polling), [minecraft-server/](../minecraft-server/) (action buttons + a background watcher), [twitch/](../twitch/) or [google-calendar/](../google-calendar/) (OAuth-with-a-local-callback-server), [down-tracker/](../down-tracker/) (in-tile add form + persisted JSON data).
