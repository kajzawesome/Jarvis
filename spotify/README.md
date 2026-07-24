# spotify

Now-playing (track, artist, album, progress bar) plus playback controls: play/pause, skip forward/back, shuffle, repeat.

## Status: 🟢 active (code ready — needs your own Spotify app credentials)

## Getting credentials (one-time)

1. Go to [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard), log in, click **Create app** (or reuse an existing one — Spotify apps accept multiple redirect URIs, so adding Jarvis's alongside another project's is fine).
2. Fill in:
   - **App name / description**: anything.
   - **Redirect URI**: `http://127.0.0.1:17564/callback` — must match **exactly** (Spotify requires the literal loopback IP `127.0.0.1`, not `localhost`, and an exact path/port match — unlike Twitch, there's no "bare hostname matches any port" allowance here).
   - **APIs used**: check "Web API".
3. Save, open the app's **Settings**, copy the **Client ID** and **Client Secret**.
4. Add to [.env](../.env):
   ```
   SPOTIFY_CLIENT_ID=<your client id>
   SPOTIFY_CLIENT_SECRET=<your client secret>
   ```
5. A **CONNECT SPOTIFY** button appears on the tile — click it, approve in the browser popup, done. Token refresh is automatic after that (`SPOTIFY_ACCESS_TOKEN`/`SPOTIFY_REFRESH_TOKEN` get written to `.env` for you, same pattern as `twitch`).

If you already connected before playback controls were added, the saved token only has the read scopes — click CONNECT SPOTIFY again to re-authorize with `user-modify-playback-state` included, or the control buttons will fail with a 403.

## Controls

Previous / play-pause / next, plus SHUFFLE and REPEAT toggles (REPEAT cycles off → repeat all → repeat one, matching Spotify's own three states). All of it requires an **active playback device** — if nothing's currently playing anywhere on your account, Spotify's API has nothing to control and the buttons will show "no active Spotify device."

**Not included: "Smart Shuffle."** That's a Spotify-app-only feature (client-side, ML-based track suggestions mixed into shuffle) with no public Web API endpoint — there's no way to trigger it from outside the Spotify app itself. Regular shuffle (on/off) is fully supported.

## Notes

- Reflects/controls whatever device is currently active in your Spotify account (phone, desktop app, web player, etc), not a specific device you pick.
- Refreshes every 10s.
