// NWS (api.weather.gov) is US-only and requires an identifying User-Agent
// per their usage policy - no API key needed otherwise.
const USER_AGENT = 'jarvis-dashboard (personal use)';

let cachedLocation = null;
let knownAlertIds = new Set();
let firstPoll = true;

async function geolocate() {
  if (cachedLocation) return cachedLocation;
  try {
    const res = await fetch('http://ip-api.com/json/');
    const d = await res.json();
    if (d.status === 'success') {
      cachedLocation = { lat: d.lat, lon: d.lon };
      return cachedLocation;
    }
  } catch {
    // no location available
  }
  return null;
}

async function getAlerts() {
  const loc = await geolocate();
  if (!loc) {
    return { name: 'weather-alerts', state: 'error', metrics: { error: 'could not determine location' }, lastUpdated: new Date().toISOString() };
  }

  try {
    const res = await fetch(`https://api.weather.gov/alerts/active?point=${loc.lat},${loc.lon}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/geo+json' },
    });
    if (!res.ok) {
      // NWS only covers the US - a non-US location will 400/404 here, which
      // isn't really an "error" so much as "not applicable."
      return { name: 'weather-alerts', state: 'unavailable', metrics: {}, lastUpdated: new Date().toISOString() };
    }
    const data = await res.json();

    const alerts = (data.features || []).map((f) => ({
      id: f.id,
      event: f.properties.event,
      headline: f.properties.headline,
      severity: f.properties.severity,
      expires: f.properties.expires,
    }));

    const newAlerts = firstPoll ? [] : alerts.filter((a) => !knownAlertIds.has(a.id));
    knownAlertIds = new Set(alerts.map((a) => a.id));
    firstPoll = false;

    return {
      name: 'weather-alerts',
      state: 'ok',
      metrics: { alerts, newAlerts },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return { name: 'weather-alerts', state: 'error', metrics: { error: err.message }, lastUpdated: new Date().toISOString() };
  }
}

module.exports = { getAlerts };
