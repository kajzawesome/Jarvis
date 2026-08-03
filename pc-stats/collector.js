const si = require('systeminformation');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

function pickRealGpu(controllers) {
  if (!controllers || !controllers.length) return null;
  // systeminformation lists virtual/software adapters (e.g. VR passthrough
  // monitors) alongside real GPUs - prefer the one with actual VRAM + a
  // reported utilization reading over just taking controllers[0].
  return (
    controllers.find((c) => c.vram > 0 && c.utilizationGpu != null) ||
    controllers.find((c) => c.vram > 0) ||
    controllers[0]
  );
}

// Both of these shell out to a whole separate process (nvidia-smi, or a
// full powershell.exe running a WMI query) - real CPU/process-spawn cost,
// noticeable when it's competing with something like a game for resources.
// Fan/temp sensors don't need to be as fresh as CPU%/RAM%, so these are
// cached independently of the main refresh cadence rather than re-spawned
// on every single getStats() call.
const SENSOR_CACHE_MS = 20000;
let sensorCache = { at: 0, nvidiaFanPct: null, lhmSensors: null };

async function queryNvidiaFanPct() {
  try {
    const { stdout } = await execFileP(
      'nvidia-smi',
      ['--query-gpu=fan.speed', '--format=csv,noheader,nounits'],
      { timeout: 3000 }
    );
    const val = parseFloat(stdout.trim());
    return Number.isFinite(val) ? val : null;
  } catch {
    return null;
  }
}

// Best-effort: only returns data once LibreHardwareMonitor is installed and
// running (it publishes a WMI namespace while open). Returns null otherwise
// so callers can fall back gracefully - no hard dependency on it existing.
async function queryLibreHardwareMonitorSensors() {
  try {
    const script =
      "Get-CimInstance -Namespace root/LibreHardwareMonitor -ClassName Sensor -ErrorAction Stop | " +
      "Where-Object { $_.SensorType -in @('Temperature','Fan') } | " +
      'Select-Object Name,SensorType,Value | ConvertTo-Json -Compress';
    const { stdout } = await execFileP(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 4000 }
    );
    if (!stdout || !stdout.trim()) return null;
    const parsed = JSON.parse(stdout);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return null;
  }
}

async function getCachedSensors(isNvidia) {
  if (Date.now() - sensorCache.at < SENSOR_CACHE_MS) return sensorCache;
  const [nvidiaFanPct, lhmSensors] = await Promise.all([
    isNvidia ? queryNvidiaFanPct() : Promise.resolve(null),
    queryLibreHardwareMonitorSensors(),
  ]);
  sensorCache = { at: Date.now(), nvidiaFanPct, lhmSensors };
  return sensorCache;
}

async function getStats() {
  const [cpu, cpuTemp, mem, fsSize, currentLoad, time, graphics] = await Promise.all([
    si.cpu(),
    si.cpuTemperature(),
    si.mem(),
    si.fsSize(),
    si.currentLoad(),
    si.time(),
    si.graphics().catch(() => ({ controllers: [] })),
  ]);

  const gc = pickRealGpu(graphics.controllers);
  const isNvidia = gc && /nvidia/i.test(gc.vendor || gc.model || '');

  const { nvidiaFanPct, lhmSensors } = await getCachedSensors(isNvidia);

  let gpu = null;
  if (gc) {
    gpu = {
      model: gc.model || 'Unknown GPU',
      utilization_pct: gc.utilizationGpu ?? null,
      vram_used_mb: gc.memoryUsed ?? null,
      vram_total_mb: gc.memoryTotal ?? null,
      temp_c: gc.temperatureGpu ?? null,
      power_draw_w: gc.powerDraw ?? null,
      fan_pct: nvidiaFanPct,
    };
  }

  let cpuTempC = cpuTemp.main ?? null;
  let cpuFanRpm = null;
  if (lhmSensors) {
    const tempRow = lhmSensors.find((r) => r.SensorType === 'Temperature' && /cpu/i.test(r.Name));
    if (tempRow && cpuTempC == null) cpuTempC = Math.round(tempRow.Value * 10) / 10;
    const fanRow = lhmSensors.find((r) => r.SensorType === 'Fan' && /cpu/i.test(r.Name));
    if (fanRow) cpuFanRpm = Math.round(fanRow.Value);
  }

  return {
    name: 'pc-stats',
    state: 'ok',
    metrics: {
      cpu_model: cpu.manufacturer + ' ' + cpu.brand,
      cpu_pct: Math.round(currentLoad.currentLoad * 10) / 10,
      cpu_temp_c: cpuTempC,
      cpu_fan_rpm: cpuFanRpm,
      cpu_cores: cpu.cores,
      sensors_available: !!lhmSensors,
      ram_used_gb: Math.round((mem.active / 1e9) * 10) / 10,
      ram_total_gb: Math.round((mem.total / 1e9) * 10) / 10,
      ram_pct: Math.round((mem.active / mem.total) * 1000) / 10,
      disks: fsSize.map((d) => ({
        mount: d.mount,
        used_gb: Math.round((d.used / 1e9) * 10) / 10,
        size_gb: Math.round((d.size / 1e9) * 10) / 10,
        used_pct: Math.round(d.use * 10) / 10,
      })),
      uptime_s: time.uptime,
      gpu,
    },
    lastUpdated: new Date().toISOString(),
  };
}

module.exports = { getStats };
