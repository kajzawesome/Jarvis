# minecraft-server

Status + controls for one specific self-hosted architecture: a Dockerized Paper server that tunnels *out* to a relay somewhere with a public IP (a self-hosted playit.gg-style replacement — the relay can be any VPS/cloud box, nothing here is tied to a specific provider). If your setup looks nothing like this, this node isn't a fit — leave `MC_HOME_STACK_DIR` unset in `.env` and it just stays inactive, or use it as a reference for building your own (see the root README's "Adding a new node").

## Status: 🟢 active (code ready — needs `MC_HOME_STACK_DIR` in `.env`)

## Setup

Add to [.env](../.env) at the Jarvis root:

```
MC_HOME_STACK_DIR=/absolute/path/to/your/home-stack
```

That's the folder containing your stack's `docker-compose.yml` (and a `paper/` subfolder — see "Controls" below). Nothing else to configure; the tile shows "not configured" until this is set, same as any other credential-gated node.

## Why not a port ping

Paper's container doesn't publish `25565` to the host at all — only `tunnel-client` (inside the docker network) can reach it, and it dials *out* to the relay rather than accepting inbound connections locally. A `localhost:25565` check would always read offline, running or not. Status instead checks:

- `docker inspect --format '{{.State.Status}}' <container>` for each of `mc-paper`, `mc-tunnel-client`, `mc-monitor` (container names are conventions this node assumes — rename them in `collector.js`'s `CONTAINERS` array if yours differ).
- A raw TCP connect check against `RELAY_ADDR` (read from `$MC_HOME_STACK_DIR/.env` — a *different* `.env` from Jarvis's own root one — only that one line is read, no other secrets in it are touched).

`state` is `running` (all containers running + relay reachable), `stopped` (nothing found), or `partial` (anything in between).

## Controls

The tile has three buttons:

- **START/STOP** (toggles based on current state) — `docker compose up -d` / `docker compose down` in `$MC_HOME_STACK_DIR`.
- **RESTART** — `docker compose restart` (all three containers).
- **FILES** — opens `$MC_HOME_STACK_DIR/paper/` (where `server.properties`, `whitelist.json`, `plugins/` are expected to live) via the OS file explorer.

All three shell out to `docker` from `collector.js` (`startServer`/`stopServer`/`restartServer`/`openServerFiles`).
