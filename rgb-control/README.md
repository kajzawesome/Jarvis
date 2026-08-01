# rgb-control

Live RGB device list + color control (OpenRGB, not just a launcher shortcut).

## Status: 🟢 active (code ready — needs OpenRGB's SDK Server enabled to actually connect)

## Setup

1. Open OpenRGB.
2. Go to the **SDK Server** tab, click **Start Server** (status should show "online"). It listens on `127.0.0.1:6742` by default — matches `collector.js`, no config needed unless you've changed OpenRGB's port.
3. Until the server's running, the tile shows a **LAUNCH OPENRGB** button instead of erroring.

**Now running automatically**: `dashboard/node-dependencies-autostart.ps1` created a Windows Startup-folder shortcut for OpenRGB with `--server --startminimized`, so it should already be up (SDK server included) by the time Jarvis launches after a reboot. If the tile still shows "not running" after a reboot, open OpenRGB manually once and check the SDK Server tab's own "Start Server" checkbox is saved on — that's a persisted app setting independent of the CLI flag, and the more reliable fallback if `--server` doesn't behave as expected on this OpenRGB build (its exact CLI flags couldn't be verified from here — it's a GUI-subsystem app with no accessible `--help` output).

## How it works

Uses [`openrgb-sdk`](https://www.npmjs.com/package/openrgb-sdk) (the OpenRGB SDK's binary TCP protocol, not HTTP — this npm package handles the protocol details). Each device gets a name/LED count/active mode plus 6 preset color swatches and a native color picker for anything else — clicking either calls `updateLeds` to set that device to a solid color across all its LEDs (not per-LED patterns/effects, just a flat color push).

## Known limitation

Only sets a single solid color per device — doesn't expose OpenRGB's built-in effects (rainbow, breathing, etc.) or per-zone/per-LED control, both of which the underlying SDK supports if you want to extend `collector.js`'s `setColor()`.
