# weather

Current conditions, no signup required.

## Status: 🟢 active

## How it works

- **Location**: IP-based geolocation via [ip-api.com](http://ip-api.com) (free, no key, HTTP only), falling back to [ipapi.co](https://ipapi.co) if that fails. City-level accuracy, cached for the app's session (won't re-look-up every refresh).
- **Forecast**: [Open-Meteo](https://open-meteo.com) — free, no API key, no rate-limit hassle for personal use.

Refreshes every 30 minutes (`refreshMs` in `node.json`) — weather doesn't need to be more real-time than that.

## If IP geolocation is wrong

Coffee-shop wifi, a VPN, or a mislabeled ISP block can throw off IP geolocation. If it's consistently wrong for your setup, swap `geolocate()` in `collector.js` for hardcoded coordinates instead — Open-Meteo just needs `latitude`/`longitude` query params.
