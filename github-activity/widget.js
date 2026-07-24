function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }
  if (data.state === 'not_configured') {
    container.innerHTML = `<div class="node-empty">not configured - add GITHUB_USERNAME to .env (GITHUB_TOKEN optional, unlocks pinned repos + higher rate limits)</div>`;
    return;
  }
  if (data.state === 'error') {
    container.innerHTML = `<div class="node-empty">error: ${data.metrics.error}</div>`;
    return;
  }

  const m = data.metrics;
  const repoRow = (r) => `<div class="row"><span class="row-label">${r.name}</span><span class="row-value">★${r.stars}</span></div>`;
  const eventRow = (e) => `<div class="row"><span class="row-label">${e.summary}</span></div>`;

  // One section per block, in priority order - if the tile's too short for
  // everything, whole sections get dropped from the bottom (STARRED first),
  // not an awkward mid-section cut.
  const sections = [
    m.pinned.length ? `<div class="sub-heading">PINNED</div>${m.pinned.map(repoRow).join('')}` : '',
    `<div class="sub-heading">RECENT ACTIVITY</div>${m.events.map(eventRow).join('') || '<div class="foot-line">no recent public activity</div>'}`,
    `<div class="sub-heading">RECENTLY PUSHED</div>${m.recentRepos.map(repoRow).join('') || '<div class="foot-line">none</div>'}`,
    `<div class="sub-heading">STARRED</div>${m.starred.map(repoRow).join('') || '<div class="foot-line">none</div>'}`,
  ].filter(Boolean);

  container.innerHTML = `
    <div class="stat-block">
      <div class="fit-zone">${sections.join('')}</div>
      ${!m.pinnedAvailable ? '<div class="foot-line">add GITHUB_TOKEN to .env to show pinned repos</div>' : ''}
    </div>
  `;
}

module.exports = { render };
