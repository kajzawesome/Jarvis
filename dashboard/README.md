# dashboard

The Electron shell that renders the Jarvis HUD. See the [root README](../README.md) for the node architecture this app discovers and mounts.

## Run it

```
npm install   # from the Jarvis root, not this folder — installs deps for every node too
npm start
```

Or, for a double-clickable launcher instead of a terminal: run `dashboard\create-desktop-shortcut.ps1` once (`powershell -ExecutionPolicy Bypass -File dashboard\create-desktop-shortcut.ps1`) — creates a "Jarvis" shortcut on your Desktop pointed at the same `electron.exe <Jarvis root>` command autostart already uses, with the tray icon as its shortcut icon (converted from `assets/tray-icon.png` to a `.ico`, since Windows shortcuts need one). Re-run any time to recreate it; pin it to Start/taskbar like any other shortcut if you want it somewhere more permanent.

One borderless window opens per monitor, sized to fill it. Deliberately **not** `fullscreen: true` — on Windows that's exclusive fullscreen (the same mode a game/video player uses), which suppresses the OS taskbar entirely: no hover, no click, nothing gets through until the app exits fullscreen. A plain borderless window sized to the display doesn't do that — confirmed live (`GetWindowRect` on the real window) that Windows keeps its actual bottom edge at the work-area boundary, just above the taskbar, so the taskbar stays reachable without needing `Ctrl+Alt+J` to hide Jarvis first. Windows behave normally otherwise — minimize, alt-tab, drag them like any other window. Works with however many monitors are connected (not hardcoded to 2), and adjusts live if you plug/unplug one while Jarvis is already running — `main.js` debounces the change and rebuilds every window from scratch, since a monitor added/removed can shift every other screen's left-to-right index.

On every launch, `main.js` also runs `desktop-links/migrate-from-desktop.ps1` once to pull in anything new on the real Windows Desktop (merge-safe — only adds new targets, respects removals) and pushes a refresh to the desktop-links tile once it lands, so it stays in sync without a manual re-run.

## Controls

