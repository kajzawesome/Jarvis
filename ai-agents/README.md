# ai-agents

Status board for the AI agent fleet — Claude Code sessions, scheduled/background agents, cron-driven runs.

## Status: 🔵 future (no active agent workloads to track yet)

## What it would cover

- Which agents/sessions are currently running vs idle
- Scheduled jobs (e.g. a `/loop` or cron-based routine) — last run, next run, success/failure
- Task queues or background subagent runs kicked off from a main session, and their completion status
- Errors/failures worth surfacing (a scheduled agent that's been failing silently)

## Why this is "future" not "planned"

There's no unattended/background agent workload running yet worth a status board for — this is a placeholder for when scheduled routines, cron jobs, or multi-agent workflows are actually in use. Revisit once there's more than one thing running that you'd otherwise have to check on manually.

## Suggested shape (when it's time)

```json
{
  "name": "agent-name",
  "state": "idle",
  "metrics": {
    "last_run": "iso8601",
    "next_run": "iso8601",
    "last_result": "success"
  },
  "lastUpdated": "iso8601"
}
```

## Build notes (later)

- If scheduled routines end up living in this Claude Code environment itself (cron-created agents, `/loop`), the status data may already exist and just need surfacing rather than building from scratch.
