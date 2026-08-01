# streamlabs

Start/stop streaming and recording from the HUD, mirroring the minecraft-server start/stop tile.

## Status: 🟢 active — live-tested and working

Confirmed against Streamlabs Desktop 1.21.7: status query (`streaming`/`recording` state) connects and returns real data. Talks to Streamlabs Desktop's local Remote Control WebSocket API (`ws://127.0.0.1:59650/api/websocket`, JSON-RPC 2.0 — the same protocol its official mobile remote-control app uses), auth via a `TcpServerService` call, status via `getModel` on `StreamingService`.

Note the toggle actions (`toggleStreaming`/`toggleRecording`) weren't exercised during testing (didn't actually start a stream/recording to verify) — the status read path is confirmed, the write path should work by the same protocol but hasn't been explicitly clicked-and-confirmed.

## Setup

1. Open Streamlabs Desktop → Settings → **Remote Control**.
2. Enable it, copy the **API Token** shown there.
3. Add to [.env](../.env):
   ```
   STREAMLABS_API_TOKEN=<your token>
   ```
4. Streamlabs Desktop needs to actually be running for this to connect — if it's not, the tile will show a connection error rather than "not configured" (that state specifically means the token itself is missing).

**Now running automatically**: `dashboard/node-dependencies-autostart.ps1` created a Windows Startup-folder shortcut for Streamlabs Desktop, so it should already be up by the time Jarvis launches after a reboot — Remote Control itself doesn't need a launch flag, it's a setting saved inside Streamlabs that persists once enabled.