- **`EDIT LAYOUT`** — unlock the grid on this screen: drag tiles from the left palette in, drag existing tiles around/resize them, or click a tile's `×` to remove it. Each screen's grid content is independent — arrange your left screen and main screen differently. Scrolling is disabled outright (`.grid-wrap` / `.node-panel-body` both `overflow: hidden`) — the grid is exactly the screen size, nothing more, and anything arranged past that edge is simply clipped.
- **New tiles land in an actual empty gap** — dragging a node in from the palette (or moving one in from another screen) does a bounds-checked scan for the first visible slot it actually fits in (`findVisibleSlot()` in `app.js`), not just GridStack's own unbounded auto-position (which has no concept of "visible" and would happily place something below the fold). If nothing on-screen fits, the add is rejected with a toast rather than silently landing somewhere invisible.
- **Live dashed-outline preview while dragging** — as you drag a palette item over the grid, a dashed box shows exactly where it'll land (sized to its `defaultSize`), green if that spot's actually free and red if it isn't. Computed manually from the cursor position (`computeDragCell()`) rather than through GridStack's own external-drag API, since that would've meant replacing the app's native HTML5 drag-and-drop entirely just for the preview - this bolts on top of the existing dragover/drop handlers instead. Dropping lands exactly on the previewed spot when it's valid; falls back to the normal auto-slot search otherwise (same as before this existed).
- **Off-screen/cut-off tiles are only ever warned about, never auto-deleted** — `pruneOffscreenItems()` checks every tile against the currently-visible row/column bounds and toasts a warning about anything that's (even partially) cut off, on load and right before a save. It does **not** remove them, and never rewrites `layouts.json` on its own — whatever you arrange, on- or off-screen, is exactly what gets saved. An earlier version of this actually deleted off-screen tiles (the reasoning: an off-screen tile's own `×` is off-screen too, so it looked unremovable) — but that meant the app was silently deleting arranged content on load/save, which read as broken even on the (verified, correct) occasions the bounds math was right. Got reported as broken three separate times before the fix was to stop deleting entirely, not to tune the deletion logic further.
- **Every placed tile has a `×` in the palette list too, not just on the grid** — this is the actual fix for "off-screen = unremovable": in edit mode, the left palette shows every node with a small `×` next to the ones currently placed on this screen (`removeNodeFromGrid()`, shared with the on-tile close button). It's looked up by node id, not by finding something visible to click, so it works exactly the same whether the tile is front-and-center or scrolled off past the fold. This is now the reliable way to get rid of an off-screen tile — drag it back into view if you want to keep it, or `×` it from the palette if you don't.
- **layout dropdown** — switch every open screen to a saved **preset** together (presets are linked, not per-screen — see below).
- **`SAVE ALL AS...`** — snapshot what's *currently* live on every open screen (including unsaved edits) into a **new** named preset (prompts for a name), and sets it as the active preset. Confirmed with a toast ("Layout saved...") once it lands. Since it's written to `layouts.json` and `activePreset` is what every screen reads on startup, this is also how you make a layout persist across app restarts/reboots.
- **`UPDATE "<preset>"`** — re-saves the *currently active* preset in place, under its exact existing name, no prompt. Same round trip as `SAVE ALL AS...`, just skipped the naming step — use this for "I tweaked the layout, keep it as this preset" instead of retyping the name into `SAVE ALL AS...` (retyping it even slightly wrong, e.g. a typo, creates a whole separate near-duplicate preset instead of updating the one you meant).
- **`DELETE PRESET`** — permanently deletes the currently active preset (retype its name to confirm — same in-DOM-modal confirmation pattern as everywhere else, not a native `confirm()`). Disabled when only one preset remains, since there always has to be at least one. If the deleted preset was active, falls back to `default` if it still exists, otherwise whatever's left.
- **`AUTOSTART`** — toggle launching Jarvis automatically on Windows login.
- **`REDUCE MOTION`** — turns off the ambient background's 3 CSS animations (drifting grid, scan sweep, pulse glow) — the one always-running visual cost in the app. Global, not per-screen: toggling it anywhere applies to every open window immediately (`reduce-motion-changed` broadcast from `main.js`, same pattern as `layouts-changed`) and persists in `dashboard/config.json`. Off by default so existing installs aren't silently changed; worth turning on for a laptop or integrated GPU.
- **`THEME` dropdown + `DARK MODE`/`LIGHT MODE` button** — two independent settings, both global/broadcast/persisted the same way as `REDUCE MOTION` (`theme-changed`/`mode-changed` events, `dashboard/config.json`). `THEME` picks one of 9 accent colors; the mode button flips the page background/text between dark and light *without* changing which accent is active. `ACCENTS` (one base hex per preset) + `MODES` (dark/light base colors + which direction accent shades should mix) + `applyTheme(accent, mode)` in `renderer/app.js` compute the actual `--green`/`--green-dim`/`--green-faint`/`--green-rgb`/`--glow`/`--bg`/`--bg-panel`/`--bg-panel-solid`/`--white` custom properties at runtime via RGB lerping (`mixHex()`) — no per-combination stylesheet, so a new accent or mode is one table entry, not a hand-tuned palette. `--green-rgb` (comma-separated components) exists specifically so the ambient background's `rgba()` gradients can stay theme-aware too (`rgba()` can't take a hex + separate alpha directly).
- **`Ctrl+Alt+J`** (global) — show/hide every Jarvis window at once.
- **`_` / `X`** (top right) — minimize / hide this screen's window. Hiding (including via Alt+F4 or the taskbar) does **not** quit the app — see Tray below.
- **Tray icon** — right-click for Show/Hide All, Autostart toggle, and Quit Jarvis (the only real exit; double-click also toggles show/hide).

### How presets work

`layouts.json` stores `presets: { <name>: { "<screenIndex>": [...gridstack items] } }` plus a single `activePreset` shared by every window. Ships with two: `default` and `focus` (productivity only, full-width). Switching presets (via the dropdown, from any screen) broadcasts to all open windows so they swap together — e.g. one preset for "streaming", another for "school". Saving is a two-step round trip: the window you clicked `SAVE ALL AS...` on sends `save-all-request` to `main.js`, which asks every open window to report its live grid (`report-layout`/`layout-report` IPC), bundles the responses, writes the preset, and broadcasts `layouts-changed` so everyone re-syncs.

### Toast notifications

Call `window.jarvisToast(title, body)` from any widget's renderer-side code to pop a HUD alert. It shows locally immediately and sends `toast-broadcast` to `main.js`, which relays `show-toast` to every *other* open window so a notification triggered from one node (e.g. minecraft-server's join/leave watcher) is visible regardless of which screen you're looking at. Toasts auto-dismiss after ~6s (`.toast` animation in `style.css`).

### Prompts — use `window.jarvisPrompt`, never `window.prompt`

