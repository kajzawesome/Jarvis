const collector = require('./collector.js');

let recognizer = null;
let listening = false;

function getRecognizerClass() {
  return window.SpeechRecognition || window.webkitSpeechRecognition;
}

function render(container, data) {
  if (!data) {
    container.innerHTML = `<div class="node-empty">NO SIGNAL</div>`;
    return;
  }

  if (data.state === 'unsupported') {
    container.innerHTML = `<div class="node-empty">Speech recognition isn't available in this Electron build - see voice-control/README.md</div>`;
    return;
  }

  container.innerHTML = `
    <div class="stat-block">
      <div class="status-pill ${listening ? 'status-online' : 'status-offline'}">${listening ? 'LISTENING...' : 'MIC OFF'}</div>
      <div class="btn-row"><button class="hud-btn" data-action="toggle">${listening ? 'STOP' : 'SPEAK A COMMAND'}</button></div>
      <div class="foot-line" data-transcript>heard nothing yet</div>
      <div class="sub-heading">COMMANDS</div>
      <div class="fit-zone">
        ${data.metrics.commands.map((c) => `<div class="foot-line">${c}</div>`).join('')}
      </div>
    </div>
  `;

  const transcriptEl = container.querySelector('[data-transcript]');
  const statusPill = container.querySelector('.status-pill');
  const btn = container.querySelector('[data-action="toggle"]');

  btn.addEventListener('click', () => {
    if (listening) {
      recognizer && recognizer.stop();
      return;
    }
    startListening(transcriptEl, statusPill, btn);
  });
}

function startListening(transcriptEl, statusPill, btn) {
  const Recognizer = getRecognizerClass();
  if (!Recognizer) return;

  recognizer = new Recognizer();
  recognizer.lang = 'en-US';
  recognizer.continuous = false;
  recognizer.interimResults = false;

  listening = true;
  statusPill.textContent = 'LISTENING...';
  statusPill.className = 'status-pill status-online';
  btn.textContent = 'STOP';

  recognizer.onresult = async (event) => {
    const transcript = event.results[0][0].transcript;
    transcriptEl.textContent = `heard: "${transcript}"`;
    const result = await collector.runTranscript(transcript);
    if (window.jarvisToast) window.jarvisToast(result.matched ? 'Voice command' : 'Voice command not recognized', result.message);
  };

  recognizer.onerror = (event) => {
    transcriptEl.textContent = `error: ${event.error}`;
  };

  recognizer.onend = () => {
    listening = false;
    statusPill.textContent = 'MIC OFF';
    statusPill.className = 'status-pill status-offline';
    btn.textContent = 'SPEAK A COMMAND';
  };

  recognizer.start();
}

module.exports = { render };
