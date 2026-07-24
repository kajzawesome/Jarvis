const path = require('path');
const { readLayouts } = require('../dashboard/layouts-store');

function loadSibling(nodeDir, file) {
  return require(path.join(__dirname, '..', nodeDir, file));
}

// Each command is tried in order; the first whose pattern matches the
// transcript runs. Add more here as needed - `run()` returns a short
// string that gets spoken back via a toast, so you know it registered.
const COMMANDS = [
  {
    patterns: [/\b(focus|study|school)\b.*\b(mode|layout|preset)?\b/i, /^focus$/i],
    description: '"focus mode" / "focus layout" - switch to the focus preset',
    run: () => {
      const ok = window.jarvisSwitchPreset && window.jarvisSwitchPreset('focus');
      return ok ? 'Switched to focus layout' : 'No "focus" preset saved yet';
    },
  },
  {
    patterns: [/\bdefault\b.*\b(mode|layout|preset)?\b/i],
    description: '"default layout" - switch to the default preset',
    run: () => {
      const ok = window.jarvisSwitchPreset && window.jarvisSwitchPreset('default');
      return ok ? 'Switched to default layout' : 'No "default" preset saved yet';
    },
  },
  {
    patterns: [/\b(start|launch)\b.*\b(minecraft|mc)\b/i],
    description: '"start minecraft" - starts the MC server stack',
    run: async () => {
      await loadSibling('minecraft-server', 'collector.js').startServer();
      return 'Starting Minecraft server';
    },
  },
  {
    patterns: [/\bstop\b.*\b(minecraft|mc)\b/i],
    description: '"stop minecraft" - stops the MC server stack',
    run: async () => {
      await loadSibling('minecraft-server', 'collector.js').stopServer();
      return 'Stopping Minecraft server';
    },
  },
  {
    patterns: [/\b(is|check)\b.*\b(minecraft|mc)\b.*\b(up|online|running)\b/i, /\bminecraft status\b/i],
    description: '"minecraft status" - reports whether the server is up',
    run: async () => {
      const status = await loadSibling('minecraft-server', 'collector.js').getStatus();
      return `Minecraft server is ${status.state}`;
    },
  },
  {
    patterns: [/\b(start|resume)\b.*\b(pomodoro|timer|focus timer)\b/i],
    description: '"start timer" - starts/resumes the pomodoro timer',
    run: async () => {
      loadSibling('pomodoro', 'collector.js').start();
      return 'Timer started';
    },
  },
  {
    patterns: [/\bpause\b.*\b(pomodoro|timer)\b/i],
    description: '"pause timer" - pauses the pomodoro timer',
    run: async () => {
      loadSibling('pomodoro', 'collector.js').pause();
      return 'Timer paused';
    },
  },
  {
    patterns: [/\b(run|start)\b.*\b(speed test|network test)\b/i],
    description: '"run speed test" - runs the network speed test',
    run: async () => {
      loadSibling('network-speed', 'collector.js').runTest();
      return 'Running speed test';
    },
  },
  {
    patterns: [/\bcpu\b.*\b(usage|load)?\b/i],
    description: '"cpu usage" - reports current CPU load',
    run: async () => {
      const stats = await loadSibling('pc-stats', 'collector.js').getStats();
      return `CPU is at ${stats.metrics.cpu_pct}%`;
    },
  },
  {
    patterns: [/\brgb\b.*\b(red|green|blue|white|off)\b/i],
    description: '"turn rgb <color>" - sets all detected RGB devices to a color',
    run: async (transcript) => {
      const colorMap = { red: '#ff0000', green: '#00ff9c', blue: '#0066ff', white: '#ffffff', off: '#000000' };
      const colorWord = Object.keys(colorMap).find((c) => transcript.includes(c));
      const rgb = loadSibling('rgb-control', 'collector.js');
      const status = await rgb.getStatus();
      if (status.state !== 'ok') return 'OpenRGB is not reachable';
      await Promise.all(status.metrics.devices.map((d) => rgb.setColor(d.id, colorMap[colorWord])));
      return `Set RGB to ${colorWord}`;
    },
  },
];

function matchCommand(transcript) {
  const lower = transcript.toLowerCase().trim();
  return COMMANDS.find((c) => c.patterns.some((p) => p.test(lower)));
}

async function runTranscript(transcript) {
  const command = matchCommand(transcript);
  if (!command) return { matched: false, message: `No command matched: "${transcript}"` };
  try {
    const message = await command.run(transcript.toLowerCase());
    return { matched: true, message };
  } catch (err) {
    return { matched: true, message: `Command failed: ${err.message}` };
  }
}

async function getStatus() {
  const supported = typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  return {
    name: 'voice-control',
    state: supported ? 'ok' : 'unsupported',
    metrics: { commands: COMMANDS.map((c) => c.description) },
    lastUpdated: new Date().toISOString(),
  };
}

module.exports = { getStatus, runTranscript, COMMANDS };
