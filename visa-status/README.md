# visa-status

A manual tracker for your NVC/spousal visa case — **not** automated CEAC scraping.

## Status: 🟢 active

## Why manual, not automated

NVC case status lives behind a login + CAPTCHA on the government CEAC portal (ceac.state.gov). That's not something to automate: it's fragile (breaks on any redesign), likely against the portal's terms, and not a system worth storing your passport/case ID credentials for locally just to poll it. Instead this node is a lightweight log:

- **OPEN CEAC** — opens the portal in your browser for you to actually check manually.
- **LOG CHECK** — after you check, record the current stage + an optional note. Updates "last checked" and appends to history.
- The tile flags itself (turns red/urgent) once it's been 14+ days since your last logged check, or if you've never logged one — a gentle nudge to go check, not a real-time status feed.

## Data

`data.json` — `caseType`, `currentStage`, `lastChecked`, `history` (last 5 shown), `ceacUrl`. Edit directly if you want to seed initial values, or just use the tile's buttons.
