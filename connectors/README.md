# connectors

The integration hub — everything that isn't its own telemetry module but still needs to plug into Jarvis: Discord, GitHub, calendar, email, cloud storage, etc.

## Status: 🟢 active (module scaffold — not yet built)

## What it covers

Unlike the telemetry modules (pc-stats, router-network, twitch, minecraft-server), connectors is a grab-bag by design — it grows as you actually need an integration, not ahead of time. Candidates, roughly in likely order of use:

- **Discord** — bot presence, notifications out (e.g. "MC server went down", "went live on Twitch"), maybe bridging MC/Twitch events into a Discord channel
- **GitHub** — repo activity, PR/issue status, CI status for projects you're actively working (very relevant for the dev-job-hunt side of [productivity](../productivity/README.md) — portfolio repo activity is a thing to show off)
- **Google Calendar** — class schedule, deadlines, interview slots
- **Google Drive** — already available as a connector in this environment (`mcp__claude_ai_Google_Drive__*` tools) for docs/resume/notes
- **Email** — application confirmations, interview invites (read-only status, not a full inbox client)

## Suggested shape

Each connector should normalize to the same envelope as the telemetry modules so the eventual dashboard doesn't special-case them:

```json
{
  "name": "connector-name",
  "state": "connected",
  "metrics": {},
  "lastUpdated": "iso8601"
}
```

## Build notes

- **Secrets**: this module is the natural home for a single local secrets convention (e.g. one `.env` at the Jarvis root, `.gitignore`'d) that router-network, twitch, and minecraft-server also draw from — don't invent a separate secrets story per module.
- Build connectors on demand — the first one you'll actually want is probably Discord (push notifications from the other modules) or GitHub (job-hunt portfolio visibility).
