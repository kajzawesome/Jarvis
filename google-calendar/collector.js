const fs = require('fs');
const path = require('path');
const http = require('http');
const { URL } = require('url');

const ENV_PATH = path.join(__dirname, '..', '.env');
const AUTH_PORT = 17565;
const REDIRECT_URI = `http://127.0.0.1:${AUTH_PORT}`;
// calendar.events (not the broader calendar.readonly/calendar scopes) is
// the minimal scope that covers both listing AND creating events, without
// also granting calendar-settings/sharing access this app has no use for.
// Anyone who already connected under the old calendar.readonly-only scope
// needs to hit CONNECT again to pick up write access - re-consenting is the
// only way to add scope to an existing token.
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';

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

// Google's "Desktop app" OAuth client type accepts any port on the
// loopback address without pre-registering it (unlike Spotify's exact-match
// requirement) - same convenience as Twitch's bare-localhost allowance.
function waitForAuthCode(clientId) {
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=code` +
    `&scope=${encodeURIComponent(SCOPE)}&access_type=offline&prompt=consent`;

  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      res.setHeader('Content-Type', 'text/html');
      res.end(
        `<html><body style="background:#020403;color:#00ff9c;font-family:monospace;padding:40px;">
          ${code ? 'Connected — you can close this tab.' : `Google auth failed: ${error || 'unknown error'}`}
        </body></html>`
      );
      server.close();
      if (code) resolve(code);
      else reject(new Error(error || 'google authorization was not completed'));
    });

    server.listen(AUTH_PORT, () => {
      require('electron').shell.openExternal(authUrl);
    });

    server.on('error', reject);
    setTimeout(() => {
      server.close();
      reject(new Error('timed out waiting for Google authorization (2 min)'));
    }, 120000);
  });
}

async function exchangeCodeForToken(clientId, clientSecret, code) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: REDIRECT_URI,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'google token exchange failed');
  return data;
}

async function refreshToken(clientId, clientSecret, refreshTok) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshTok,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || 'google token refresh failed');
  return data;
}

async function connectAccount() {
  const env = readEnv();
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret } = env;
  if (!clientId || !clientSecret) throw new Error('set GOOGLE_CLIENT_ID/SECRET in .env first');

  const code = await waitForAuthCode(clientId);
  const tokens = await exchangeCodeForToken(clientId, clientSecret, code);
  updateEnv({
    GOOGLE_ACCESS_TOKEN: tokens.access_token,
    GOOGLE_REFRESH_TOKEN: tokens.refresh_token,
  });
}

async function getEvents() {
  const env = readEnv();
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_ACCESS_TOKEN: accessToken } = env;

  if (!clientId || !clientSecret) {
    return { name: 'google-calendar', state: 'not_configured', metrics: {}, lastUpdated: new Date().toISOString() };
  }
  if (!accessToken) {
    return { name: 'google-calendar', state: 'not_connected', metrics: {}, lastUpdated: new Date().toISOString() };
  }

  try {
    // Wide enough to cover both the week and month schedule views (see
    // widget.js) with one fetch, not just the short "next 6" list - up to
    // 6 weeks out covers a full month-grid's worth of upcoming events.
    // maxResults raised to match; still ordered/singleEvents so recurring
    // events expand into their real individual occurrences.
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + 42);
    const url =
      'https://www.googleapis.com/calendar/v3/calendars/primary/events' +
      `?timeMin=${encodeURIComponent(new Date().toISOString())}` +
      `&timeMax=${encodeURIComponent(timeMax.toISOString())}` +
      '&maxResults=100&singleEvents=true&orderBy=startTime';

    let res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (res.status === 401) {
      const refreshed = await refreshToken(clientId, clientSecret, env.GOOGLE_REFRESH_TOKEN);
      updateEnv({ GOOGLE_ACCESS_TOKEN: refreshed.access_token });
      res = await fetch(url, { headers: { Authorization: `Bearer ${refreshed.access_token}` } });
    }

    if (!res.ok) throw new Error(`google calendar API returned ${res.status}`);
    const data = await res.json();

    const events = (data.items || []).map((e) => ({
      title: e.summary || '(no title)',
      start: (e.start && (e.start.dateTime || e.start.date)) || null,
      allDay: !!(e.start && e.start.date && !e.start.dateTime),
    }));

    return { name: 'google-calendar', state: 'ok', metrics: { events }, lastUpdated: new Date().toISOString() };
  } catch (err) {
    return { name: 'google-calendar', state: 'error', metrics: { error: err.message }, lastUpdated: new Date().toISOString() };
  }
}

// Google's all-day events use an EXCLUSIVE end date - a single-day all-day
// event's end.date must be the day AFTER its start.date, or the API creates
// a zero-length/invalid-looking event.
function nextDateStr(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

// { title, date: "YYYY-MM-DD", time: "HH:MM"|null, allDay }. Timed events
// default to a 1-hour duration - no separate end-time field in the modal,
// kept deliberately simple (edit the real event in Google Calendar directly
// for anything more specific than "add a quick thing").
async function addEvent({ title, date, time, allDay }) {
  const env = readEnv();
  const { GOOGLE_CLIENT_ID: clientId, GOOGLE_CLIENT_SECRET: clientSecret, GOOGLE_ACCESS_TOKEN: accessToken } = env;
  if (!clientId || !clientSecret) throw new Error('not configured');
  if (!accessToken) throw new Error('not connected');

  const body = allDay
    ? { summary: title, start: { date }, end: { date: nextDateStr(date) } }
    : (() => {
        const start = new Date(`${date}T${time}:00`);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        return { summary: title, start: { dateTime: start.toISOString() }, end: { dateTime: end.toISOString() } };
      })();

  const url = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';
  const post = (token) =>
    fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

  let res = await post(accessToken);
  if (res.status === 401) {
    const refreshed = await refreshToken(clientId, clientSecret, env.GOOGLE_REFRESH_TOKEN);
    updateEnv({ GOOGLE_ACCESS_TOKEN: refreshed.access_token });
    res = await post(refreshed.access_token);
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data.error && data.error.message) || `insert failed (${res.status})`);
  }
  return res.json();
}

module.exports = { getEvents, connectAccount, addEvent };
