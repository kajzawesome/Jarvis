# twitch

Live/offline status, title, category, viewer count, plus follower/subscriber counts once connected.

## Status: 🟢 active (code ready — shows "not configured" until you add credentials)

## Getting credentials (one-time)

1. Go to [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) and log in with your normal Twitch account.
2. **Register Your Application**:
   - **Name**: anything (e.g. "Jarvis Dashboard") — must be globally unique, add your username if it's taken.
   - **OAuth Redirect URLs**: `http://localhost` — Twitch treats a bare `http://localhost` (no port) as matching any localhost port, which is exactly what the follower/subscriber "CONNECT" flow below needs (it spins up a temporary local server on port 17563 to catch the redirect).
   - **Category**: "Application Integration" or "Website Integration" — doesn't functionally matter.
3. Click **Create**, then open the app you just made and click **New Secret** to generate a client secret. Copy both the **Client ID** and the new **Client Secret** immediately — the secret is only shown once.
4. Open [.env](../.env) at the Jarvis root (create it from [.env.example](../.env.example) if it doesn't exist) and fill in:
   ```
   TWITCH_CLIENT_ID=<your client id>
   TWITCH_CLIENT_SECRET=<your client secret>
   TWITCH_CHANNEL=<your channel's login name, e.g. from twitch.tv/yourname>
   ```
5. That's it for live status — no restart needed beyond the node's normal refresh cycle (60s) picking up the change, though a full app restart guarantees it.

## Follower/subscriber counts (optional, one more step)

Live status uses an **app access token** (client ID/secret only, no login) — enough for live/offline/title/category/viewers. Followers and subs need a **user** access token instead, since Twitch requires the channel owner to actually authorize those scopes.

Once steps 1–4 above are done, a **CONNECT FOR FOLLOWERS/SUBS** button appears on the tile. Clicking it:

1. Opens your default browser to Twitch's authorization page (asks you to approve `moderator:read:followers` + `channel:read:subscriptions` for your own channel).
2. A temporary local server catches the redirect, exchanges the code for a user access token + refresh token, and saves both into `.env` as `TWITCH_USER_ACCESS_TOKEN`/`TWITCH_USER_REFRESH_TOKEN`.
3. The tile refreshes automatically with follower/sub counts. The refresh token means you shouldn't need to do this again — `collector.js` re-authenticates silently if the access token expires.

Subscriber count only works for Affiliate/Partner channels (Twitch's API itself restricts it) — if you're not there yet, followers will still show and subs will just stay blank, not error.

## Security note

`.env` holds real secrets (`TWITCH_CLIENT_SECRET`, and after connecting, `TWITCH_USER_ACCESS_TOKEN`/`TWITCH_USER_REFRESH_TOKEN`) — don't paste its contents anywhere public. This project isn't a git repo currently, so there's no commit-history risk, but if you ever `git init` this folder, add `.env` to `.gitignore` first (keep `.env.example` tracked, with blank values, as the template).