`window.prompt()`/`confirm()`/`alert()` are native OS dialogs — on Windows, these could render *behind* Jarvis windows back when they used `fullscreen: true` (exclusive fullscreen suppresses native OS dialogs the same way it suppresses the taskbar), making them invisible and unclickable. This looked exactly like "SAVE ALL AS... isn't doing anything." `window.jarvisPrompt(message, defaultValue?)` (defined in `app.js`, exposed globally like `jarvisToast`) is an in-DOM modal replacement — returns a Promise resolving to the entered string, `""` if confirmed blank, or `null` if cancelled (the blank/cancelled distinction matters — see `visa-status/widget.js`'s log-check flow, which treats a blank-but-confirmed stage as "keep the current one"). Every node's widget should use this instead of the native dialogs — `fullscreen: true` is gone now, but there's no reason to reintroduce native dialogs' other quirks (blocking, inconsistent styling) when this already works.

### Moving a tile between screens

Each tile has a `SCR N` dropdown (edit mode, only rendered when `totalScreens` from the URL query is more than 1) next to its `×`. Native HTML5 drag-and-drop doesn't work between two separate `BrowserWindow`s in Electron — drag events are scoped to a single renderer, so dragging from one monitor's window and dropping on another's silently does nothing. This is the deliberate alternative, and it's a confirmed round trip so a node can't vanish:

1. Source screen sends `move-node-to-screen` (`{ nodeId, toScreen, headerHidden }`) to `main.js`.
2. `main.js` looks up `windows[toScreen]` and forwards it as `receive-moved-node`, tagging it with the source's `webContents.id`.
3. The target screen tries `addNodeToGrid()` (same no-room rejection as any other add) and reports `{ success }` back via `move-node-result`.
4. `main.js` relays that to the original source window (matched by the tagged `webContents.id`).
5. The source only removes its own copy of the tile if `success` was true; otherwise the dropdown re-enables and a toast explains the target had no room.

### Performance — hide it while gaming, it actually goes quiet now

Hiding or minimizing a Jarvis window (the `X` button, `Ctrl+Alt+J`, the tray's Show/Hide All, or just minimizing normally) now genuinely pauses that screen's background work — every node's refresh timer stops the moment `document.visibilityState` goes `'hidden'` (confirmed live: both an explicit `hide()` and a plain OS minimize fire this), and resumes with one immediate catch-up refresh the moment it's visible again. Before this, Electron kept every node's `setInterval` running at full speed even while hidden (Electron only stops *rendering* a hidden window, not its JS) — several nodes shell out to a real process on every refresh (PowerShell/WMI queries, `nvidia-smi`, `docker inspect`), which is genuine background CPU/process-spawn load competing with, say, a game that wants that CPU.

If Jarvis is dragging on system performance (especially while gaming), the answer isn't to quit it — just hide it. The tray icon (usually tucked under Windows' taskbar "hidden icons" chevron unless you've dragged it out) is exactly how you bring it back: double-click it, or right-click → Show/Hide All. Every timer/watcher resumes automatically once it's visible again, no manual "reconnect" step.

`pc-stats` also got a direct optimization on top of this: it was spawning a fresh `nvidia-smi` process *and* a fresh `powershell.exe` (for the LibreHardwareMonitor WMI query) on every single refresh, every 4s. Both are now cached for 20s independent of the refresh cadence (temps/fan speed don't need to be as fresh as CPU%/RAM%), and the outer refresh interval itself was doubled to 8s — cuts those two process spawns down to roughly a fifth of what they were before, while still visible.

## Files

- `main.js` — creates one window per display (left-to-right order = screen index), the tray icon, autostart via `setLoginItemSettings`, IPC for window controls, cross-window layout sync, the save-all round trip, and the toast relay.
- `layouts-store.js` — shared read/write helpers for `layouts.json`, used by both `main.js` and `renderer/app.js`.
- `layouts.json` — the presets described above. Edited by the app itself when you save/switch; safe to hand-edit too.
- `config.json` — `{ "autostart": true|false }`.
- `assets/tray-icon.png` — the tray icon (a generated HUD-reticle graphic, not hand-drawn — swap it for anything you like, any size Windows accepts for tray icons works).
- `renderer/` — `index.html`, `style.css` (theme + ambient background + toasts), `app.js` (node discovery, gridstack wiring, layout persistence, toast function).

## Packaging (later)

Currently runs unpackaged via `electron .`. Autostart is wired to relaunch the same way (`electron.exe <Jarvis root>`). If this gets packaged into a real `.exe` with `electron-builder`, update `applyAutostart()` in `main.js` to point at the built executable instead of `process.execPath` + args.
