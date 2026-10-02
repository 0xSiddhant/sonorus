/* content-main.js — Boot and message handler. Loaded last so all other scripts are in scope.
   Calls: loadVoices, pauseTTS, stopTTS, onMouseUp, onDocMouseDown. */

function onMessage(message) {
  if (message.type === "CMD_PAUSE") {
    pauseTTS();
  } else if (message.type === "CMD_STOP") {
    stopTTS();
  }
}

async function init() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings = { ...DEFAULT_SETTINGS, ...stored };

  const hostname = location.hostname.replace(/^www\./, "");
  if (!settings.enabled || settings.blockedSites.includes(hostname)) return;

  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;

  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("mousedown", onDocMouseDown);
  window.addEventListener("pagehide", () => stopTTS());

  chrome.runtime.onMessage.addListener(onMessage);

  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
  });
}

init();
