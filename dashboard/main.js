const { app, BrowserWindow, screen, ipcMain, globalShortcut, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { readLayouts, writeLayouts } = require('./layouts-store');

let isQuitting = false;
let tray = null;

const CONFIG_PATH = path.join(__dirname, 'config.json');

function readConfig() {
  if (!fs.existsSync(CONFIG_PATH)) return { autostart: true };
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return { autostart: true };
  }
}

function writeConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
}

function applyAutostart(enabled) {
  // In dev (unpackaged) this launches via the electron binary + this app's
  // directory. Once packaged with electron-builder, path/args should be
  // dropped so it points at the built executable instead.
  app.setLoginItemSettings({
    openAtLogin: enabled,
    path: process.execPath,
    args: [path.join(__dirname, '..')],
  });
}

const windows = [];

function createWindows() {
  // Left-to-right order so "screen index" matches how the monitors are
  // physically laid out, independent of which one Windows calls "primary".
  const displays = [...screen.getAllDisplays()].sort((a, b) => a.bounds.x - b.bounds.x);
  const primaryId = screen.getPrimaryDisplay().id;

  displays.forEach((display, index) => {
    const isPrimary = display.id === primaryId;
    const win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      // Deliberately NOT fullscreen:true - on Windows that's "exclusive
      // fullscreen" (the same mode a game/video player uses), which
      // suppresses the taskbar entirely: no hover, no click, nothing gets
      // through until the app exits fullscreen. Sizing the window to the
      // full display bounds without setting fullscreen still visually
      // fills the screen (same pixels), but Windows keeps the shell
      // taskbar as its own always-on-top surface on top of a plain window,
      // so it stays reachable without needing Ctrl+Alt+J to hide Jarvis
      // first every time.
      fullscreen: false,
      show: false,
      backgroundColor: '#020403',
      skipTaskbar: !isPrimary,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
      },
    });

    win.loadFile(path.join(__dirname, 'renderer', 'index.html'), {
      search: `screen=${index}&primary=${isPrimary ? '1' : '0'}&totalScreens=${displays.length}`,
    });

    win.once('ready-to-show', () => win.show());
    // Closing a window (Alt+F4, taskbar close, etc.) just hides it - the
    // tray icon is the only way to actually quit, so state/timers survive.
    win.on('close', (e) => {
      if (!isQuitting) {
        e.preventDefault();
        win.hide();
      }
    });
    windows.push(win);
  });
}

// Monitors plugged/unplugged/moved while Jarvis is already running. Screen
// *index* is derived from left-to-right sort order (see createWindows), so
// adding a monitor to the left of existing ones shifts every other index -
// trying to patch individual windows in place risks silently mismatching
// which physical screen shows which saved layout. Full teardown + rebuild
// sidesteps that entirely at the cost of resetting any in-memory-only node
// state (pomodoro's timer, clipboard history, etc. - anything not persisted
// to disk) - an acceptable trade for an infrequent event, and everything
// that matters (layouts, task lists, links) is disk-backed anyway.
let recreateTimer = null;

function recreateWindows() {
  const old = windows.splice(0, windows.length);
  old.forEach((w) => !w.isDestroyed() && w.destroy());
  createWindows();
}

function scheduleRecreate() {
  // Windows can fire multiple display-changed events in quick succession
  // while it settles a new monitor configuration - debounce so this only
  // rebuilds once, after things stop changing.
  clearTimeout(recreateTimer);
  recreateTimer = setTimeout(recreateWindows, 1000);
}

function toggleAllWindows() {
  const anyVisible = windows.some((w) => !w.isDestroyed() && w.isVisible());
  windows.forEach((w) => {
    if (w.isDestroyed()) return;
    if (anyVisible) w.hide();
    else w.show();
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'assets', 'tray-icon.png');
  tray = new Tray(nativeImage.createFromPath(iconPath));
  tray.setToolTip('J.A.R.V.I.S.');

  const rebuildMenu = () => {
    const autostartOn = readConfig().autostart !== false;
    const menu = Menu.buildFromTemplate([
      { label: 'Show / Hide All', click: toggleAllWindows },
      { type: 'separator' },
      {
        label: 'Autostart on Login',
        type: 'checkbox',
        checked: autostartOn,
        click: () => {
          const cfg = readConfig();
          const next = !(cfg.autostart !== false);
          cfg.autostart = next;
          writeConfig(cfg);
          applyAutostart(next);
          rebuildMenu();
        },
      },
      { type: 'separator' },
      {
        label: 'Quit Jarvis',
        click: () => {
          isQuitting = true;
          app.quit();
        },
      },
    ]);
    tray.setContextMenu(menu);
  };

  rebuildMenu();
  tray.on('double-click', toggleAllWindows);
}

// Keeps desktop-links in sync with the real Windows Desktop on every
// launch, using the same merge-safe script as the manual re-sync (see
// desktop-links/migrate-from-desktop.ps1) - safe to run unattended since it
// only appends newly-discovered targets and respects excluded.json, never
// overwriting links added/edited from the dashboard itself. Runs once here
// (not per-window/per-collector-call) so two copies of the script can't
// race on writing links.json when multiple screens are open.
function syncDesktopLinks() {
  const script = path.join(__dirname, '..', 'desktop-links', 'migrate-from-desktop.ps1');
  execFile('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script], { timeout: 30000 }, (err) => {
    if (err) {
      console.error('desktop-links startup sync failed:', err.message);
      return;
    }
    windows.forEach((w) => !w.isDestroyed() && w.webContents.send('force-refresh-node', 'desktop-links'));
  });
}

