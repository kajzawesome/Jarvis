// ---- EXAMPLE NODE widget (start here) ----
// See collector.js first for the data-fetching half of this contract.

const collector = require('./collector.js');

// The ONE required export: render(container, data), called on this node's
// mount and every refresh (node.json's refreshMs controls how often).
// `container` is this tile's body element - set its innerHTML, wire up any
// buttons, done. `data` is exactly whatever your collector's main function
// returned.
function render(container, data) {
  // Always handle a missing/error state before touching data.metrics -
  // every real node in this app does this same guard first.
  if (!data || data.state !== 'ok') {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }

  // .stat-block / .stat-hero / .row / .hud-btn / .btn-row are shared HUD
  // classes from dashboard/renderer/style.css - use these instead of
  // hardcoding colors/fonts/sizes, and this tile matches the theme (and
  // picks up any future theme change - see the root README's "Customizing
  // the look" section) automatically, no CSS of your own needed. .stat-hero
  // is the "big number" style (used by pomodoro's timer, weather's temp,
  // etc.) - text inside it scales with the tile's own size via CSS
  // container queries, so try resizing this tile once it's on the grid.
  container.innerHTML = `
    <div class="stat-block">
      <div class="stat-hero">${data.metrics.now}</div>
      <div class="row">
        <span class="row-label">Button clicks</span>
        <span class="row-value">${data.metrics.clickCount}</span>
      </div>
      <div class="btn-row">
        <button class="hud-btn" data-action="increment">CLICK ME</button>
      </div>
    </div>
  `;

  // Wire up the button: call the collector's action, then re-fetch and
  // re-render (this is the same click -> action -> refresh -> render
  // pattern every interactive node in this app uses - see down-tracker's
  // ADD TARGET button or todo's status buttons for real examples).
  container.querySelector('[data-action="increment"]').addEventListener('click', async () => {
    collector.incrementCounter();
    const fresh = await collector.getData();
    render(container, fresh);

    // Any node can pop a HUD-wide toast (shows on every open screen, not
    // just this one) - uncomment to try it:
    // if (window.jarvisToast) window.jarvisToast('Example node', 'Button clicked!');
  });
}

// Rendering an open-ended list (could be 2 items, could be 50)? Wrap the
// rows in `<div class="fit-zone">...rows...</div>`, most-important-first -
// dashboard/renderer/app.js automatically trims trailing rows after every
// render until the tile's content fits its own box, so a small tile just
// shows less instead of overflowing or scrolling. See system-health or
// github-activity's widget.js for real examples - not needed here since
// this tile only ever renders a fixed, small amount of content.

module.exports = { render };
