const fs = require('fs');
const path = require('path');
const { execFile, spawn } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const LIST_WINDOWS_SCRIPT = path.join(__dirname, 'list-editor-windows.ps1');
const FOCUS_WINDOW_SCRIPT = path.join(__dirname, 'focus-window.ps1');
const STORAGE_JSON = path.join(process.env.APPDATA || '', 'Code', 'User', 'globalStorage', 'storage.json');

async function listEditorWindows() {
  try {
    const { stdout } = await execFileP(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', LIST_WINDOWS_SCRIPT],
      { timeout: 8000, maxBuffer: 2 * 1024 * 1024 }
    );
    const parsed = JSON.parse(stdout.trim() || '[]');
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return [];
  }
}

// "file:///c%3A/Users/you/Jarvis" -> "C:\Users\you\Jarvis"
function decodeFileUri(uri) {
  if (!uri || !uri.startsWith('file:///')) return null;
  const decoded = decodeURIComponent(uri.slice(8));
  return decoded.replace(/\//g, '\\');
}

// VS Code doesn't keep a plain "recent folders" list anymore (moved to a
// SQLite state.vscdb in newer versions) - but globalStorage/storage.json's
// windowsState + backupWorkspaces sections still expose the currently/most
// recently open folder paths as file:// URIs, which is enough to find real
// project roots without needing a SQLite dependency.
function readKnownVsCodeFolders() {
  try {
    const raw = JSON.parse(fs.readFileSync(STORAGE_JSON, 'utf-8').replace(/^\uFEFF/, ''));
    const uris = new Set();
    if (raw.windowsState?.lastActiveWindow?.folder) uris.add(raw.windowsState.lastActiveWindow.folder);
    (raw.windowsState?.openedWindows || []).forEach((w) => w.folder && uris.add(w.folder));
    (raw.backupWorkspaces?.folders || []).forEach((f) => f.folderUri && uris.add(f.folderUri));
    return [...uris].map(decodeFileUri).filter(Boolean);
  } catch {
    return [];
  }
}

async function gitStatus(repoPath) {
  if (!fs.existsSync(path.join(repoPath, '.git'))) return null;
  const opts = { cwd: repoPath, timeout: 5000 };
  try {
    const [branchRes, dirtyRes] = await Promise.all([
      execFileP('git', ['rev-parse', '--abbrev-ref', 'HEAD'], opts),
      execFileP('git', ['status', '--porcelain'], opts),
    ]);
    const branch = branchRes.stdout.trim();
    const dirtyCount = dirtyRes.stdout.split('\n').filter((l) => l.trim()).length;
    let ahead = 0;
    let behind = 0;
    try {
      const { stdout } = await execFileP('git', ['rev-list', '--left-right', '--count', 'HEAD...@{u}'], opts);
      const [a, b] = stdout.trim().split(/\s+/).map(Number);
      ahead = a || 0;
      behind = b || 0;
    } catch {
      // No upstream configured for this branch - ahead/behind just stay 0.
    }
    return { branch, dirtyCount, ahead, behind };
  } catch {
    return null;
  }
}

async function getStatus() {
  const [windows, folders] = await Promise.all([listEditorWindows(), readKnownVsCodeFolders()]);

  const openFolderNames = new Set(
    windows
      .map((w) => {
        // VS Code window titles: "file - folder - Visual Studio Code" or
        // just "folder - Visual Studio Code" with no file focused.
        const parts = w.title.split(' - ');
        return parts.length >= 2 ? parts[parts.length - 2].trim().toLowerCase() : null;
      })
      .filter(Boolean)
  );

  const projects = (
    await Promise.all(
      folders.slice(0, 12).map(async (folderPath) => {
        const git = await gitStatus(folderPath);
        if (!git) return null;
        const name = path.basename(folderPath);
        return { name, path: folderPath, open: openFolderNames.has(name.toLowerCase()), git };
      })
    )
  ).filter(Boolean);

  return {
    name: 'dev-workspace',
    state: 'ok',
    metrics: { windows, projects },
    lastUpdated: new Date().toISOString(),
  };
}

async function focusWindow(pid) {
  await execFileP(
    'powershell.exe',
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', FOCUS_WINDOW_SCRIPT, '-ProcId', String(pid)],
    { timeout: 5000 }
  );
}

function openInEditor(folderPath) {
  spawn('code.cmd', [folderPath], { detached: true, stdio: 'ignore', shell: true }).unref();
}

module.exports = { getStatus, focusWindow, openInEditor };
