const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const readline = require('readline');
const net = require('net');
const fs = require('fs');
const path = require('path');
const execFileP = promisify(execFile);

// This node was written for one specific self-hosted setup: a Docker
// Compose stack with a Paper container + a tunnel-client that dials out to
// a relay (see the README) - not a generic "any Minecraft server" node.
// Wasn't portable at all until this pointed at a real absolute path baked
// into the code - now it's read from Jarvis's own root .env (same pattern
// as every other node's credentials), and gracefully shows "not
// configured" instead of erroring when it's unset. Set MC_HOME_STACK_DIR
// in .env to the folder containing your stack's docker-compose.yml, or
// leave it unset if this doesn't match your setup at all.
const JARVIS_ENV_PATH = path.join(__dirname, '..', '.env');

function readJarvisEnv() {
  const env = {};
  try {
    const content = fs.readFileSync(JARVIS_ENV_PATH, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    });
  } catch {
    // no .env yet - treated as not configured below
  }
  return env;
}

function getHomeStackDir() {
  return readJarvisEnv().MC_HOME_STACK_DIR || null;
}

const CONTAINERS = [
  { name: 'Paper', container: 'mc-paper' },
  { name: 'Tunnel-client', container: 'mc-tunnel-client' },
  { name: 'Monitor', container: 'mc-monitor' },
];
const DOCKER_DESKTOP_EXE = 'C:\\Program Files\\Docker\\Docker\\frontend\\Docker Desktop.exe';

// Distinguishes "Docker Desktop isn't running at all" from "it's running
// but these containers are stopped" - both would otherwise collapse into
// the same "not found" result from containerStatus() below.
async function isDockerDaemonUp() {
  try {
    await execFileP('docker', ['info'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

async function containerStatus(containerName) {
  try {
    const { stdout } = await execFileP(
      'docker',
      ['inspect', '--format', '{{.State.Status}}', containerName],
      { timeout: 5000 }
    );
    return stdout.trim() || 'not found';
  } catch {
    return 'not found';
  }
}

// RELAY_ADDR lives in the home-stack's OWN .env (a different file from
// Jarvis's root .env) - only that one line is read, no other secrets in
// that file are touched.
function readRelayAddr(homeStackDir) {
  try {
    const content = fs.readFileSync(path.join(homeStackDir, '.env'), 'utf-8');
    const match = content.match(/^RELAY_ADDR=(.+)$/m);
    return match ? match[1].trim() : null;
  } catch {
    return null;
  }
}

function checkRelay(addr) {
  return new Promise((resolve) => {
    const m = addr && addr.match(/^(.+):(\d+)$/);
    if (!m) {
      resolve({ ok: false, text: 'RELAY_ADDR not set' });
      return;
    }
    const relayHost = m[1];
    const port = parseInt(m[2], 10);
    const socket = new net.Socket();
    const finish = (ok) => {
      socket.destroy();
      resolve({ ok, text: `${ok ? 'reachable' : 'unreachable'} (${relayHost}:${port})` });
    };
    socket.setTimeout(5000);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, relayHost);
  });
}

async function getStatus() {
  const homeStackDir = getHomeStackDir();
  if (!homeStackDir) {
    return {
      name: 'minecraft-server',
      state: 'not_configured',
      metrics: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  const daemonUp = await isDockerDaemonUp();
  if (!daemonUp) {
    return {
      name: 'minecraft-server',
      state: 'daemon_down',
      metrics: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  const [containers, relay] = await Promise.all([
    Promise.all(CONTAINERS.map(async (c) => ({ name: c.name, status: await containerStatus(c.container) }))),
    checkRelay(readRelayAddr(homeStackDir)),
  ]);

  const allRunning = containers.every((c) => c.status === 'running') && relay.ok;
  const noneUp = containers.every((c) => c.status === 'not found' || c.status === 'exited');
  const state = allRunning ? 'running' : noneUp ? 'stopped' : 'partial';

  return {
    name: 'minecraft-server',
    state,
    metrics: { containers, relay },
    lastUpdated: new Date().toISOString(),
  };
}

function launchDockerDesktop() {
  require('electron').shell.openPath(DOCKER_DESKTOP_EXE);
}

function runCompose(args) {
  const homeStackDir = getHomeStackDir();
  if (!homeStackDir) throw new Error('MC_HOME_STACK_DIR not set in .env');
  return execFileP('docker', ['compose', ...args], { cwd: homeStackDir, timeout: 120000 });
}

async function startServer() {
  await runCompose(['up', '-d']);
}

async function stopServer() {
  await runCompose(['down']);
}

async function restartServer() {
  await runCompose(['restart']);
}

function openServerFiles() {
  const homeStackDir = getHomeStackDir();
  if (!homeStackDir) return;
  require('electron').shell.openPath(path.join(homeStackDir, 'paper'));
}

// Paper's port isn't reachable from the host (see README), so join/leave
// events come from tailing the container's own log output instead - the
// same "joined/left the game" lines vanilla Minecraft always prints.
let logProcess = null;

function watchJoinLeave(onEvent) {
  if (logProcess) return;
  logProcess = spawn('docker', ['logs', '-f', '--since', '0s', 'mc-paper']);
  const rl = readline.createInterface({ input: logProcess.stdout });
  rl.on('line', (line) => {
    const joinMatch = line.match(/]: (\w+) joined the game/);
    const leaveMatch = line.match(/]: (\w+) left the game/);
    if (joinMatch) onEvent({ type: 'join', player: joinMatch[1] });
    else if (leaveMatch) onEvent({ type: 'leave', player: leaveMatch[1] });
  });
  const clear = () => {
    logProcess = null;
  };
  logProcess.on('exit', clear);
  logProcess.on('error', clear);
}

function stopWatchingLogs() {
  if (logProcess) {
    logProcess.kill();
    logProcess = null;
  }
}

module.exports = {
  getStatus,
  startServer,
  stopServer,
  restartServer,
  openServerFiles,
  watchJoinLeave,
  stopWatchingLogs,
  launchDockerDesktop,
};
