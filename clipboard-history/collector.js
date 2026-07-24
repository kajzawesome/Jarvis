const { clipboard } = require('electron');

const MAX_HISTORY = 15;
const POLL_MS = 1500;
const THUMB_SIZE = 96;

let history = [];
let lastValue = null;
let lastImageDataUrl = null;
let pollerStarted = false;

function pollOnce() {
  const formats = clipboard.availableFormats();
  const hasImage = formats.some((f) => f.startsWith('image/'));

  if (hasImage) {
    const img = clipboard.readImage();
    if (img.isEmpty()) return;
    const dataUrl = img.toDataURL();
    if (dataUrl === lastImageDataUrl) return;
    lastImageDataUrl = dataUrl;
    const thumb = img.resize({ width: THUMB_SIZE, height: THUMB_SIZE }).toDataURL();
    history = [{ type: 'image', thumb }, ...history].slice(0, MAX_HISTORY);
    return;
  }

  const current = clipboard.readText();
  if (current && current !== lastValue) {
    lastValue = current;
    history = [
      { type: 'text', value: current },
      ...history.filter((h) => !(h.type === 'text' && h.value === current)),
    ].slice(0, MAX_HISTORY);
  }
}

function startPolling() {
  if (pollerStarted) return;
  pollerStarted = true;
  lastValue = clipboard.readText();
  setInterval(pollOnce, POLL_MS);
}

async function getHistory() {
  startPolling();
  return {
    name: 'clipboard-history',
    state: 'ok',
    metrics: { history },
    lastUpdated: new Date().toISOString(),
  };
}

function copyToClipboard(text) {
  clipboard.writeText(text);
}

module.exports = { getHistory, copyToClipboard };
