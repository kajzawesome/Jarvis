# voice-control

Speak a fixed set of commands to control the dashboard — no API key, no cost, nothing sent to a third-party AI. Click **SPEAK A COMMAND**, say one of the phrases listed on the tile, and it runs immediately.

## Status: 🟡 built, needs live mic verification

## ⚠️ Important caveat

This uses the browser's built-in `SpeechRecognition` API (Chromium/Electron's implementation of the Web Speech API). Electron's support for this has historically been inconsistent — some versions need an internet connection (routes audio to Google's speech service), and it isn't always enabled in every Electron build. **I couldn't test this end-to-end myself** (no way to speak into a microphone from here) — the tile will show "Speech recognition isn't available in this Electron build" if the API genuinely doesn't exist in this Electron version, but if it exists and just doesn't work well in practice (bad accuracy, doesn't pick up audio, etc.), you'll need to tell me what actually happens when you try it.

**If it doesn't work at all**, the realistic fallback is a real local speech-to-text engine (e.g. `whisper.cpp` or `vosk` running locally, no cloud dependency) wired in instead of the browser API — a bigger lift, not started.

## Commands (see `COMMANDS` in `collector.js` for the exact list + patterns)

- "focus mode" / "focus layout" — switch to the `focus` preset
- "default layout" — switch to the `default` preset
- "start minecraft" / "stop minecraft" — start/stop the MC server stack
- "minecraft status" — reports up/down
- "start timer" / "pause timer" — pomodoro controls
- "run speed test" — triggers the network speed test
- "cpu usage" — reports current CPU load
- "turn rgb red/green/blue/white/off" — sets all detected OpenRGB devices to a color

## Adding more commands

Each entry in `COMMANDS` (in `collector.js`) is `{ patterns: [RegExp, ...], description, run(transcript) }` — patterns are tried in order, first match wins, `run()` does the actual work (usually calling another node's `collector.js` directly — see `loadSibling()`) and returns a short string that gets toasted back to you so you know it registered. Add a new entry there for any other action you want voice-controlled; no other wiring needed, the widget just reads the list to render both the recognizer's command matching and the on-tile reference list.

## Design choice: fixed commands, not full AI

This is deliberately *not* full natural-language AI control — that would need a real LLM API key (cost per request) and a proper tool-calling agent loop (a much bigger, separate build). This version is free, local, and limited to whatever's explicitly listed above — a reasonable "phase 1" that can be swapped for the bigger version later if wanted, without changing how any node reacts (the command handlers already just call each node's existing `collector.js` functions directly, same as a "full AI" version's tool calls would).
