# minecraft-server

Status + controls for the actual home-stack setup — a Dockerized Paper server that tunnels out to a relay on an Oracle Cloud VPS (self-hosted playit.gg replacement). See `C:\Users\USERNAME\Desktop\new server\README.md` / `ARCHITECTURE.md` for the full design.

## Status: 🟢 active (built — see `node.json`, `collector.js`, `widget.js`)

## Why not a port ping

Paper's container doesn't publish `25565` to the host at all — only `tunnel-client` (inside the docker network) can reach it, and it dials *out* to the relay rather than accepting inbound connections locally. A `localhost:25565` check would always read offline, running or not. Status instead mirrors the existing `tray/status-tray.ps1` script's approach:

- `docker inspect --format '{{.State.Status}}' <container>` for each of `mc-paper`, `mc-tunnel-client`, `mc-monitor`.
- A raw TCP connect check against `RELAY_ADDR` (read from `home-stack/.env` — only that one line is read, no other secrets are touched).

`state` is `running` (all containers running + relay reachable), `stopped` (nothing found), or `partial` (anything in between).

## Controls

The tile has three buttons:

- **START/STOP** (toggles based on current state) — `docker compose up -d` / `docker compose down` in `home-stack/`.
- **RESTART** — `docker compose restart` (all three containers).
- **FILES** — opens `home-stack/paper/` (where `server.properties`, `whitelist.json`, `plugins/` live) via the OS file explorer.

All three shell out to `docker` from `collector.js` (`startServer`/`stopServer`/`restartServer`/`openServerFiles`), same as clicking the "MC Server" desktop shortcut would — just without launching the separate tray icon.

## Paths (hardcoded)

`HOME_STACK_DIR` in `collector.js` points at `C:\Users\USERNAME\Desktop\new server\home-stack`. Update it there if the project ever moves.
