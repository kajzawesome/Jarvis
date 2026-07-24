# github-activity

Recent public activity, recently-pushed repos, starred repos, and (with a token) pinned repos — portfolio visibility for the job hunt.

## Status: 🟢 active

## Setup

Add to [.env](../.env):

```
GITHUB_USERNAME=<your github username>
GITHUB_TOKEN=<optional - a fine-grained PAT with no special scopes needed for public data>
```

`GITHUB_USERNAME` alone is enough for activity/recent-repos/starred (unauthenticated, 60 req/hr rate limit — fine at this node's 2-minute refresh interval). `GITHUB_TOKEN` raises that limit to 5,000/hr and unlocks **pinned repos**, which GitHub's REST API doesn't expose at all — that section only works via the GraphQL API, which always requires auth even for public data. Create a token at [github.com/settings/tokens](https://github.com/settings/tokens) (fine-grained, no scopes/permissions needed — public read access is implicit).

## Sections shown

- **Pinned** — only if `GITHUB_TOKEN` is set.
- **Recent activity** — your public event feed (pushes, PRs, issues, stars, etc).
- **Recently pushed** — your repos sorted by last push.
- **Starred** — repos you've starred.
