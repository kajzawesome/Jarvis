# clipboard-history

Rolling clipboard history — click any entry to copy it back.

## Status: 🟢 active

## How it works

Polls `clipboard.readText()` every 1.5s (Electron's `clipboard` module) and keeps the last 15 unique values, most recent first, in memory. Nothing is persisted to disk — history resets when the dashboard restarts. Text is escaped before rendering, since clipboard content is arbitrary and shouldn't be trusted as markup.

## Notes

- Text entries are click-to-copy. Image entries show a small thumbnail (resized to 96x96 via Electron's `nativeImage.resize()` before storing, to keep memory bounded) but are **view-only** — clicking wouldn't restore the original resolution, just the downscaled thumbnail, which would be a misleading "copy," so that's deliberately not wired up.
- Doesn't capture files copied from Explorer (no image/text clipboard format, out of scope for this node).
- The `refreshMs` in `node.json` (2000ms) just controls how often the *tile* re-renders to pick up new entries; the actual clipboard polling runs on its own faster 1.5s interval in `collector.js` so nothing gets missed between tile refreshes.
