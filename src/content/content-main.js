/* content-main.js — Boot and message handler. Loaded last so all other scripts are in scope.
   Calls: loadVoices, refreshVoiceOptions, onPlayPause, pauseTTS, stopTTS, onMouseUp, onDocMouseDown. */

function onMessage(message) {
  if (message.type === "CMD_PAUSE") {
    pauseTTS();
  } else if (message.type === "CMD_RESUME") {
    if (isTTSPaused) onPlayPause();
  } else if (message.type === "CMD_STOP") {
    stopTTS();
  }
}

async function init() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings = { ...DEFAULT_SETTINGS, ...stored };

  // Listeners are always attached; isEnabledHere() gates them so enabling or
  // blocking the site takes effect without a reload.
  loadVoices();
  // addEventListener, not onvoiceschanged — that property is shared with the page.
  speechSynthesis.addEventListener("voiceschanged", () => {
    loadVoices();
    refreshVoiceOptions();
  });

  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("mousedown", onDocMouseDown);
  window.addEventListener("pagehide", () => stopTTS());

  chrome.runtime.onMessage.addListener(onMessage);

  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
    if ((changes.enabled || changes.blockedSites) && !isEnabledHere() && (currentText || pillEl)) {
      stopTTS();
    }
  });
}

init();
