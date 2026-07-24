# router-network

WAN status, public IP, and connected devices for your ASUS RT-AX1800S (`192.168.50.1`).

## Status: 🟢 active (live-tested against your RT-AX1800S — working)

## Setup

Open [.env](../.env) at the Jarvis root and fill in:

```
ROUTER_HOST=192.168.50.1
ROUTER_USER=<your router admin username, usually "admin">
ROUTER_PASSWORD=<your router admin password>
```

`ROUTER_HOST` is already set to the address I found when probing your network (`192.168.50.1`, confirmed as a stock ASUSWRT login page). Once the username/password are filled in, the node picks it up on its next refresh (30s) — no restart needed.

## How it works

ASUSWRT doesn't have an official public local API, but the router's own web UI talks to itself over a couple of endpoints that are well documented by community projects (e.g. Home Assistant's `asusrouter` integration) — this node does the same thing directly instead of pulling in an extra dependency:

1. **`POST /login.cgi`** with the full form-field set the real login page sends (`group_id`, `action_mode`, `action_script`, `action_wait`, `current_page`, `next_page`, `login_authorization=base64(user:pass)`) plus `Referer`/`Origin` headers → this firmware's httpd silently ignores bare/minimal login requests (200 OK, but no session cookie — indistinguishable from a wrong password unless you know to send the full field set). Successful login returns a `Set-Cookie: asus_token=...`, cached for 10 minutes before re-logging in.
2. **`POST /appGet.cgi`** with a `hook=...` body — the same "hook" mechanism the router's own JS uses to pull live data. This node calls `nvram_get(wan0_ipaddr)`, `nvram_get(wan0_state_t)`, and `get_clientlist()`. `get_clientlist()` returns every device the router has ever seen (mostly stale/offline) — `parseClients()` filters to `isOnline === '1'` only.

## If it stops working after a firmware update

If `state` comes back `error`, the message says what failed. If login starts failing again, check the router's own `Main_Login.asp` in a browser (devtools → Network tab) and diff the actual request against `login()` in `collector.js` — ASUS occasionally tweaks the exact field set across firmware updates.

## Not included (yet)

Bandwidth throughput (up/down Mbps) and Wi-Fi signal strength per band aren't wired up — `appGet.cgi` exposes them too (typically via `netdev()` for traffic counters), just not implemented in this first pass. Add another hook call to `getStatus()` in `collector.js` if you want them.
