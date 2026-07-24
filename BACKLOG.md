# Backlog

Improvement ideas for Jarvis that aren't part of the core node contract. Move items to "Done" (or just delete the line) once shipped — this file tracks intent, not history; `git log`/commit messages would be the record if this ever becomes a repo.

## Done (2026-07-21)

- [x] Tray fallback — system tray icon (`dashboard/assets/tray-icon.png`), Show/Hide All, Autostart toggle, Quit. Closing a window now just hides it; the tray's "Quit Jarvis" is the only real exit.
- [x] HUD toast notifications — `window.jarvisToast(title, body)`, broadcasts to every open screen via `main.js`.
- [x] MC server join/leave notifications — tails `docker logs -f mc-paper`, first consumer of the toast system.
- [x] `weather` node — IP geolocation (ip-api.com, falls back to ipapi.co) + Open-Meteo, no API key.
- [x] `clipboard-history` node — rolling last-15 clipboard history, click to re-copy.
- [x] `focus` preset — productivity-only, full-width on the main screen.
- [x] `twitch` node scaffolded — Helix live/offline/title/category/viewers via app access token. Shows "not configured" until `.env` has real `TWITCH_CLIENT_ID`/`TWITCH_CLIENT_SECRET`/`TWITCH_CHANNEL` (see `twitch/README.md` for the registration walkthrough).

## Done (2026-07-22)

