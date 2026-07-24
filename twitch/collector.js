const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

const ENV_PATH = path.join(__dirname, '..', '.env');
const AUTH_PORT = 17563;
const AUTH_SCOPES = 'moderator:read:followers channel:read:subscriptions';

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

// Updates specific keys in .env in place, preserving everything else
// (comments, unrelated keys, key order). Appends keys that don't exist yet.
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

// ---- app access token (client-credentials) - covers public stream status ----
let cachedAppToken = null;

async function getAppToken(clientId, clientSecret) {
  if (cachedAppToken && cachedAppToken.expiresAt > Date.now()) return cachedAppToken.token;
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'client_credentials',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'twitch token request failed');
  cachedAppToken = { token: data.access_token, expiresAt: Date.now() + (data.expires_in - 60) * 1000 };
  return cachedAppToken.token;
}

// ---- user OAuth (authorization-code) - needed for follower/sub counts ----
// Twitch's own docs carve out a bare "http://localhost" registered redirect
// URL as matching any localhost port, which is exactly the case for a
// desktop app spinning up a temporary callback server - no path segment,
// to match the exact registered value.
function waitForAuthCode(clientId) {
  const redirectUri = `http://localhost:${AUTH_PORT}`;
  const authUrl =
    `https://id.twitch.tv/oauth2/authorize?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code&scope=${encodeURIComponent(AUTH_SCOPES)}`;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, redirectUri);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error_description');
      res.setHeader('Content-Type', 'text/html');
      res.end(
        `<html><body style="background:#020403;color:#00ff9c;font-family:monospace;padding:40px;">
          ${code ? 'Connected — you can close this tab.' : `Twitch auth failed: ${error || 'unknown error'}`}
        </body></html>`
      );
      server.close();
      if (code) resolve(code);
      else reject(new Error(error || 'twitch authorization was not completed'));
    });

    server.listen(AUTH_PORT, () => {
      require('electron').shell.openExternal(authUrl);
    });

    server.on('error', reject);
    setTimeout(() => {
      server.close();
      reject(new Error('timed out waiting for Twitch authorization (2 min)'));
    }, 120000);
  });
}

async function exchangeCodeForToken(clientId, clientSecret, code) {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: `http://localhost:${AUTH_PORT}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'twitch token exchange failed');
  return data;
}

async function refreshUserToken(clientId, clientSecret, refreshToken) {
  const res = await fetch('https://id.twitch.tv/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || 'twitch token refresh failed');
  return data;
}

// Kicks off the one-time browser consent flow, then stores the resulting
// tokens in .env. Called from the widget's "CONNECT" button.
async function connectUserAuth() {
  const env = readEnv();
  const { TWITCH_CLIENT_ID: clientId, TWITCH_CLIENT_SECRET: clientSecret } = env;
  if (!clientId || !clientSecret) throw new Error('set TWITCH_CLIENT_ID/SECRET in .env first');

  const code = await waitForAuthCode(clientId);
  const tokens = await exchangeCodeForToken(clientId, clientSecret, code);
  updateEnv({
    TWITCH_USER_ACCESS_TOKEN: tokens.access_token,
    TWITCH_USER_REFRESH_TOKEN: tokens.refresh_token,
  });
}

async function helixGet(url, clientId, token) {
  const res = await fetch(url, { headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` } });
  const data = await res.json();
  return { ok: res.ok, status: res.status, data };
}

let cachedBroadcasterId = null;

async function getBroadcasterId(channel, clientId, token) {
  if (cachedBroadcasterId) return cachedBroadcasterId;
  const { data } = await helixGet(
    `https://api.twitch.tv/helix/users?login=${encodeURIComponent(channel)}`,
    clientId,
    token
  );
  cachedBroadcasterId = data.data && data.data[0] && data.data[0].id;
  return cachedBroadcasterId;
}

async function getFollowersAndSubs(channel, clientId, clientSecret) {
  const env = readEnv();
  let userToken = env.TWITCH_USER_ACCESS_TOKEN;
  const refreshToken = env.TWITCH_USER_REFRESH_TOKEN;
  if (!userToken) return null;

  const broadcasterId = await getBroadcasterId(channel, clientId, userToken);
  if (!broadcasterId) return null;

  let followersRes = await helixGet(
    `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=1`,
    clientId,
    userToken
  );

  if (followersRes.status === 401 && refreshToken) {
    const refreshed = await refreshUserToken(clientId, clientSecret, refreshToken);
    updateEnv({ TWITCH_USER_ACCESS_TOKEN: refreshed.access_token, TWITCH_USER_REFRESH_TOKEN: refreshed.refresh_token });
    userToken = refreshed.access_token;
    followersRes = await helixGet(
      `https://api.twitch.tv/helix/channels/followers?broadcaster_id=${broadcasterId}&first=1`,
      clientId,
      userToken
    );
  }

  const followers = followersRes.ok ? followersRes.data.total : null;

  // Subscriptions endpoint 403s on non-affiliate/partner channels - that's
  // an expected, non-fatal case, not an error.
  let subs = null;
  try {
    const subsRes = await helixGet(
      `https://api.twitch.tv/helix/subscriptions?broadcaster_id=${broadcasterId}&first=1`,
      clientId,
      userToken
    );
    if (subsRes.ok) subs = subsRes.data.total;
  } catch {
    subs = null;
  }

  return { followers, subs };
}

async function getStreamStatus() {
  const env = readEnv();
  const { TWITCH_CLIENT_ID: clientId, TWITCH_CLIENT_SECRET: clientSecret, TWITCH_CHANNEL: channel } = env;

  if (!clientId || !clientSecret || !channel) {
    return {
      name: 'twitch',
      state: 'not_configured',
      metrics: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const token = await getAppToken(clientId, clientSecret);
    const res = await fetch(`https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(channel)}`, {
      headers: { 'Client-Id': clientId, Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'twitch streams request failed');
    const stream = data.data && data.data[0];

    let followInfo = null;
    try {
      followInfo = await getFollowersAndSubs(channel, clientId, clientSecret);
    } catch {
      followInfo = null;
    }

    return {
      name: 'twitch',
      state: stream ? 'live' : 'offline',
      metrics: {
        channel,
        connected: !!env.TWITCH_USER_ACCESS_TOKEN,
        followers: followInfo ? followInfo.followers : null,
        subs: followInfo ? followInfo.subs : null,
        ...(stream
          ? {
              title: stream.title,
              category: stream.game_name,
              viewers: stream.viewer_count,
              started_at: stream.started_at,
            }
          : {}),
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: 'twitch',
      state: 'error',
      metrics: { error: err.message },
      lastUpdated: new Date().toISOString(),
    };
  }
}

module.exports = { getStreamStatus, connectUserAuth };
