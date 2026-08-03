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

Four view toggles at the top of the tile — **LIST** (original, most-important/soonest first), **DAY** (single day, `‹`/`›` to page forward — clamped so you can't page before today, since nothing would ever show there), **WEEK** (7-day-column grid for the current calendar week, today highlighted), **MONTH** (traditional calendar grid for the current month, today highlighted, a small count badge on any day with events — hover a day for the full titles). Your choice is remembered (`localStorage`) across refreshes and app restarts.

All views only ever show *upcoming* events (the API call itself excludes anything already past). If DAY/WEEK look empty but LIST clearly has events, that's not a bug — it just means none of your upcoming events fall inside that narrower window; the tile says so directly ("nothing here — N upcoming further out, check LIST or MONTH") rather than leaving you guessing.

## Adding an event

Click the **+** button next to the view toggles, or click directly on any day (a month-grid cell or a week-view column) to open the same form pre-filled with that date. Fill in a title, date, and time (or check **All day**), and it's created directly via the Calendar API — no need to leave Jarvis. Timed events default to a 1-hour duration; there's no end-time field, so edit the real event in Google Calendar if you need something longer or more specific.

Requires reconnecting if you connected before this feature existed — creating events needs the `calendar.events` scope (read/write), which is broader than the original `calendar.readonly` scope. Click CONNECT again on the tile if adding an event fails with a permissions-looking error.

## Notes

- Read-only (`calendar.readonly` scope) — this can't create/modify events, only list them.
- Refreshes every 5 minutes. Fetches up to 42 days out (enough to cover both the week and month views from one API call).
- If the OAuth consent screen stays in "Testing" mode (the default, and totally fine for personal use), tokens can expire after ~7 days and need reconnecting — if events stop updating, just click CONNECT again.
