# dashboard

The Electron shell that renders the Jarvis HUD. See the [root README](../README.md) for the node architecture this app discovers and mounts.

## Run it

```
npm install   # from the Jarvis root, not this folder — installs deps for every node too
npm start
```

One borderless, fullscreen window opens per monitor (`fullscreen: true` — behaves like a fullscreen game/video, taskbar stays out of the way). Windows behave normally otherwise — minimize, alt-tab, drag them like any other window.

## Controls

- **`EDIT LAYOUT`** — unlock the grid on this screen: drag tiles from the left palette in, drag existing tiles around/resize them, or click a tile's `×` to remove it. Each screen's grid content is independent — arrange your left screen and main screen differently. Scrolling is disabled outright (`.grid-wrap { overflow: hidden }`) — the grid is exactly the screen size, nothing more. On top of that, dragging a new tile in or resizing an existing one bigger than what fits is actively reverted with a toast explaining why, rather than just silently clipping off-screen. This check only applies to fresh drag-ins; loading a saved preset always restores exactly what was saved, even if it no longer fits (e.g. after a resolution change).
- **layout dropdown** — switch every open screen to a saved **preset** together (presets are linked, not per-screen — see below).
- **`SAVE ALL AS...`** — snapshot what's *currently* live on every open screen (including unsaved edits) into one named preset, and sets it as the active preset. Confirmed with a toast ("Layout saved...") once it lands — the save-all round trip is otherwise silent. Since it's written to `layouts.json` and `activePreset` is what every screen reads on startup, this is also how you make a layout persist across app restarts/reboots — no separate "save on exit" step needed.
- **`AUTOSTART`** — toggle launching Jarvis automatically on Windows login.
- **`Ctrl+Alt+J`** (global) — show/hide every Jarvis window at once.
- **`_` / `X`** (top right) — minimize / hide this screen's window. Hiding (including via Alt+F4 or the taskbar) does **not** quit the app — see Tray below.
- **Tray icon** — right-click for Show/Hide All, Autostart toggle, and Quit Jarvis (the only real exit; double-click also toggles show/hide).

### How presets work

`layouts.json` stores `presets: { <name>: { "<screenIndex>": [...gridstack items] } }` plus a single `activePreset` shared by every window. Ships with two: `default` and `focus` (productivity only, full-width). Switching presets (via the dropdown, from any screen) broadcasts to all open windows so they swap together — e.g. one preset for "streaming", another for "school". Saving is a two-step round trip: the window you clicked `SAVE ALL AS...` on sends `save-all-request` to `main.js`, which asks every open window to report its live grid (`report-layout`/`layout-report` IPC), bundles the responses, writes the preset, and broadcasts `layouts-changed` so everyone re-syncs.

### Toast notifications

Call `window.jarvisToast(title, body)` from any widget's renderer-side code to pop a HUD alert. It shows locally immediately and sends `toast-broadcast` to `main.js`, which relays `show-toast` to every *other* open window so a notification triggered from one node (e.g. minecraft-server's join/leave watcher) is visible regardless of which screen you're looking at. Toasts auto-dismiss after ~6s (`.toast` animation in `style.css`).

### Moving a tile between screens

Each tile has a `SCR N` dropdown (edit mode, only rendered when `totalScreens` from the URL query is more than 1) next to its `×`. Native HTML5 drag-and-drop doesn't work between two separate `BrowserWindow`s in Electron — drag events are scoped to a single renderer, so dragging from one monitor's window and dropping on another's silently does nothing. This is the deliberate alternative, and it's a confirmed round trip so a node can't vanish:

1. Source screen sends `move-node-to-screen` (`{ nodeId, toScreen, headerHidden }`) to `main.js`.
2. `main.js` looks up `windows[toScreen]` and forwards it as `receive-moved-node`, tagging it with the source's `webContents.id`.
3. The target screen tries `addNodeToGrid()` (same no-room rejection as any other add) and reports `{ success }` back via `move-node-result`.
4. `main.js` relays that to the original source window (matched by the tagged `webContents.id`).
5. The source only removes its own copy of the tile if `success` was true; otherwise the dropdown re-enables and a toast explains the target had no room.

## Files

- `main.js` — creates one window per display (left-to-right order = screen index), the tray icon, autostart via `setLoginItemSettings`, IPC for window controls, cross-window layout sync, the save-all round trip, and the toast relay.
- `layouts-store.js` — shared read/write helpers for `layouts.json`, used by both `main.js` and `renderer/app.js`.
- `layouts.json` — the presets described above. Edited by the app itself when you save/switch; safe to hand-edit too.
- `config.json` — `{ "autostart": true|false }`.
- `assets/tray-icon.png` — the tray icon (a generated HUD-reticle graphic, not hand-drawn — swap it for anything you like, any size Windows accepts for tray icons works).
- `renderer/` — `index.html`, `style.css` (theme + ambient background + toasts), `app.js` (node discovery, gridstack wiring, layout persistence, toast function).

## Packaging (later)

Currently runs unpackaged via `electron .`. Autostart is wired to relaunch the same way (`electron.exe <Jarvis root>`). If this gets packaged into a real `.exe` with `electron-builder`, update `applyAutostart()` in `main.js` to point at the built executable instead of `process.execPath` + args.
