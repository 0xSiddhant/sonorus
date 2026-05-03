/* content-main.js — Boot and message handler. Loaded last so all other scripts are in scope.
   Calls: loadVoices, stopTTS, setPillState, notifyBackground, onMouseUp, onDocMouseDown. */

function onMessage(message) {
  if (message.type === "CMD_PAUSE") {
    if (speechSynthesis.speaking && !isTTSPaused) {
      speechSynthesis.pause();
      isTTSPaused = true;
      setPillState("paused");
      notifyBackground({ type: "TTS_PAUSED" });
    }
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
