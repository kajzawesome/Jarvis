const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');
const RELOGIN_MS = 10 * 60 * 1000;

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

// Stock ASUSWRT httpd has no documented public API - this mirrors what the
// router's own web UI does under the hood (login.cgi for a session token,
// then appGet.cgi "hook" calls), the same technique community integrations
// like Home Assistant's asusrouter use. Live-verified against an
// ASUS RT-AX1800S (firmware's httpd rejects login.cgi requests missing the
// full form-field set and Referer/Origin headers the real web UI sends -
// a bare login_authorization POST silently "succeeds" with 200 but issues
// no session cookie, which looks identical to a wrong password).
let cachedSession = null; // { token, expiresAt }

async function login(host, user, pass) {
  const auth = Buffer.from(`${user}:${pass}`).toString('base64');
  const res = await fetch(`http://${host}/login.cgi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Referer: `http://${host}/Main_Login.asp`,
      Origin: `http://${host}`,
      'User-Agent': 'Mozilla/5.0',
    },
    body:
      'group_id=&action_mode=&action_script=&action_wait=5&current_page=Main_Login.asp&next_page=index.asp&login_authorization=' +
      encodeURIComponent(auth),
  });
  const setCookie = res.headers.get('set-cookie') || '';
  const tokenMatch = setCookie.match(/asus_token=([^;]+)/);
  if (!tokenMatch) {
    throw new Error('login failed - check ROUTER_USER/ROUTER_PASSWORD in .env (this is also what a wrong password looks like)');
  }
  return tokenMatch[1];
}

async function getToken(host, user, pass) {
  if (cachedSession && cachedSession.expiresAt > Date.now()) return cachedSession.token;
  const token = await login(host, user, pass);
  cachedSession = { token, expiresAt: Date.now() + RELOGIN_MS };
  return token;
}

async function hookRequest(host, token, hook) {
  const res = await fetch(`http://${host}/appGet.cgi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: `asus_token=${token}`,
      Referer: `http://${host}/index.asp`,
      'User-Agent': 'Mozilla/5.0',
    },
    body: `hook=${encodeURIComponent(hook)}`,
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function parseClients(raw) {
  // get_clientlist() returns every device the router has ever seen, keyed
  // by MAC, most of them long offline - only surface ones currently online.
  if (!raw || typeof raw !== 'object') return [];
  return Object.entries(raw)
    .filter(([, v]) => v && typeof v === 'object' && v.isOnline === '1')
    .map(([mac, v]) => ({
      name: v.nickName || v.name || mac,
      ip: v.ip || null,
    }));
}

async function getStatus() {
  const env = readEnv();
  const host = env.ROUTER_HOST || '192.168.50.1';
  const user = env.ROUTER_USER;
  const pass = env.ROUTER_PASSWORD;

  if (!user || !pass) {
    return {
      name: 'router-network',
      state: 'not_configured',
      metrics: { host },
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const token = await getToken(host, user, pass);
    const status = await hookRequest(
      host,
      token,
      'nvram_get(wan0_ipaddr);nvram_get(wan0_state_t);get_clientlist();'
    );

    const devices = parseClients(status.get_clientlist);

    return {
      name: 'router-network',
      state: 'ok',
      metrics: {
        wan_ip: status.wan0_ipaddr || null,
        wan_connected: status.wan0_state_t === '2',
        connected_devices: devices.length,
        devices,
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    cachedSession = null;
    return {
      name: 'router-network',
      state: 'error',
      metrics: { error: err.message },
      lastUpdated: new Date().toISOString(),
    };
  }
}

module.exports = { getStatus };
