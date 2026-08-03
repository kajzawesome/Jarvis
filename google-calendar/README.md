# google-calendar

Next few upcoming events from your primary Google Calendar.

## Status: 🟢 active (code ready — needs your own Google Cloud OAuth credentials)

## Getting credentials (one-time)

1. Go to the [Google Cloud Console](https://console.cloud.google.com/), create a project (or reuse one).
2. **APIs & Services → Library** → search "Google Calendar API" → **Enable**.
3. **APIs & Services → OAuth consent screen** → set it up as **External** + **Testing** mode (fine for personal use — add your own Google account under "Test users" so it can actually authorize while unpublished).
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID** → Application type: **Desktop app**. Name it anything.
5. Copy the **Client ID** and **Client Secret** into [.env](../.env):
   ```
   GOOGLE_CLIENT_ID=<your client id>
   GOOGLE_CLIENT_SECRET=<your client secret>
   ```
6. A **CONNECT GOOGLE CALENDAR** button appears on the tile — click it, approve in the browser popup, done.

Unlike Spotify, "Desktop app" OAuth clients don't need a redirect URI pre-registered — Google allows any loopback port automatically, same convenience as Twitch.

## Views

Three view toggles at the top of the tile — **LIST** (original, most-important/soonest first), **WEEK** (7-day-column grid for the current calendar week, today highlighted), **MONTH** (traditional calendar grid for the current month, today highlighted, a small count badge on any day with events — hover a day for the full titles). Your choice is remembered (`localStorage`) across refreshes and app restarts. Both grid views only ever show *upcoming* events (the API call itself excludes anything already past), so days earlier in the week/month than today just show empty even though they're rendered.

## Notes

- Read-only (`calendar.readonly` scope) — this can't create/modify events, only list them.
- Refreshes every 5 minutes. Fetches up to 42 days out (enough to cover both the week and month views from one API call).
- If the OAuth consent screen stays in "Testing" mode (the default, and totally fine for personal use), tokens can expire after ~7 days and need reconnecting — if events stop updating, just click CONNECT again.
