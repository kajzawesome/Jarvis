const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '..', '.env');

function readEnv() {
  const env = {};
  try {
    const content = fs.readFileSync(ENV_PATH, 'utf-8');
    content.split(/\r?\n/).forEach((line) => {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    });
  } catch {
    // no .env yet - treated as not configured below
  }
  return env;
}

function summarize(event) {
  const repo = event.repo.name;
  const p = event.payload;
  switch (event.type) {
    case 'PushEvent': {
      // GitHub's Events API dropped the `commits`/`size` fields from
      // PushEvent payloads - only ref/head/before are left, so an exact
      // commit count isn't available without a separate API call.
      const branch = (p.ref || '').replace(/^refs\/heads\//, '');
      return `pushed to ${branch || repo} in ${repo}`;
    }
    case 'PullRequestEvent':
      return `${p.action} PR #${p.number} in ${repo}`;
    case 'IssuesEvent':
      return `${p.action} issue #${p.issue && p.issue.number} in ${repo}`;
    case 'IssueCommentEvent':
      return `commented on ${repo}#${p.issue && p.issue.number}`;
    case 'CreateEvent':
      return `created ${p.ref_type} ${p.ref || ''} in ${repo}`.trim();
    case 'DeleteEvent':
      return `deleted ${p.ref_type} ${p.ref || ''} in ${repo}`.trim();
    case 'WatchEvent':
      return `starred ${repo}`;
    case 'ForkEvent':
      return `forked ${repo}`;
    case 'ReleaseEvent':
      return `${p.action} release in ${repo}`;
    default:
      return `${event.type.replace('Event', '')} in ${repo}`;
  }
}

// Pinned repos aren't exposed by the REST API at all - only GraphQL, which
// always requires auth (even for public data) - so this section only shows
// up when a GITHUB_TOKEN is set.
async function fetchPinned(username, token) {
  if (!token) return [];
  const query = `
    query($login: String!) {
      user(login: $login) {
        pinnedItems(first: 6, types: REPOSITORY) {
          nodes {
            ... on Repository { name stargazerCount url }
          }
        }
      }
    }
  `;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'jarvis-dashboard',
    },
    body: JSON.stringify({ query, variables: { login: username } }),
  });
  if (!res.ok) return [];
  const data = await res.json();
  const nodes = data.data && data.data.user && data.data.user.pinnedItems.nodes;
  return (nodes || []).map((r) => ({ name: r.name, stars: r.stargazerCount, url: r.url }));
}

async function getActivity() {
  const env = readEnv();
  const username = env.GITHUB_USERNAME;
  const token = env.GITHUB_TOKEN;

  if (!username) {
    return {
      name: 'github-activity',
      state: 'not_configured',
      metrics: {},
      lastUpdated: new Date().toISOString(),
    };
  }

  try {
    const headers = { 'User-Agent': 'jarvis-dashboard', Accept: 'application/vnd.github+json' };
    if (token) headers.Authorization = `Bearer ${token}`;

    const [eventsRes, reposRes, starredRes, pinned] = await Promise.all([
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/repos?sort=pushed&direction=desc&per_page=5`, { headers }),
      fetch(`https://api.github.com/users/${encodeURIComponent(username)}/starred?per_page=5`, { headers }),
      fetchPinned(username, token).catch(() => []),
    ]);

    if (!eventsRes.ok) throw new Error(`GitHub API returned ${eventsRes.status}`);
    const events = await eventsRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];
    const starred = starredRes.ok ? await starredRes.json() : [];

    return {
      name: 'github-activity',
      state: 'ok',
      metrics: {
        username,
        pinnedAvailable: !!token,
        events: events.slice(0, 5).map((e) => ({ summary: summarize(e), when: e.created_at })),
        recentRepos: repos.slice(0, 5).map((r) => ({ name: r.name, stars: r.stargazers_count, private: r.private })),
        starred: starred.slice(0, 5).map((r) => ({ name: r.full_name, stars: r.stargazers_count })),
        pinned,
      },
      lastUpdated: new Date().toISOString(),
    };
  } catch (err) {
    return {
      name: 'github-activity',
      state: 'error',
      metrics: { error: err.message },
      lastUpdated: new Date().toISOString(),
    };
  }
}

module.exports = { getActivity };
