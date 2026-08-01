# desktop-links

Clickable app/folder/URL shortcuts, rendered as a HUD tile — this is what makes the dashboard double as your actual desktop. Icons are extracted from each target and recolored to the green/black HUD theme.

## Status: 🟢 active

## Adding links

Three tiles in edit mode:

- **ADD APP** — searchable picker over every app Jarvis can detect (Start Menu shortcuts, per-user + all-users, plus everything pinned to your taskbar — 117 apps detected on this machine). Type to filter, click to add — icon extraction happens automatically. This is the easy path for anything actually installed; no need to browse to an `.exe` by hand.
- **BROWSE** — a raw native file/folder picker, for anything not in the detected-apps list (a specific file, a folder you want a shortcut to, a portable app with no Start Menu entry).
- **ADD URL** — prompts for a URL + label.

Removing a tile's `×` (edit mode) also blacklists its target in `excluded.json`, so a future `migrate-from-desktop.ps1` re-run won't bring it back.

## Seeing everything detected (without adding anything)

```
powershell -ExecutionPolicy Bypass -File desktop-links\list-apps.ps1
```

Prints the same full detected-app list the "ADD APP" picker uses (JSON) — useful to eyeball everything available, e.g. before deciding what to add to `migrate-from-desktop.ps1`'s taskbar allowlist, or just to see what's actually pinned/installed.

## Migrating from your real Desktop/taskbar (bulk import)

Runs **automatically on every Jarvis launch** now (`main.js` calls it once at startup, not per-window, so it can't race with itself across multiple screens) — the tile refreshes itself once the sync lands, no manual step needed anymore. Still runnable by hand too:

```
powershell -ExecutionPolicy Bypass -File desktop-links\migrate-from-desktop.ps1
```

Scans your Desktop (+ Public Desktop) for shortcuts/folders, plus a *curated* set of taskbar-pinned apps (`$taskbarNamesToInclude` in the script — unlike the "ADD APP" picker, which shows everything, this bulk import only pulls in taskbar apps you've explicitly named, to avoid dumping every pinned icon in one go). Merges into the existing `links.json` — safe to re-run any time (including automatically on every launch), won't duplicate or wipe out manual adds/removals (see `excluded.json` above).

Shortcut arguments are captured too (e.g. the "MC Server" shortcut, which launches PowerShell with a `-File` argument) — these get an `args` field and are launched via `spawn` instead of `shell.openPath`, since `openPath` can't pass arguments. The "ADD APP" picker captures these too.

## links.json shape

```json
{ "label": "VS Code", "type": "app", "target": "C:\\path\\to\\Code.exe", "args": null, "icon": "icons/vs-code.png" }
```

`type` is `app`, `folder`, or `url`. `icon` is relative to this folder, or `null`/empty for the letter-circle fallback (used for folders, which don't have a meaningful extractable icon). Hand-edit `links.json` directly for one-off tweaks.

## Tile sizing

Icon size and label text scale with the tile's own size (same container-query pattern used everywhere else in the HUD — bigger tile, bigger icons). Long labels wrap to 2 lines and clip rather than spilling past the tile's border, so a name always fits inside its box regardless of how long it is or how small the tile is.
