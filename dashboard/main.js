const { app, BrowserWindow, screen, ipcMain, globalShortcut, dialog, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
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
      fullscreen: true,
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

app.whenReady().then(() => {
  const cfg = readConfig();
  applyAutostart(cfg.autostart !== false);

  createWindows();
  createTray();

  globalShortcut.register('Control+Alt+J', toggleAllWindows);

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
