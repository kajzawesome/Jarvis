const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

const ENV_PATH = path.join(__dirname, '..', '.env');
const AUTH_PORT = 17564;
const REDIRECT_URI = `http://127.0.0.1:${AUTH_PORT}/callback`;
const SCOPES = 'user-read-currently-playing user-read-playback-state user-modify-playback-state';

function readEnv() {
  const env = {};
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    });
  } catch {
    // no .env yet - treated as not configured below
  }
  return env;
}

function updateEnv(updates) {
  const raw = fs.existsSync(ENV_PATH) ? fs.readFileSync(ENV_PATH, 'utf-8') : '';
  const lines = raw.length ? raw.split(/\r?\n/) : [];
  const remaining = new Set(Object.keys(updates));

  const next = lines.map((line) => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=/);
    if (m && remaining.has(m[1])) {
      remaining.delete(m[1]);
      return `${m[1]}=${updates[m[1]]}`;
    }
    return line;
  });

  remaining.forEach((key) => next.push(`${key}=${updates[key]}`));
  fs.writeFileSync(ENV_PATH, next.join('\n').replace(/\n+$/, '\n'));
}

// Spotify requires the literal loopback IP 127.0.0.1 (not "localhost") and
// an exact registered redirect URI match, unlike Twitch's bare-localhost
// any-port allowance - so this one needs a fixed port + path registered.
function waitForAuthCode(clientId) {
  const authUrl =
    `https://accounts.spotify.com/authorize?client_id=${clientId}` +
    `&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
    `&scope=${encodeURIComponent(SCOPES)}`;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      if (url.pathname !== '/callback') {
        res.end('');
        return;
      }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.setHeader('Content-Type', 'text/html');
      res.end(
        `<html><body style="background:#020403;color:#00ff9c;font-family:monospace;padding:40px;">
          ${code ? 'Connected — you can close this tab.' : `Spotify auth failed: ${error || 'unknown error'}`}
        </body></html>`
      );
      server.close();
      if (code) resolve(code);
      else reject(new Error(error || 'spotify authorization was not completed'));
    });

    server.listen(AUTH_PORT, () => {
      require('electron').shell.openExternal(authUrl);
    });

    server.on('error', reject);
    setTimeout(() => {
      server.close();
      reject(new Error('timed out waiting for Spotify authorization (2 min)'));
    }, 120000);
  });
}

async function exchangeCodeForToken(clientId, clientSecret, code) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'spotify token exchange failed');
  return data;
}

async function refreshToken(clientId, clientSecret, refreshTok) {
  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshTok }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'spotify token refresh failed');
  return data;
}

async function connectAccount() {
  const env = readEnv();
  const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret } = env;
  if (!clientId || !clientSecret) throw new Error('set SPOTIFY_CLIENT_ID/SECRET in .env first');

  const code = await waitForAuthCode(clientId);
  const tokens = await exchangeCodeForToken(clientId, clientSecret, code);
  updateEnv({
    SPOTIFY_ACCESS_TOKEN: tokens.access_token,
    SPOTIFY_REFRESH_TOKEN: tokens.refresh_token,
  });
}

// Shared authed request with one automatic refresh-and-retry on 401 - every
// status read and every playback control goes through this.
async function spotifyFetch(urlPath, options = {}) {
  const env = readEnv();
  const { SPOTIFY_CLIENT_ID: clientId, SPOTIFY_CLIENT_SECRET: clientSecret, SPOTIFY_ACCESS_TOKEN: accessToken } = env;
  if (!clientId || !clientSecret) throw new Error('not_configured');
  if (!accessToken) throw new Error('not_connected');

  const doFetch = (token) =>
    fetch(`https://api.spotify.com/v1${urlPath}`, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });

  let res = await doFetch(accessToken);
  if (res.status === 401) {
    const refreshed = await refreshToken(clientId, clientSecret, env.SPOTIFY_REFRESH_TOKEN);
    updateEnv({
      SPOTIFY_ACCESS_TOKEN: refreshed.access_token,
      SPOTIFY_REFRESH_TOKEN: refreshed.refresh_token || env.SPOTIFY_REFRESH_TOKEN,
    });
    res = await doFetch(refreshed.access_token);
  }
  return res;
}

async function getNowPlaying() {
  const env = readEnv();
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) {
    return { name: 'spotify', state: 'not_configured', metrics: {}, lastUpdated: new Date().toISOString() };
  }
  if (!env.SPOTIFY_ACCESS_TOKEN) {
    return { name: 'spotify', state: 'not_connected', metrics: {}, lastUpdated: new Date().toISOString() };
  }

  try {
    const res = await spotifyFetch('/me/player');

    if (res.status === 204) {
      return { name: 'spotify', state: 'idle', metrics: {}, lastUpdated: new Date().toISOString() };
    }
    if (!res.ok) throw new Error(`spotify API returned ${res.status}`);

    const data = await res.json();
    if (!data || !data.item) {
      return { name: 'spotify', state: 'idle', metrics: {}, lastUpdated: new Date().toISOString() };
    }

    return {
      name: 'spotify',
      state: data.is_playing ? 'playing' : 'paused',
      metrics: {
        track: data.item.name,
        artist: data.item.artists.map((a) => a.name).join(', '),
        album: data.item.album.name,
        progressMs: data.progress_ms,
        durationMs: data.item.duration_ms,
        shuffle: !!data.shuffle_state,
        repeat: data.repeat_state, // 'off' | 'context' | 'track'
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    const state = err.message === 'not_configured' ? 'not_configured' : err.message === 'not_connected' ? 'not_connected' : 'error';
    return { name: 'spotify', state, metrics: { error: err.message }, lastUpdated: new Date().toISOString() };
  }
}

async function assertOk(res, action) {
  if (res.ok) return;
  if (res.status === 404) throw new Error(`${action} failed - no active Spotify device (open Spotify and start playback somewhere first)`);
  throw new Error(`${action} failed (${res.status})`);
}

async function play() {
  const res = await spotifyFetch('/me/player/play', { method: 'PUT' });
  await assertOk(res, 'play');
}

async function pause() {
  const res = await spotifyFetch('/me/player/pause', { method: 'PUT' });
  await assertOk(res, 'pause');
}

async function next() {
  const res = await spotifyFetch('/me/player/next', { method: 'POST' });
  await assertOk(res, 'skip');
}

async function previous() {
  const res = await spotifyFetch('/me/player/previous', { method: 'POST' });
  await assertOk(res, 'go back');
}

async function setShuffle(state) {
  const res = await spotifyFetch(`/me/player/shuffle?state=${state}`, { method: 'PUT' });
  await assertOk(res, 'shuffle');
}

// Cycles Spotify's own repeat states: off -> context (repeat all) -> track
// (repeat one) -> off. "Smart Shuffle" is a Spotify-app-only ML feature with
// no public Web API endpoint - not implemented here, see README.
async function cycleRepeat(current) {
  const nextState = current === 'off' ? 'context' : current === 'context' ? 'track' : 'off';
  const res = await spotifyFetch(`/me/player/repeat?state=${nextState}`, { method: 'PUT' });
  await assertOk(res, 'repeat');
  return nextState;
}

module.exports = { getNowPlaying, connectAccount, play, pause, next, previous, setShuffle, cycleRepeat };
