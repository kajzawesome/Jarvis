// WMO weather codes -> short label (used by Open-Meteo's `weather_code`)
const WEATHER_CODES = {
  0: 'Clear',
  1: 'Mostly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Fog',
  51: 'Light drizzle',
  53: 'Drizzle',
  55: 'Heavy drizzle',
  61: 'Light rain',
  63: 'Rain',
  65: 'Heavy rain',
  71: 'Light snow',
  73: 'Snow',
  75: 'Heavy snow',
  80: 'Rain showers',
  81: 'Rain showers',
  82: 'Violent showers',
  85: 'Snow showers',
  86: 'Snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm + hail',
  99: 'Thunderstorm + hail',
};

// Cached for the process lifetime - location doesn't change often enough
// to re-look-up on every refresh.
let cachedLocation = null;

async function geolocate() {
  if (cachedLocation) return cachedLocation;
  try {
    const res = await fetch('http://ip-api.com/json/');
    const d = await res.json();
    if (d.status === 'success') {
      cachedLocation = { lat: d.lat, lon: d.lon, place: `${d.city}, ${d.regionName}` };
      return cachedLocation;
    }
  } catch {
    // fall through to backup source
  }
  try {
    const res = await fetch('https://ipapi.co/json/');
    const d = await res.json();
    if (!d.error) {
      cachedLocation = { lat: d.latitude, lon: d.longitude, place: `${d.city}, ${d.region}` };
      return cachedLocation;
    }
  } catch {
    // no location available
  }
  return null;
}

async function getWeather() {
  const loc = await geolocate();
  if (!loc) {
    return {
      name: 'weather',
      state: 'error',
      metrics: { error: 'could not determine location' },
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m&temperature_unit=fahrenheit&wind_speed_unit=mph`;
    const res = await fetch(url);
    const d = await res.json();
    const c = d.current;

    return {
      name: 'weather',
      state: 'ok',
      metrics: {
        place: loc.place,
        temp_f: Math.round(c.temperature_2m),
        condition: WEATHER_CODES[c.weather_code] || 'Unknown',
        humidity_pct: c.relative_humidity_2m,
        wind_mph: Math.round(c.wind_speed_10m),
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: 'weather',
      state: 'error',
      metrics: { error: err.message },
      lastUpdated: new Date().toISOString(),
    };
  }
}

module.exports = { getWeather };
