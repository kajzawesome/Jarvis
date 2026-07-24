const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

const LINKS_PATH = path.join(__dirname, 'links.json');
const EXCLUDED_PATH = path.join(__dirname, 'excluded.json');
const ICONS_DIR = path.join(__dirname, 'icons');
const EXTRACT_ICON_SCRIPT = path.join(__dirname, 'extract-icon.ps1');
const LIST_APPS_SCRIPT = path.join(__dirname, 'list-apps.ps1');

let cachedApps = null;

// Every Start Menu shortcut (per-user + all-users) plus everything pinned
// to the taskbar - the same detection migrate-from-desktop.ps1 uses for
// taskbar apps, but unfiltered (no curated allowlist) so the picker can
// show everything and you decide, rather than me guessing which taskbar
// apps you care about.
async function listInstalledApps() {
  if (cachedApps) return cachedApps;
  const { stdout } = await execFileP('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', LIST_APPS_SCRIPT], {
    timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
  });
  cachedApps = JSON.parse(stdout.trim());
  return cachedApps;
}

function readJson(filePath, fallback) {
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8').replace(/^﻿/, ''));
  } catch {
    return fallback;
  }
}

function readLinksFile() {
  return readJson(LINKS_PATH, { links: [] });
}

function writeLinksFile(data) {
  fs.writeFileSync(LINKS_PATH, JSON.stringify(data, null, 2));
}

function readExcluded() {
  return readJson(EXCLUDED_PATH, { targets: [] });
}

function addExcluded(target) {
  const data = readExcluded();
  const key = target.toLowerCase();
  if (!data.targets.some((t) => t.toLowerCase() === key)) {
    data.targets.push(target);
    fs.writeFileSync(EXCLUDED_PATH, JSON.stringify(data, null, 2));
  }
}

function slugify(name) {
  const slug = name
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || 'item';
}

async function extractIcon(targetPath, slug) {
  try {
    const { stdout } = await execFileP(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', EXTRACT_ICON_SCRIPT, '-Source', targetPath, '-Slug', slug, '-OutDir', ICONS_DIR],
      { timeout: 8000 }
    );
    const rel = stdout.trim();
    return rel || null;
  } catch {
    return null;
  }
}

async function getLinks() {
  const raw = readLinksFile();
  return {
    name: 'desktop-links',
    state: 'ok',
    metrics: { links: raw.links },
    lastUpdated: new Date().toISOString(),
  };
}

// Removing a link also excludes its target so a future re-run of
// migrate-from-desktop.ps1 doesn't resurrect it.
function removeLink(index) {
  const data = readLinksFile();
  const removed = data.links[index];
  if (!removed) return;
  data.links.splice(index, 1);
  writeLinksFile(data);
  addExcluded(removed.target);
}

async function addLink({ label, type, target, args }) {
  const data = readLinksFile();
  let icon = null;
  if (type !== 'url' && fs.statSync(target).isFile()) {
    icon = await extractIcon(target, slugify(label));
  }
  data.links.push({ label, type, target, args: args || null, icon });
  writeLinksFile(data);
}

module.exports = { getLinks, addLink, removeLink, listInstalledApps, LINKS_PATH };
