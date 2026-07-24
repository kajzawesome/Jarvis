const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const DOCKER_DESKTOP_EXE = 'C:\\Program Files\\Docker\\Docker\\frontend\\Docker Desktop.exe';

async function dockerJson(args) {
  const { stdout } = await execFileP('docker', args, { timeout: 8000 });
  return stdout
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

async function getStatus() {
  try {
    const [images, containers] = await Promise.all([
      dockerJson(['images', '--format', '{{json .}}']),
      dockerJson(['ps', '-a', '--format', '{{json .}}']),
    ]);

    return {
      name: 'docker-images',
      state: 'ok',
      metrics: {
        images: images.map((i) => ({
          repo: i.Repository,
          tag: i.Tag,
          size: i.Size,
          id: i.ID,
        })),
        containers: containers.map((c) => ({
          name: c.Names,
          image: c.Image,
          status: c.Status,
          running: (c.State || '').toLowerCase() === 'running',
        })),
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    const daemonDown = /pipe|dockerDesktopLinuxEngine|cannot connect/i.test(err.message || '');
    return {
      name: 'docker-images',
      state: daemonDown ? 'daemon_down' : 'error',
      metrics: { error: err.message },
      lastUpdated: new Date().toISOString(),
    };
  }
}

function launchDockerDesktop() {
  require('electron').shell.openPath(DOCKER_DESKTOP_EXE);
}

async function getLogs(containerName, tailLines = 100) {
  try {
    const { stdout, stderr } = await execFileP('docker', ['logs', '--tail', String(tailLines), containerName], {
      timeout: 8000,
      maxBuffer: 2 * 1024 * 1024,
    });
    return (stdout + stderr) || '(no output)';
  } catch (err) {
    return `error fetching logs: ${err.message}`;
  }
}

module.exports = { getStatus, launchDockerDesktop, getLogs };
