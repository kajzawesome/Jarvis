# dashboard

The Electron shell that renders the Jarvis HUD. See the [root README](../README.md) for the node architecture this app discovers and mounts.

## Run it

```
npm install   # from the Jarvis root, not this folder — installs deps for every node too
npm start
```

One borderless, fullscreen window opens per monitor (`fullscreen: true` — behaves like a fullscreen game/video, taskbar stays out of the way). Windows behave normally otherwise — minimize, alt-tab, drag them like any other window. Works with however many monitors are connected (not hardcoded to 2), and adjusts live if you plug/unplug one while Jarvis is already running — `main.js` debounces the change and rebuilds every window from scratch, since a monitor added/removed can shift every other screen's left-to-right index.

On every launch, `main.js` also runs `desktop-links/migrate-from-desktop.ps1` once to pull in anything new on the real Windows Desktop (merge-safe — only adds new targets, respects removals) and pushes a refresh to the desktop-links tile once it lands, so it stays in sync without a manual re-run.

## Controls

- **`EDIT LAYOUT`** — unlock the grid on this screen: drag tiles from the left palette in, drag existing tiles around/resize them, or click a tile's `×` to remove it. Each screen's grid content is independent — arrange your left screen and main screen differently. Scrolling is disabled outright (`.grid-wrap` / `.node-panel-body` both `overflow: hidden`) — the grid is exactly the screen size, nothing more, and anything arranged past that edge is simply clipped. There's deliberately no JS-level reject/revert on top of that anymore — an earlier version tried reverting any add/resize that pushed the grid's *total* height over the limit, but on a grid with several tiles already placed, that check tripped on almost any resize (even a small one), which just read as "resizing is broken." The CSS guarantee alone is sufficient — freely add/resize/rearrange, worst case something gets visually clipped rather than fighting you.
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

### Prompts — use `window.jarvisPrompt`, never `window.prompt`

`window.prompt()`/`confirm()`/`alert()` are native OS dialogs — on Windows, these can render *behind* an exclusive-fullscreen window (which every Jarvis window is), making them invisible and unclickable. This looked exactly like "SAVE ALL AS... isn't doing anything." `window.jarvisPrompt(message, defaultValue?)` (defined in `app.js`, exposed globally like `jarvisToast`) is an in-DOM modal replacement — returns a Promise resolving to the entered string, `""` if confirmed blank, or `null` if cancelled (the blank/cancelled distinction matters — see `visa-status/widget.js`'s log-check flow, which treats a blank-but-confirmed stage as "keep the current one"). Every node's widget should use this instead of the native dialogs.

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
