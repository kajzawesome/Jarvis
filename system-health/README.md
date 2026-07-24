# system-health

One tile summarizing every other node's current state, plus how long Jarvis itself has been running.

## Status: 🟢 active

## How it works

Discovers every sibling node folder the same way `dashboard/renderer/app.js` does (any folder with a `node.json`), then calls each one's collector function directly and classifies the result:

- **ok** — `ok`/`running`/`live`/`offline`/`stopped` (offline/stopped are legitimate states, not failures — e.g. the MC server being intentionally off)
- **warn** — `partial`/`daemon_down`
- **unconfigured** — `not_configured`
- **error** — anything else, including a node whose collector threw

Note this **independently re-polls every node** on its own 60s interval rather than reading what other mounted tiles already fetched — simpler than cross-window state sharing (each monitor is a separate Electron renderer process with its own JS globals, so there's no single shared "current state" object to read from). This means placing this tile causes some duplicate polling of whatever else is mounted; at a 60s interval that's a non-issue for every node built so far.
