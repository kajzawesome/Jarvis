# Jarvis

A personal command center, in the spirit of Tony Stark's J.A.R.V.I.S. — a black/green/white HUD dashboard that boots with your PC, spans every monitor, and doubles as your desktop.

Everything the HUD displays is a **node**: a self-contained folder that reports data and renders its own tile. The [dashboard](dashboard/) app auto-discovers every node folder at startup — nothing to register by hand. Planned work lives in [BACKLOG.md](BACKLOG.md).

## Getting started (new machine / new person)

1. **Install:** `npm install` from the Jarvis root (installs every node's dependencies too, not just the dashboard's).
2. **Credentials (all optional):** copy [.env.example](.env.example) to `.env` and fill in whichever integrations you actually want (Twitch, router, GitHub, Spotify, Streamlabs, Google Calendar). Skip anything you don't use — every node that needs a credential shows a clear "not configured" state instead of erroring, so a bare `.env` (or none at all) still gives you a fully working dashboard, just with those specific tiles inactive until you fill them in. Each has its own step-by-step README (e.g. [twitch/README.md](twitch/README.md), [google-calendar/README.md](google-calendar/README.md)) for getting API keys.
3. **Run it:** `npm start` from the Jarvis root, or run `dashboard\create-desktop-shortcut.ps1` once for a double-clickable "Jarvis" shortcut on the Desktop (no terminal needed after that — see [dashboard/README.md](dashboard/README.md)).
4. **Starter layout:** [dashboard/layouts.json](dashboard/layouts.json) ships with a real, already-arranged "Default" preset (not a blank grid) — it'll just show "not configured"/empty states for anything you haven't set up credentials for yet. Drag things around freely (`EDIT LAYOUT` button) and use `SAVE ALL AS...`/`UPDATE`/`DELETE PRESET` in the top bar to make your own.
5. **On a laptop or lower-power GPU:** click `REDUCE MOTION` in the top bar to turn off the animated ambient background (the one genuinely continuous/always-running visual cost in the whole app) — see "Performance" below for more.
6. **Want to change the color scheme?** See "Customizing the look" below — it's a handful of CSS variables, not a rewrite.
7. **Want to add your own node** (a widget for something this doesn't cover yet)? See "Adding a new node" below.

## Status legend

- 🟢 **active** — built and wired into the dashboard
- 🟡 **planned** — real need, not started
- 🔵 **future** — placeholder, no immediate build

## Nodes

| Node | Status | What it covers |
|---|---|---|
| [pc-stats](pc-stats/README.md) | 🟢 active | CPU/GPU/RAM/disk/uptime + temps/fan speeds |
| [minecraft-server](minecraft-server/README.md) | 🟢 active | Docker home-stack status (Paper/tunnel/monitor + relay) + start/stop/restart, join/leave toasts |
| [docker-images](docker-images/README.md) | 🟢 active | General Docker overview — all containers/images, launch button if daemon's down |
| [productivity](productivity/README.md) | 🟢 active | Senior-year deadlines (in-tile add form) + dev job hunt tracker |
| [desktop-links](desktop-links/README.md) | 🟢 active | Clickable app/folder/URL tiles — searchable "ADD APP" picker over every detected app |
| [weather](weather/README.md) | 🟢 active | Current conditions via IP geolocation + Open-Meteo, no API key |
| [exchange-rate](exchange-rate/README.md) | 🟢 active | USD/BRL, no API key |
| [clipboard-history](clipboard-history/README.md) | 🟢 active | Rolling clipboard history, click to re-copy |
| [pomodoro](pomodoro/README.md) | 🟢 active | 25/5 focus timer, toasts on session end |
| [system-health](system-health/README.md) | 🟢 active | Aggregates every other node's status + Jarvis's own uptime |
| [todo](todo/README.md) | 🟢 active | Kanban-style task board (to do / in progress / done) over the shared task list |
| [quick-capture](quick-capture/README.md) | 🟢 active | One text box, Enter adds straight into the shared task list |
| [network-speed](network-speed/README.md) | 🟢 active | Download/upload test, manual trigger (Cloudflare endpoints, no CLI) |
| [visa-status](visa-status/README.md) | 🟢 active | Manual NVC/spousal-visa tracker + CEAC quick-link (deliberately not automated) |
| [twitch](twitch/README.md) | 🟢 active | Live status/title/category/viewers + followers/subs — needs your credentials in `.env` |
| [router-network](router-network/README.md) | 🟢 active | ASUS RT-AX1800S WAN status + online devices — live-tested, working |
| [github-activity](github-activity/README.md) | 🟢 active | Recent activity, recently-pushed/starred/pinned repos — live-tested, working |
| [spotify](spotify/README.md) | 🟢 active | Now-playing + full playback controls (play/pause/skip/shuffle/repeat) — credentials set, needs the in-tile CONNECT click |
| [streamlabs](streamlabs/README.md) | 🟢 active | Start/stop stream/recording — live-tested (status read confirmed; toggle actions not yet clicked) |
| [world-clock](world-clock/README.md) | 🟢 active | Local time + Brazil time, no API |
| [rgb-control](rgb-control/README.md) | 🟢 active | Live OpenRGB device list + color control — needs OpenRGB's SDK Server enabled |
| [google-calendar](google-calendar/README.md) | 🟢 active | Upcoming events — needs your own Google Cloud OAuth credentials |
| [tech-news](tech-news/README.md) | 🟢 active | Top Hacker News stories, no key |
| [weather-alerts](weather-alerts/README.md) | 🟢 active | Active NWS severe weather alerts (US-only), toasts on new ones |
| [voice-control](voice-control/README.md) | 🟡 built, needs live mic test | Fixed voice commands (preset switch, MC/pomodoro/RGB control) — free, local, no API key |
| [down-tracker](down-tracker/README.md) | 🟢 active | Uptime monitor for any HTTP/TCP target, toasts on status change — in-tile add form |
| [dev-workspace](dev-workspace/README.md) | 🟢 active | Open editor windows (click to focus) + git branch/dirty/ahead-behind for known VS Code projects (click to open) |
| [connectors](connectors/README.md) | 🟡 planned | Integration hub — Discord (scoped, not built — see BACKLOG.md), etc. |
| [ai-agents](ai-agents/README.md) | 🔵 future | Status board for Claude Code / background agents |

## Shape of the system

```
Jarvis/
├── README.md              you are here
├── BACKLOG.md              planned improvements + status
├── package.json            single root install — every node's deps live here
├── .env / .env.example      secrets nodes read from (twitch/, router-network/, github-activity/, spotify/, streamlabs/, google-calendar/)
├── dashboard/               the Electron app: window/screen management, HUD shell
│   ├── main.js               windows, tray, autostart, IPC (toast relay, file picker)
│   ├── layouts-store.js       shared layouts.json read/write helpers
│   ├── layouts.json           saved presets (linked across all screens)
│   ├── config.json            local settings (autostart on/off)
│   ├── assets/                tray-icon.png
│   └── renderer/              index.html / style.css (theme + ambience) / app.js (grid engine + toasts)
└── <node>/                  one folder per node (node.json + collector.js + widget.js + README.md)
```

## Adding a new node

Any top-level folder containing a `node.json` is auto-discovered on launch — no other wiring required. To add one:

1. **Create a folder** at the Jarvis root (e.g. `Jarvis/spotify/`).
2. **`node.json`** — the manifest:
   ```json
   {
     "id": "spotify",
     "label": "SPOTIFY",
     "collector": "./collector.js",
     "collectorFn": "getData",
     "collectorArgs": [],
     "widget": "./widget.js",
     "refreshMs": 60000,
     "defaultSize": { "w": 4, "h": 3 }
   }
   ```
3. **`collector.js`** — exports an async function (named by `collectorFn`) that returns `{ name, state, metrics, lastUpdated }`. Runs in the renderer process (Node/Electron context), so any npm package works — add it to the root `package.json` and `npm install` once from `Jarvis/`. Needs a secret? Read it from the root `.env` (see `twitch/collector.js` for the read pattern, or its `updateEnv()` if the node needs to write tokens back — e.g. after an OAuth flow).
4. **`widget.js`** — exports `render(container, data)`, called on every refresh. Fill `container.innerHTML` using the shared HUD classes (`.stat-block`, `.row`, `.meter`, `.status-pill`, `.chip`, `.hud-btn`, `.btn-row`, etc. — see [dashboard/renderer/style.css](dashboard/renderer/style.css)) so it matches the theme automatically. Want to fire a HUD-wide toast? Call `window.jarvisToast(title, body)` from anywhere in the widget. Need text input from the user? Use `await window.jarvisPrompt(message, defaultValue?)`, **not** `window.prompt()` — native dialogs can render behind these fullscreen windows and look like nothing happened. Rendering an open-ended list (could be 2 items, could be 50)? Wrap the rows in `<div class="fit-zone">...</div>`, most-important-first — the tile auto-trims trailing rows to whatever actually fits, no scrollbar, no manual size math.
5. That's it — restart the dashboard (or drag the node in from the palette in edit mode) and it appears as a draggable tile.

Look at [pc-stats/](pc-stats/) as the reference implementation for a simple polling node, [minecraft-server/](minecraft-server/) for one with action buttons + a background watcher, or [twitch/](twitch/) for the OAuth-with-a-local-callback-server pattern (also used by [spotify/](spotify/)).

## The HUD itself

Built with Electron ([dashboard/](dashboard/)) — one borderless window per monitor, black/green/white theme with a subtle animated ambient background (drifting grid, scan sweep, pulse glow — pure CSS), drag-and-drop grid (via [gridstack](https://gridstack.io)).

- **Edit mode** — toggle via the `EDIT LAYOUT` button (top bar). Unlocked: drag tiles from the left palette onto the grid, resize/reposition existing tiles, or click a tile's `×` to remove it. Locked (default): a calm, click-through HUD. The grid never scrolls — `overflow: hidden`, so it's exactly the screen size and nothing more; anything arranged past that edge is just clipped rather than scrollable. Freely add/resize tiles however you want — there's no active reverting/rejecting of oversized changes (an earlier version tried that and it just fought normal use, since almost any resize on a fairly full grid could trip it). Each tile also gets a header-visibility toggle (a small `○`/`◉` next to the `×`, edit-mode only) — turn a tile's title bar off for the calm/locked view while still seeing it (and being able to turn it back on) whenever you're editing.
- **Text scales with tile size** — every widget's text uses CSS container queries, so making a tile bigger (drag its resize handle) makes its text bigger too, not just more whitespace.
- **Content auto-fits, never scrolls** — no tile ever shows a scrollbar (`overflow: hidden` throughout). For open-ended lists (recent activity, node health, news headlines), widgets wrap their rows in `<div class="fit-zone">`; `dashboard/renderer/app.js` trims trailing rows after every refresh until the tile's content actually fits its own box, so a small tile just shows less rather than overflowing or scrolling. Widgets order their content most-important-first so what gets silently dropped when space is tight is the least useful part.
- **Per-screen content, linked presets** — each monitor's grid content is independent (arrange your left screen and main screen differently), but saved arrangements are bundled into **presets** that cover every screen at once. `SAVE ALL AS...` snapshots what's currently live on every open screen into one named preset; the dropdown swaps every screen to a preset together. Built-in presets: `default` and `focus` (productivity only). See [dashboard/README.md](dashboard/README.md) for the mechanics.
- **Desktop replacement, not a kiosk lockout** — windows are normal (minimizable, alt-tabbable), just borderless and sized to fill each monitor. Deliberately **not** `fullscreen: true` — that's Windows' exclusive fullscreen mode (same as a game/video player), which suppresses the OS taskbar entirely until the app exits fullscreen; a plain borderless window doesn't do that, so the taskbar stays reachable at all times without needing to hide Jarvis first. `Ctrl+Alt+J` toggles all Jarvis windows show/hide at once regardless, if you want the whole thing out of the way.
- **Any number of monitors, live** — one window per connected display, however many that is (`screen.getAllDisplays()`, not hardcoded to 2). Plugging/unplugging a monitor while Jarvis is already running is handled too — `main.js` listens for `display-added`/`display-removed`/`display-metrics-changed` and rebuilds all windows from scratch (debounced ~1s) rather than patching in place, since adding/removing a monitor can shift every other screen's left-to-right index. In-memory-only state (the pomodoro timer, clipboard history) resets when that happens; anything disk-backed (layouts, tasks, links) doesn't.
- **Move a tile to another screen** — a small `SCR N` dropdown next to each tile's `×` (edit mode, only shown when more than one screen is open) sends it to another monitor. Native drag-and-drop doesn't work between two separate OS windows (a Chromium/Electron limitation, not something to hack around) — this is the explicit alternative, and it's safe: the tile only disappears from its original screen once the target screen confirms it actually fit there.
- **Tray icon** — closing a window just hides it; the tray icon (right-click: show/hide all, autostart toggle, quit) is the only real way to exit, so background timers/watchers (like MC log tailing) keep running.
- **Toast notifications** — any node can call `window.jarvisToast(title, body)` to pop a HUD alert on every open screen. Used by minecraft-server's join/leave watcher and pomodoro's session-end alert.
- **Autostart** — toggled via the `AUTOSTART` button (or the tray menu); persists in `dashboard/config.json`.
- **Reduce motion** — toggled via the `REDUCE MOTION` button; turns off the animated ambient background (drifting grid, scan sweep, pulse glow). One global setting shared by every open screen, persists in `dashboard/config.json`. See "Performance" below.

## Performance

The ambient background's three CSS animations are the one genuinely continuous, always-running visual cost in the app — cheap on a desktop GPU, but worth turning off on a laptop or integrated GPU (`REDUCE MOTION` in the top bar; same effect as the OS-level "reduce motion" accessibility setting, just app-scoped so you don't have to change that system-wide). Beyond that:

- **Hiding/minimizing a screen actually pauses it** — every node's refresh timer (including the ones that shell out to a real process: PowerShell/WMI queries, `nvidia-smi`, `docker inspect`, etc.) stops the moment a window is hidden or minimized (`document.visibilityState`), and resumes with one immediate catch-up refresh once it's visible again. If Jarvis is competing with something CPU-heavy (a game, a build), just hide it — the tray icon (usually under Windows' taskbar "hidden icons" chevron) brings it back.
- **`pc-stats`** caches its two heaviest calls (`nvidia-smi`, a LibreHardwareMonitor WMI query) for 20s independent of its own refresh cadence, since both spawn a whole separate process and don't need to be as fresh as CPU%/RAM%.
- Every node's `refreshMs` (in its `node.json`) is fair game to raise if something feels too chatty for a particular machine — no code changes needed, just a bigger number.

## Customizing the look

The whole black/green/white theme is a handful of CSS custom properties at the top of [dashboard/renderer/style.css](dashboard/renderer/style.css):

```css
:root {
  --bg: #020403;          /* page background */
  --bg-panel: rgba(4, 14, 9, 0.82);   /* tile background (translucent) */
  --bg-panel-solid: #05130b;          /* tile background (opaque - palette, modals) */
  --green: #00ff9c;        /* primary accent - text, borders, glow */
  --green-dim: #0a5c38;    /* dimmer borders/dividers */
  --green-faint: #063321;  /* hover backgrounds, chips */
  --white: #eafff2;        /* body text */
  --red: #ff3b3b;          /* errors, offline/urgent states, delete actions */
  --glow: 0 0 6px rgba(0, 255, 156, 0.55), 0 0 18px rgba(0, 255, 156, 0.15); /* the glow effect on focus/hover/active */
  --font: 'Cascadia Mono', Consolas, 'Courier New', monospace;
}
```

Every shared HUD class (`.hud-btn`, `.row`, `.status-pill`, tile borders, the ambient background, etc.) references these — change the values here and it recolors the entire app, not just one widget. Want a blue HUD instead of green? Swap `--green`/`--green-dim`/`--green-faint` and adjust `--glow`'s color to match; everything else (layout, animations, container-query text scaling) is untouched. A node's own `widget.js` should stick to the shared classes rather than hardcoding colors, precisely so this stays a one-file change — see "Adding a new node" above.

## Open questions for later

- `spotify`/`google-calendar` need credentials in `.env` + an in-tile CONNECT click to finish OAuth — see each README.
- `rgb-control` needs OpenRGB's SDK Server toggled on (off by default) to actually connect.
- Discord integration is scoped (both directions) but not built — see [BACKLOG.md](BACKLOG.md).
- Push vs pull: most nodes poll on an interval (`refreshMs`); minecraft-server's join/leave already moved to push (log tailing) — twitch/spotify could similarly move to webhooks/events later instead of polling.