- [x] `router-network` node — ASUS RT-AX1800S at `192.168.50.1`, live-tested and working (WAN status/IP + online device list). Turned out the router's httpd silently no-ops bare login requests (200 OK, no cookie) unless the full form-field set + Referer/Origin headers are sent — see `router-network/README.md` for the fix if a future firmware update breaks it again.
- [x] Twitch follower/subscriber counts — user OAuth (authorization-code flow, local callback server on port 17563, refresh-token handling), a "CONNECT FOR FOLLOWERS/SUBS" button on the tile drives it. See `twitch/README.md`.
- [x] `github-activity` node — live-tested and working (recent activity, recently-pushed/starred/pinned repos). Caught a bug during testing: GitHub's Events API dropped `commits`/`size` from PushEvent payloads (only `ref`/`head`/`before` remain now), so the original "pushed N commits" summary always showed 0 — fixed to show branch name instead.
- [x] `pomodoro` node — 25/5 focus timer, toasts on session end, pairs with the `focus` preset.
- [x] `system-health` node — aggregates every other node's state + Jarvis's own uptime into one tile.
- [x] `spotify` node — now-playing via user OAuth, same shape as the twitch flow. Credentials in `.env`; needs one click of the in-tile CONNECT button to finish the OAuth handshake (not yet done as of writing).
- [x] `streamlabs` node — start/stop stream/recording via Streamlabs Desktop's local WebSocket API. Live-tested against 1.21.7 — status read confirmed working; toggle actions use the same protocol but weren't explicitly clicked-and-confirmed.
- [x] Interview-prep streak tracker — added to `productivity` (not a separate node), a daily check-in button.
- [x] `network-speed` node — Cloudflare speed-test endpoints (no CLI install needed), manual trigger only (a real test moves real bandwidth, shouldn't run on a timer while streaming/gaming).
- [x] `now-doing` node — active window/process, Win32 API via a small PowerShell script.
- [x] `docker-images` node — general Docker overview (all containers + images), separate from minecraft-server's stack-specific tile. Shows a launch button when the Docker daemon isn't running.
- [x] `exchange-rate` node — USD/BRL via Frankfurter, no key.
- [x] `visa-status` node — manual NVC/CEAC tracker (deliberately **not** automated — see the README for why), check-in log + days-since-last-check reminder.
- [x] desktop-links "ADD APP" picker — searchable list over every detected Start Menu + taskbar app (117 found), replacing raw file-browsing as the primary add path. `list-apps.ps1` also usable standalone to just see everything detected. `migrate-from-desktop.ps1` switched to merge-mode a while back, still holds.

## Done (2026-07-23)

- [x] `world-clock` node — local time + Brazil (`America/Sao_Paulo`), no API.
- [x] `rgb-control` node — live OpenRGB device list + color control (not just the launcher shortcut), via the `openrgb-sdk` npm package (binary SDK protocol, no HTTP). Needs OpenRGB's SDK Server enabled (off by default).
- [x] `google-calendar` node — upcoming events via user OAuth. "Desktop app" client type gets Twitch-style any-port loopback convenience (unlike Spotify's exact-match requirement).
- [x] `quick-capture` node — single text box, Enter adds straight into `productivity/data.json`'s task list.
- [x] docker-images log viewer — a LOGS button per running container opens a scrollable overlay (`docker logs --tail 100`).
- [x] `tech-news` node — top Hacker News stories, click to open, no key.
- [x] clipboard-history image previews — resized thumbnails (96x96) for image clipboard content; view-only by design (copying back a thumbnail would be a lossy, misleading "restore").
- [x] `weather-alerts` node — active NWS severe alerts for your location (US-only), toasts on a new alert.
- Skipped per explicit request: Discord webhook notifications (item 3 of that batch) — stays in "Scoped, not built" below.

## Done (2026-07-23, later)

- [x] `world-clock`, `rgb-control`, `google-calendar`, `quick-capture`, `tech-news`, `weather-alerts` nodes, docker-images log viewer, clipboard-history image previews — see individual READMEs.
- [x] ~~`dragon` node~~ — built, then scrapped same day (2026-07-23) at user's request ("the dragon animation is bad"). Removed folder + CSS entirely, not worth re-attempting without a clearer design direction if revisited.
- [x] Text scales with tile size — CSS container queries (`container-type: inline-size` on `.node-panel-body`) + `clamp(min, Ncqi, max)` on every shared text class, plus a new `.stat-hero` utility for the "big number" widgets (pomodoro timer, weather temp, exchange rate, world clock, productivity streak). Removed several widgets' inline `font-size` overrides that were silently blocking the new scaling (inline styles beat class rules).
- [x] Per-tile header-hide toggle — a `○`/`◉` next to each tile's `×` (edit-mode only) marks its title bar hidden outside edit mode. Persisted per-item as `headerHidden` alongside x/y/w/h in saved presets.
- [x] Grid never scrolls, period — `.grid-wrap` changed from `overflow: auto` to `overflow: hidden`. The earlier "reject a drag-in that doesn't fit" check (added same day) only covered fresh adds; user found resizing an *existing* tile bigger still triggered a scrollbar, since resize doesn't go through the same code path. Fixed at the CSS level (blanket, can't happen via any interaction) plus added a matching `resizestart`/`resizestop` guard that reverts an oversized resize with a toast, so oversized resizes revert visibly instead of silently clipping.
- [x] Spotify playback controls — play/pause/skip/previous/shuffle/repeat, all via `/v1/me/player/*` endpoints (needed adding `user-modify-playback-state` scope — anyone who connected before this needs to reconnect). "Smart Shuffle" explicitly **not implemented** — Spotify-app-only ML feature, no public Web API endpoint exists for it.

## Done (2026-07-23, evening)

- [x] Fullscreen windows on launch — `fullscreen: true`, taskbar stays out of the way like a fullscreen game/video.
- [x] Move a tile between screens — native drag-and-drop doesn't work across separate `BrowserWindow`s in Electron (a real platform limitation, not a bug to fix), so built a `SCR N` dropdown per tile instead, with a confirmed IPC round trip (`move-node-to-screen` → `receive-moved-node` → `move-node-result`) so a tile can never vanish into a screen with no room for it — the source only removes its copy once the target confirms success.

## Done (2026-07-23, night — layout fixes + reworks)

User reported real bugs from the live running app (overhangs, scrollbars on individual tiles, overlapping text) plus three feature changes:

- [x] **Layout bug fixes**: `.node-panel-body` changed from `overflow: auto` to `overflow: hidden` (no more per-tile scrollbars, matches the earlier grid-level "no scrolling" decision extended down to the tile level). `.row-label` changed from a fixed `width: 62px` to `flex: 1; min-width: 0` + `text-overflow: ellipsis` — this was the actual cause of the overlapping text seen in github-activity (long repo/task names have no ellipsis truncation with a fixed-width label, so they visually collided with the value column next to them). `.row-value` got the same truncation as a safety net.
- [x] **Auto-fit lists** — new `trimFitZones()` in `dashboard/renderer/app.js`, run after every widget refresh: any `<div class="fit-zone">` a widget wraps its rows in gets trailing rows removed one at a time until the tile's body actually fits its own box. Applied to `system-health` (sorted error/warn first so trimming drops "ok" rows first, not the ones needing attention), `github-activity` (whole sections in priority order — PINNED → RECENT ACTIVITY → RECENTLY PUSHED → STARRED, so STARRED drops first), `tech-news`, `todo` (TO DO → IN PROGRESS → DONE priority).
- [x] Launch buttons for unreachable apps — was missing on `streamlabs` (added `not_running` state + LAUNCH STREAMLABS button) and `minecraft-server` (previously collapsed "Docker not running at all" into the same "not found" bucket as "containers stopped but Docker's fine" — added a dedicated `docker info` daemon-reachability check + `daemon_down` state + LAUNCH DOCKER DESKTOP button, mirroring the pattern already used in `docker-images`/`rgb-control`).
- [x] ~~`dragon`~~ scrapped — see above.
- [x] `now-doing` → **`todo`**: full rebuild, not a rename-in-place. Was an active-window/foreground-app tracker; now a kanban-style (TO DO / IN PROGRESS / DONE) status board over the *same shared task list* `quick-capture` writes into and `productivity` summarizes — one source of truth (`productivity/data.json`'s `tasks` array), task shape moved from `{text, done}` to `{text, status}` with backward-compat normalization for old entries.
- [x] `productivity`'s interview-prep streak → **deadline-add form**. `.deadline-form` (title/due/course inputs + ADD button) gated to edit-mode-only via the same CSS pattern as other editing controls (`.edit-mode .deadline-form { display: flex }`), writes to `data.json`'s `deadlines` array. The existing sorted-countdown deadline list stays, now wrapped in a `.fit-zone`.

## Done (2026-07-23, night — save confirmation)

- [x] User asked if layouts persist across reboot and doubted the save was working, since there was no feedback at all. **They do persist** — `SAVE ALL AS...` writes to `layouts.json` and sets `activePreset`, which every screen reads fresh on each launch (including via autostart), so this already worked, just silently. Added a `save-all-complete` IPC reply (main.js now tracks the initiating window's `webContents.id` through the save-all round trip and replies directly to it once the write lands) so a toast confirms the save actually happened.

## Done (2026-07-24 — repo, config editability, voice control)

- [x] Initialized as a real git repo (`git init` + first commit). `.gitignore` excludes `.env` (real secrets) and `node_modules/` — verified nothing sensitive was staged before committing (grepped for token/secret patterns across all tracked files first).
- [x] Confirmed autostart genuinely works, not just "looks configured" — checked the actual Windows registry (`HKCU\...\Run`), found the real `electron.app.Electron` entry pointing at the correct Jarvis path. Combined with `layouts.json`'s `activePreset` being read fresh on every launch, config does persist across a real reboot, not just an app restart.
- [x] Cleared out placeholder/example seed data (`productivity/data.json`'s "Example: Capstone milestone 1" / "Example Co") that read as confusing real entries — now starts empty since there's a real in-UI form to populate it.
- [x] Added an **ADD APPLICATION** form + a status dropdown (applied/oa/phone_screen/onsite/offer/rejected) per row to `productivity` — applications were the one piece still hand-edit-only after the deadline form landed; now nothing in productivity requires touching `data.json` directly.
- [x] `voice-control` node — fixed set of spoken commands (preset switching, MC server start/stop/status, pomodoro start/pause, network speed test, CPU usage query, RGB color), no API key/cost, uses the browser's built-in `SpeechRecognition`. **Verified the API object exists in this Electron build** (via a quick `executeJavaScript` probe, not guessed) but the actual mic/recognition quality is unverified — no way to test that from here. User explicitly chose this over full LLM-based voice control (bigger build, needs a paid API key) when asked to scope it.

## Scoped, not built (Discord)

Two genuinely different builds under "Discord" — scoped both, neither started:

- [ ] **Jarvis → Discord** (push notifications to a channel). The simple direction: a Discord webhook URL (Server Settings → Integrations → Webhooks → New Webhook, no bot/dev-portal app needed) that `POST`s a JSON `{ "content": "..." }` to announce things — MC server started/stopped, a player joined, went live on Twitch. Would piggyback on the existing `window.jarvisToast` call sites (minecraft-server's join/leave watcher, a future twitch "went live" check) by also POSTing to the webhook there. Rough size: similar to the toast system itself, maybe smaller — half a day.
- [ ] **Discord → HUD** (show Discord activity as a tile). The bigger direction: register a real bot app in Discord's dev portal, invite it to your server with `GUILD_PRESENCES`/`GUILD_MEMBERS` privileged intents (these require the app to be verified or stay under 100 servers - fine for personal use, just a checkbox to enable in the portal), and keep a persistent gateway websocket connection open (via `discord.js`) for the life of the app to track friend presence/unread mentions. This is architecturally different from every other node so far — everything else polls or shells out on a timer; this needs a long-lived connection managed somewhere (probably `main.js`, broadcasting updates to renderers via IPC, similar to the toast relay). Rough size: a full session, most of it around getting the bot registered/invited and intent-approved correctly rather than the code itself.

## Later / unscoped

- [ ] Per-preset window behavior (e.g. a preset that also changes which screens are ambient vs interactive)
- [ ] Packaging as a real installable `.exe` via `electron-builder` (currently runs unpackaged via `electron .`; `main.js`'s `applyAutostart()` has a note on what to change)
