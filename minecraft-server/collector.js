const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const readline = require('readline');
const net = require('net');
const fs = require('fs');
const path = require('path');
const execFileP = promisify(execFile);

// Hardcoded to this machine's actual home-stack location. Update these two
// paths if the project ever moves.
const HOME_STACK_DIR = 'C:\\Users\\USERNAME\\Desktop\\new server\\home-stack';
const ENV_PATH = path.join(HOME_STACK_DIR, '.env');
const PAPER_DIR = path.join(HOME_STACK_DIR, 'paper');

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

function readRelayAddr() {
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
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
    checkRelay(readRelayAddr()),
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
  return execFileP('docker', ['compose', ...args], { cwd: HOME_STACK_DIR, timeout: 120000 });
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
  require('electron').shell.openPath(PAPER_DIR);
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
  HOME_STACK_DIR,
  PAPER_DIR,
};
