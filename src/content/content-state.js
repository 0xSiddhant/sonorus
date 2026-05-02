/* content-state.js — Shared globals for all content scripts.
   IMPORTANT: Only this file may declare these variables with let/const.
   All other content scripts share the same scope and read/write them
   directly by name — re-declaring in any other file will silently shadow
   the shared binding and break things. */

const DEFAULT_SETTINGS = {
  enabled: true,
  showPopupIcon: true,
  minChars: 20,
  blockedSites: [],
  selectedVoiceName: "",
  pitch: 1.0,
  defaultSpeed: 1.0,
  speedStep: 0.25,
  pillPosition: "bottom-center",
  pillTheme: "auto",
};

let settings = { ...DEFAULT_SETTINGS };
let voices = [];
let currentUtterance = null;
let pillEl = null;
let popupIconEl = null;
let isDragging = false;
let dragOffsetX = 0;
let dragOffsetY = 0;
let currentText = "";
let pillHideTimer = null;
let isTTSPaused = false; // tracks pause state ourselves — speechSynthesis.paused is unreliable in Chrome
let currentCharIndex = 0;  // absolute char position in currentText
let currentCharOffset = 0; // start offset of the current utterance within currentText

function notifyBackground(msg) {
  try {
    chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
  } catch (_) {}
}
