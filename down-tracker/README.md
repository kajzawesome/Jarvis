# down-tracker

Uptime monitor for whatever services/sites you care about — work or personal. Toasts when something goes down, and again when it comes back.

## Status: 🟢 active

## Adding targets

An **ADD TARGET** form right on the tile (edit-mode only) — name, type (HTTP or TCP), URL/host, and port (TCP only). No JSON editing needed, though `targets.json` is there if you'd rather bulk-edit.

- **HTTP** — GETs the URL. Any response counts as "up" (even a 404 means the server's alive and responding) — only a `5xx` or a network-level failure (timeout, DNS failure, connection refused) counts as down. 6s timeout.
- **TCP** — raw socket connect to `host:port` — good for anything that isn't a web endpoint (SSH, RDP, a database port, an internal service with no HTTP interface).

## How it works

`collector.js` keeps a `Map` of each target's last-known up/down state in memory. When a check flips that state, the result carries `changed: true` and the widget fires a toast — so you get pinged both when something goes down *and* when it recovers, not just a static status list you have to keep glancing at. Checks run every 60s (`refreshMs` in `node.json`) for every target in parallel.

## Notes

- No historical uptime tracking/percentage — just current status + response time. Would need to start persisting check results over time to build that.
- Remove a target via its row's `×` (edit mode only, same as everywhere else destructive).
