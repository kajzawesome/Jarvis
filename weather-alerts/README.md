# weather-alerts

Active severe weather alerts for your location, with a toast when a new one appears.

## Status: 🟢 active (US-only)

Uses the free [National Weather Service API](https://www.weather.gov/documentation/services-web-api) (`api.weather.gov`) — no key, just an identifying User-Agent header per their usage policy. Same IP-geolocation approach as the `weather` node (separate lookup, kept as its own small duplication rather than sharing code across nodes).

NWS only covers the US — if IP geolocation places you outside it, the tile shows "not available for this location" rather than erroring, since that's an expected/correct case, not a failure.

No alerts were active in testing (nothing to verify the exact CAP alert response shape against live) — built from the NWS API's documented format. If a real alert's rendering looks off, check `getAlerts()` in `collector.js` against what `data.features[].properties` actually contains.
