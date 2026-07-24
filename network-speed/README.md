# network-speed

Download/upload speed test, manual trigger only.

## Status: 🟢 active

## Why manual, not automatic

A real speed test moves real bandwidth (10MB down + 5MB up per run) — that shouldn't fire on a background timer while you're streaming or gaming. `refreshMs: 0` in `node.json` means this tile never auto-refreshes; click **RUN TEST** whenever you actually want a reading.

Uses [Cloudflare's public speed-test endpoints](https://speed.cloudflare.com) — no CLI install (Ookla's official CLI isn't installed on this machine), no API key.
