# Jarvis

A personal command center, in the spirit of Tony Stark's J.A.R.V.I.S. — a black/green/white HUD dashboard that boots with your PC, spans every monitor, and doubles as your desktop.

Everything the HUD displays is a **node**: a self-contained folder that reports data and renders its own tile. The [dashboard](dashboard/) app auto-discovers every node folder at startup — nothing to register by hand. Planned work lives in [BACKLOG.md](BACKLOG.md).

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
4. **`widget.js`** — exports `render(container, data)`, called on every refresh. Fill `container.innerHTML` using the shared HUD classes (`.stat-block`, `.row`, `.meter`, `.status-pill`, `.chip`, `.hud-btn`, `.btn-row`, etc. — see [dashboard/renderer/style.css](dashboard/renderer/style.css)) so it matches the theme automatically. Want to fire a HUD-wide toast? Call `window.jarvisToast(title, body)` from anywhere in the widget. Rendering an open-ended list (could be 2 items, could be 50)? Wrap the rows in `<div class="fit-zone">...</div>`, most-important-first — the tile auto-trims trailing rows to whatever actually fits, no scrollbar, no manual size math.
5. That's it — restart the dashboard (or drag the node in from the palette in edit mode) and it appears as a draggable tile.

Look at [pc-stats/](pc-stats/) as the reference implementation for a simple polling node, [minecraft-server/](minecraft-server/) for one with action buttons + a background watcher, or [twitch/](twitch/) for the OAuth-with-a-local-callback-server pattern (also used by [spotify/](spotify/)).

## The HUD itself

Built with Electron ([dashboard/](dashboard/)) — one borderless window per monitor, black/green/white theme with a subtle animated ambient background (drifting grid, scan sweep, pulse glow — pure CSS), drag-and-drop grid (via [gridstack](https://gridstack.io)).

- **Edit mode** — toggle via the `EDIT LAYOUT` button (top bar). Unlocked: drag tiles from the left palette onto the grid, resize/reposition existing tiles, or click a tile's `×` to remove it. Locked (default): a calm, click-through HUD. The grid never scrolls — `overflow: hidden`, so it's exactly the screen size and nothing more; anything arranged past that edge is just clipped rather than scrollable. Freely add/resize tiles however you want — there's no active reverting/rejecting of oversized changes (an earlier version tried that and it just fought normal use, since almost any resize on a fairly full grid could trip it). Each tile also gets a header-visibility toggle (a small `○`/`◉` next to the `×`, edit-mode only) — turn a tile's title bar off for the calm/locked view while still seeing it (and being able to turn it back on) whenever you're editing.
- **Text scales with tile size** — every widget's text uses CSS container queries, so making a tile bigger (drag its resize handle) makes its text bigger too, not just more whitespace.
- **Content auto-fits, never scrolls** — no tile ever shows a scrollbar (`overflow: hidden` throughout). For open-ended lists (recent activity, node health, news headlines), widgets wrap their rows in `<div class="fit-zone">`; `dashboard/renderer/app.js` trims trailing rows after every refresh until the tile's content actually fits its own box, so a small tile just shows less rather than overflowing or scrolling. Widgets order their content most-important-first so what gets silently dropped when space is tight is the least useful part.
- **Per-screen content, linked presets** — each monitor's grid content is independent (arrange your left screen and main screen differently), but saved arrangements are bundled into **presets** that cover every screen at once. `SAVE ALL AS...` snapshots what's currently live on every open screen into one named preset; the dropdown swaps every screen to a preset together. Built-in presets: `default` and `focus` (productivity only). See [dashboard/README.md](dashboard/README.md) for the mechanics.
- **Desktop replacement, not a kiosk lockout** — windows are normal (minimizable, alt-tabbable), just borderless and fullscreen on launch (`fullscreen: true`, so the taskbar stays out of the way like a game/video in fullscreen). `Ctrl+Alt+J` toggles all Jarvis windows show/hide at once.
- **Move a tile to another screen** — a small `SCR N` dropdown next to each tile's `×` (edit mode, only shown when more than one screen is open) sends it to another monitor. Native drag-and-drop doesn't work between two separate OS windows (a Chromium/Electron limitation, not something to hack around) — this is the explicit alternative, and it's safe: the tile only disappears from its original screen once the target screen confirms it actually fit there.
- **Tray icon** — closing a window just hides it; the tray icon (right-click: show/hide all, autostart toggle, quit) is the only real way to exit, so background timers/watchers (like MC log tailing) keep running.
- **Toast notifications** — any node can call `window.jarvisToast(title, body)` to pop a HUD alert on every open screen. Used by minecraft-server's join/leave watcher and pomodoro's session-end alert.
- **Autostart** — toggled via the `AUTOSTART` button (or the tray menu); persists in `dashboard/config.json`.

Run it: `npm install` then `npm start` from the Jarvis root (see [dashboard/README.md](dashboard/README.md) for details).

## Open questions for later

- `spotify`/`google-calendar` need credentials in `.env` + an in-tile CONNECT click to finish OAuth — see each README.
- `rgb-control` needs OpenRGB's SDK Server toggled on (off by default) to actually connect.
- Discord integration is scoped (both directions) but not built — see [BACKLOG.md](BACKLOG.md).
- Push vs pull: most nodes poll on an interval (`refreshMs`); minecraft-server's join/leave already moved to push (log tailing) — twitch/spotify could similarly move to webhooks/events later instead of polling.