app.whenReady().then(() => {
  const cfg = readConfig();
  applyAutostart(cfg.autostart !== false);

  createWindows();
  createTray();
  syncDesktopLinks();

  globalShortcut.register('Control+Alt+J', toggleAllWindows);

  screen.on('display-added', scheduleRecreate);
  screen.on('display-removed', scheduleRecreate);
  screen.on('display-metrics-changed', scheduleRecreate);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindows();
  });
});

app.on('window-all-closed', () => {
  // Windows only "close" for real during an actual quit (see the close
  // handler above) - nothing to do here, the tray keeps the app alive.
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

ipcMain.on('window-minimize', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.minimize();
});

ipcMain.on('window-hide', (event) => {
  BrowserWindow.fromWebContents(event.sender)?.hide();
});

ipcMain.on('layouts-changed', (event) => {
  windows.forEach((w) => {
    if (w.isDestroyed() || w.webContents === event.sender) return;
    w.webContents.send('layouts-changed');
  });
});

// Saving a preset captures whatever every currently-open screen has live in
// its own grid right now, so screens stay linked: switching a preset later
// swaps all of them together. Each window reports its own screen's items;
// once every open window has responded, bundle them into one preset.
let pendingSave = null;

ipcMain.on('save-all-request', (event, presetName) => {
  const openWindows = windows.filter((w) => !w.isDestroyed());
  pendingSave = { presetName, responses: {}, remaining: openWindows.length, initiatorId: event.sender.id };
  openWindows.forEach((w) => w.webContents.send('report-layout'));
});

ipcMain.on('layout-report', (event, screenIndex, items) => {
  if (!pendingSave) return;
  pendingSave.responses[screenIndex] = items;
  pendingSave.remaining -= 1;
  if (pendingSave.remaining <= 0) {
    const layoutsData = readLayouts();
    layoutsData.presets[pendingSave.presetName] = pendingSave.responses;
    layoutsData.activePreset = pendingSave.presetName;
    writeLayouts(layoutsData);
    const { presetName, initiatorId } = pendingSave;
    pendingSave = null;
    windows.forEach((w) => !w.isDestroyed() && w.webContents.send('layouts-changed'));
    const initiator = windows.find((w) => !w.isDestroyed() && w.webContents.id === initiatorId);
    if (initiator) initiator.webContents.send('save-all-complete', presetName);
  }
});

// Deletes a saved preset. Always leaves at least one preset behind (the
// renderer's DELETE PRESET button is already disabled when only one
// remains, but re-checked here too since main.js shouldn't trust the
// renderer alone for something destructive). If the deleted preset was the
// active one, falls back to 'default' if it still exists, otherwise
// whatever preset happens to be first.
ipcMain.on('delete-preset-request', (event, presetName) => {
  const layoutsData = readLayouts();
  const names = Object.keys(layoutsData.presets);
  if (!layoutsData.presets[presetName] || names.length <= 1) return;

  delete layoutsData.presets[presetName];
  if (layoutsData.activePreset === presetName) {
    const remaining = Object.keys(layoutsData.presets);
    layoutsData.activePreset = remaining.includes('default') ? 'default' : remaining[0];
  }
  writeLayouts(layoutsData);

  windows.forEach((w) => !w.isDestroyed() && w.webContents.send('layouts-changed'));
  const initiator = BrowserWindow.fromWebContents(event.sender);
  if (initiator && !initiator.isDestroyed()) {
    initiator.webContents.send('preset-deleted', { presetName, newActivePreset: layoutsData.activePreset });
  }
});

ipcMain.on('toast-broadcast', (event, payload) => {
  // Sender already shows its own toast immediately (see window.jarvisToast
  // in app.js) - only relay to the other screens.
  windows.forEach((w) => {
    if (w.isDestroyed() || w.webContents === event.sender) return;
    w.webContents.send('show-toast', payload);
  });
});

// Cross-window drag-and-drop isn't reliably supported by Chromium/Electron
// between two separate top-level windows (native HTML5 DnD is scoped to a
// single renderer) - this is the alternative: an explicit "move to screen N"
// action. The source only removes its tile once the target confirms it
// actually fit there, so a node can never vanish into a screen with no room.
ipcMain.on('move-node-to-screen', (event, payload) => {
  const targetWin = windows[payload.toScreen];
  if (!targetWin || targetWin.isDestroyed()) return;
  targetWin.webContents.send('receive-moved-node', { ...payload, fromWebContentsId: event.sender.id });
});

ipcMain.on('move-node-result', (event, payload) => {
  const sourceWin = windows.find((w) => !w.isDestroyed() && w.webContents.id === payload.fromWebContentsId);
  if (sourceWin) sourceWin.webContents.send('move-node-result', payload);
});

ipcMain.handle('pick-path', async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('get-autostart', () => {
  return readConfig().autostart !== false;
});

ipcMain.handle('toggle-autostart', () => {
  const cfg = readConfig();
  const next = !(cfg.autostart !== false);
  cfg.autostart = next;
  writeConfig(cfg);
  applyAutostart(next);
  return next;
});
