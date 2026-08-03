// ---- EXAMPLE NODE (start here) ----
// This is the minimal, fully-working node the "Adding a new node" section
// of the root README points at. Copy this whole folder, rename it, and
// edit these 4 files - node.json/collector.js/widget.js/README.md - to
// build something new. Nothing here needs to be "unhooked" first: this
// node is real and safe to leave in place (it just shows a counter + the
// time), or delete the folder once you don't need the reference anymore.

// A module-level variable persists for as long as this renderer window is
// open (this file is require()'d once and cached, same as every other
// node's collector.js) - this is how a node keeps state between refreshes
// without writing to disk. Real examples: minecraft-server's log-watcher
// flag, twitch's cached broadcaster id, pc-stats's sensor cache.
let clickCount = 0;

// The ONE required export: an async function (named whatever you put in
// node.json's "collectorFn") that returns this exact shape:
//   { name, state, metrics, lastUpdated }
// - name: your node's id, just for your own debugging/logging.
// - state: whatever string your widget.js checks for. "ok" is the normal
//   case; project convention for anything else is 'not_configured' (needs
//   a credential - see twitch/collector.js), 'not_connected' (has
//   credentials but needs a one-time OAuth click - see google-calendar),
//   or 'error' (something threw - put the message in metrics.error).
// - metrics: whatever your widget needs to render - any shape you want,
//   this node's widget.js just needs to agree with it.
// - lastUpdated: new Date().toISOString(), for consistency with every
//   other node (not currently displayed anywhere, but keep it - some
//   future node might aggregate "last updated" across all of them).
async function getData() {
  return {
    name: 'example-node',
    state: 'ok',
    metrics: {
      now: new Date().toLocaleTimeString(),
      clickCount,
    },
    lastUpdated: new Date().toISOString(),
  };
}

// Nodes with a button (down-tracker's ADD TARGET, todo's status buttons,
// minecraft-server's start/stop) export extra functions alongside the main
// one and call them straight from widget.js's click handlers - no special
// wiring needed, just require('./collector.js') and call it. This one just
// bumps the in-memory counter; a real node would usually write somewhere
// (a local JSON file - see down-tracker/collector.js's readData/writeData
// pattern - or an external API - see twitch/collector.js).
function incrementCounter() {
  clickCount += 1;
}

module.exports = { getData, incrementCounter };
