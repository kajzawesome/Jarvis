# pc-stats

Local machine telemetry — the "vitals" readout for whatever box Jarvis is running on.

## Status: 🟢 active (built — see `node.json`, `collector.js`, `widget.js`)

## What it covers

- CPU: load %, temp, fan RPM, model, core count
- GPU: utilization, VRAM, temp, power draw, fan % (auto-detects the real GPU controller, not virtual/passthrough display adapters `systeminformation` also reports)
- RAM: used/total/%
- Disk: usage per volume
- Uptime

## Data sources

- **[systeminformation](https://www.npmjs.com/package/systeminformation)** (npm) — CPU/RAM/disk/uptime/graphics, no extra install. `si.graphics()` lists every controller reported by Windows, which can include virtual adapters (e.g. VR passthrough) alongside the real GPU — `collector.js` filters for the one with actual VRAM + a utilization reading.
- **`nvidia-smi`** (NVIDIA only, shells out via `child_process`) — GPU fan % isn't in `systeminformation`; `nvidia-smi --query-gpu=fan.speed` fills that gap.
- **LibreHardwareMonitor** (optional, not installed by default) — CPU temp/fan aren't reliably exposed via WMI without it. `collector.js` best-effort queries `root/LibreHardwareMonitor` via PowerShell (`Get-CimInstance`) and silently returns nulls if it's not running — install and run LibreHardwareMonitor (it auto-registers the WMI namespace while open, no config needed) and CPU temp/fan will start populating on the next refresh, no code changes required. The tile shows a hint when this data is unavailable.

## Build notes

- Fully local/offline — no cloud dependency, no secrets.
- Fan-name matching against LibreHardwareMonitor's sensor list is a `/cpu/i` heuristic on the sensor `Name` field, which varies by motherboard — if it doesn't pick up your board's CPU fan sensor, check the actual sensor names (`Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor`) and adjust the regex in `collector.js`.
