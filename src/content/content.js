/* Sonorus — content.js
   Injected into every page. Handles: selection detection, TTS, floating icon, pill player. */

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
let currentCharIndex = 0;
let currentUtteranceOffset = 0;

// ─── Boot ─────────────────────────────────────────────────────────────────────

async function init() {
  const stored = await chrome.storage.sync.get(DEFAULT_SETTINGS);
  settings = { ...DEFAULT_SETTINGS, ...stored };

  const hostname = location.hostname.replace(/^www\./, "");
  if (!settings.enabled || settings.blockedSites.includes(hostname)) return;

  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;

  document.addEventListener("mouseup", onMouseUp);
  document.addEventListener("mousedown", onDocMouseDown);

  chrome.runtime.onMessage.addListener(onMessage);

  chrome.storage.onChanged.addListener((changes) => {
    for (const [key, { newValue }] of Object.entries(changes)) {
      settings[key] = newValue;
    }
  });
}

function loadVoices() {
  voices = speechSynthesis.getVoices();
}

function notifyBackground(msg) {
  try {
    chrome.runtime.sendMessage(msg, () => void chrome.runtime.lastError);
  } catch (_) {}
}

// ─── Message handler ──────────────────────────────────────────────────────────

function onMessage(message) {
  if (message.type === "CMD_PAUSE") {
    if (speechSynthesis.speaking && !speechSynthesis.paused) {
      speechSynthesis.pause();
      setPillState("paused");
      notifyBackground({ type: "TTS_PAUSED" });
    }
  } else if (message.type === "CMD_STOP") {
    stopTTS();
  }
}

// ─── Selection detection ──────────────────────────────────────────────────────

function onMouseUp(e) {
  if (pillEl?.contains(e.target) || popupIconEl?.contains(e.target)) return;

  setTimeout(() => {
    showPopupIconIfNeeded();
  }, 10);
}

function onDocMouseDown(e) {
  if (pillEl?.contains(e.target) || popupIconEl?.contains(e.target)) return;
  hidePopupIcon();
}

function showPopupIconIfNeeded() {
  const sel = window.getSelection();
  const text = sel?.toString().trim();
  if (!text || text.length < settings.minChars) {
    hidePopupIcon();
    return;
  }
  if (!settings.showPopupIcon) {
    startTTS(text);
    return;
  }
  showPopupIcon(sel, text);
}

// ─── Floating popup icon ──────────────────────────────────────────────────────

function showPopupIcon(sel, text) {
  hidePopupIcon();

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  popupIconEl = document.createElement("div");
  popupIconEl.id = "sonorus-popup-icon";
  popupIconEl.innerHTML = "🔊";
  popupIconEl.setAttribute("aria-label", "Listen with Sonorus");
  popupIconEl.setAttribute("role", "button");
  popupIconEl.title = "Listen with Sonorus";

  const x = rect.right + window.scrollX - 18;
  const y = rect.top + window.scrollY - 48;

  popupIconEl.style.left = `${Math.max(8, x)}px`;
  popupIconEl.style.top = `${Math.max(8, y)}px`;

  popupIconEl.addEventListener("click", (e) => {
    e.stopPropagation();
    hidePopupIcon();
    startTTS(text);
  });

  document.body.appendChild(popupIconEl);
  requestAnimationFrame(() => popupIconEl?.classList.add("sonorus-visible"));
}

function hidePopupIcon() {
  if (popupIconEl) {
    popupIconEl.remove();
    popupIconEl = null;
  }
}

// ─── TTS Engine ───────────────────────────────────────────────────────────────

function getSelectedVoice() {
  if (!settings.selectedVoiceName) return null;
  return voices.find((v) => v.name === settings.selectedVoiceName) || null;
}

function startTTS(text) {
  stopTTS(false);
  currentText = text;
  currentCharIndex = 0;
  currentUtteranceOffset = 0;

  showPill();
  setPillState("loading");

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = settings.defaultSpeed;
  currentUtterance.pitch = settings.pitch;

  const voice = getSelectedVoice();
  if (voice) {
    currentUtterance.voice = voice;
    currentUtterance.lang = voice.lang;
  }

  currentUtterance.onboundary = (e) => {
    currentCharIndex = currentUtteranceOffset + e.charIndex;
    updateProgressBar();
  };

  currentUtterance.onstart = () => {
    setPillState("playing");
    notifyBackground({
      type: "TTS_STARTED",
      text: text.slice(0, 100),
      speed: settings.defaultSpeed,
      voice: voice?.name || "",
    });
  };

  currentUtterance.onpause = () => {
    setPillState("paused");
    notifyBackground({ type: "TTS_PAUSED" });
  };

  currentUtterance.onresume = () => {
    setPillState("playing");
    notifyBackground({ type: "TTS_RESUMED" });
  };

  currentUtterance.onend = () => {
    currentCharIndex = currentText.length;
    updateProgressBar();
    setPillState("idle");
    notifyBackground({ type: "TTS_STOPPED" });
    setTimeout(() => hidePill(), 1500);
  };

  currentUtterance.onerror = (e) => {
    if (e.error === "interrupted" || e.error === "canceled") return;
    setPillState("error");
    notifyBackground({ type: "TTS_STOPPED" });
  };

  speechSynthesis.speak(currentUtterance);
}

function stopTTS(hidePillAfter = true) {
  speechSynthesis.cancel();
  currentUtterance = null;
  currentText = "";
  currentCharIndex = 0;
  currentUtteranceOffset = 0;
  if (hidePillAfter) {
    setPillState("idle");
    notifyBackground({ type: "TTS_STOPPED" });
    hidePill();
  }
}

// ─── Pill Player ──────────────────────────────────────────────────────────────

function buildVoiceOptions() {
  const grouped = {};
  voices.forEach((v) => {
    const lang = v.lang.split("-")[0];
    if (!grouped[lang]) grouped[lang] = [];
    grouped[lang].push(v);
  });

  const priorityLangs = ["en", "hi"];
  const allLangs = [
    ...priorityLangs.filter((l) => grouped[l]),
    ...Object.keys(grouped)
      .filter((l) => !priorityLangs.includes(l))
      .sort(),
  ];

  let html = '<option value="">Default voice</option>';
  allLangs.forEach((lang) => {
    const label =
      new Intl.DisplayNames(["en"], { type: "language" }).of(lang) || lang;
    html += `<optgroup label="${label}">`;
    grouped[lang].forEach((v) => {
      const sel = v.name === settings.selectedVoiceName ? " selected" : "";
      html += `<option value="${v.name}"${sel}>${v.name} (${v.lang})</option>`;
    });
    html += "</optgroup>";
  });
  return html;
}

function showPill() {
  if (pillEl) return;

  const theme = resolvePillTheme();

  pillEl = document.createElement("div");
  pillEl.id = "sonorus-pill";
  pillEl.setAttribute("data-theme", theme);

  pillEl.innerHTML = `
    <span id="sonorus-drag" title="Drag to move">⠿</span>
    <span id="sonorus-speaker">🔊</span>
    <button id="sonorus-playpause" title="Play / Pause">▶</button>
    <button id="sonorus-stop" title="Stop">■</button>
    <div id="sonorus-speed-wrap">
      <span class="sonorus-speed-label" id="sonorus-speed-val">${settings.defaultSpeed}x</span>
      <input id="sonorus-speed" type="range" min="0.5" max="2" step="${settings.speedStep}" value="${settings.defaultSpeed}" title="Speed">
    </div>
    <select id="sonorus-voice" title="Voice">${buildVoiceOptions()}</select>
    <button id="sonorus-close" title="Close">✕</button>
    <div id="sonorus-progress-bar"><div id="sonorus-progress-fill"></div></div>
  `;

  const savedPos = sessionStorage.getItem("sonorus-pill-pos");
  if (savedPos) {
    const { left, top } = JSON.parse(savedPos);
    pillEl.style.left = `${left}px`;
    pillEl.style.top = `${top}px`;
    pillEl.style.bottom = "auto";
    pillEl.style.transform = "none";
  } else {
    applyDefaultPillPosition();
  }

  document.body.appendChild(pillEl);
  requestAnimationFrame(() => pillEl?.classList.add("sonorus-visible"));

  document
    .getElementById("sonorus-playpause")
    .addEventListener("click", onPlayPause);
  document
    .getElementById("sonorus-stop")
    .addEventListener("click", () => stopTTS());
  document
    .getElementById("sonorus-close")
    .addEventListener("click", () => stopTTS());
  document
    .getElementById("sonorus-speed")
    .addEventListener("input", onSpeedChange);
  document
    .getElementById("sonorus-voice")
    .addEventListener("change", onVoiceChange);

  document
    .getElementById("sonorus-drag")
    .addEventListener("mousedown", onDragStart);
}

function applyDefaultPillPosition() {
  if (!pillEl) return;
  const pos = settings.pillPosition || "bottom-center";
  pillEl.style.bottom = "24px";
  pillEl.style.top = "auto";
  if (pos === "bottom-left") {
    pillEl.style.left = "24px";
    pillEl.style.transform = "none";
  } else if (pos === "bottom-right") {
    pillEl.style.left = "auto";
    pillEl.style.right = "24px";
    pillEl.style.transform = "none";
  } else {
    pillEl.style.left = "50%";
    pillEl.style.transform = "translateX(-50%)";
  }
}

function hidePill() {
  if (pillEl) {
    pillEl.remove();
    pillEl = null;
    showPopupIconIfNeeded();
  }
}

function setPillState(state) {
  if (!pillEl) return;
  pillEl.setAttribute("data-state", state);
  const btn = document.getElementById("sonorus-playpause");
  if (!btn) return;
  if (state === "playing") {
    btn.textContent = "❚❚";
    btn.title = "Pause";
  } else if (state === "paused" || state === "loading") {
    btn.textContent = "▶";
    btn.title = "Play";
  } else {
    btn.textContent = "▶";
  }
}

function resolvePillTheme() {
  if (settings.pillTheme === "light") return "light";
  if (settings.pillTheme === "dark") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

// ─── Pill control handlers ────────────────────────────────────────────────────

function onPlayPause() {
  if (speechSynthesis.paused) {
    speechSynthesis.resume();
  } else if (speechSynthesis.speaking) {
    speechSynthesis.pause();
  }
}

function updateProgressBar() {
  const fill = document.getElementById("sonorus-progress-fill");
  if (!fill || !currentText.length) return;
  fill.style.width = `${(currentCharIndex / currentText.length) * 100}%`;
}

function restartFromCurrentPosition(rate, voiceOverride) {
  const resumeFrom = currentCharIndex;
  const resumeText = currentText.slice(resumeFrom);
  if (!resumeText) return;

  const wasPaused = speechSynthesis.paused;
  speechSynthesis.cancel();

  currentUtteranceOffset = resumeFrom;
  currentUtterance = new SpeechSynthesisUtterance(resumeText);
  currentUtterance.rate = rate ?? settings.defaultSpeed;
  currentUtterance.pitch = settings.pitch;
  const voice = voiceOverride ?? getSelectedVoice();
  if (voice) {
    currentUtterance.voice = voice;
    currentUtterance.lang = voice.lang;
  }
  attachUtteranceEvents(currentUtterance);
  speechSynthesis.speak(currentUtterance);
  if (wasPaused) speechSynthesis.pause();
}

function onSpeedChange(e) {
  const rate = parseFloat(e.target.value);
  settings.defaultSpeed = rate;
  const label = document.getElementById("sonorus-speed-val");
  if (label) label.textContent = `${rate}x`;

  if (currentText && (speechSynthesis.speaking || speechSynthesis.paused)) {
    restartFromCurrentPosition(rate, null);
  }
}

function onVoiceChange(e) {
  settings.selectedVoiceName = e.target.value;
  chrome.storage.sync.set({ selectedVoiceName: e.target.value });

  if (currentText && (speechSynthesis.speaking || speechSynthesis.paused)) {
    restartFromCurrentPosition(null, getSelectedVoice());
  }
}

function attachUtteranceEvents(utt) {
  utt.onboundary = (e) => {
    currentCharIndex = currentUtteranceOffset + e.charIndex;
    updateProgressBar();
  };
  utt.onstart = () => {
    setPillState("playing");
    notifyBackground({
      type: "TTS_STARTED",
      text: currentText.slice(0, 100),
      speed: settings.defaultSpeed,
      voice: settings.selectedVoiceName,
    });
  };
  utt.onpause = () => {
    setPillState("paused");
    notifyBackground({ type: "TTS_PAUSED" });
  };
  utt.onresume = () => {
    setPillState("playing");
    notifyBackground({ type: "TTS_RESUMED" });
  };
  utt.onend = () => {
    currentCharIndex = currentText.length;
    updateProgressBar();
    setPillState("idle");
    notifyBackground({ type: "TTS_STOPPED" });
    setTimeout(() => hidePill(), 1500);
  };
  utt.onerror = (e) => {
    if (e.error === "interrupted" || e.error === "canceled") return;
    setPillState("error");
    notifyBackground({ type: "TTS_STOPPED" });
  };
}

// ─── Drag ─────────────────────────────────────────────────────────────────────

function onDragStart(e) {
  e.preventDefault();
  isDragging = true;
  const rect = pillEl.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  pillEl.style.transform = "none";
  pillEl.style.bottom = "auto";
  pillEl.style.right = "auto";
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);
}

function onDragMove(e) {
  if (!isDragging || !pillEl) return;
  const rect = pillEl.getBoundingClientRect();
  let left = e.clientX - dragOffsetX;
  let top = e.clientY - dragOffsetY;
  left = Math.max(0, Math.min(left, window.innerWidth - rect.width));
  top = Math.max(0, Math.min(top, window.innerHeight - rect.height));
  pillEl.style.left = `${left}px`;
  pillEl.style.top = `${top}px`;
}

function onDragEnd() {
  isDragging = false;
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragEnd);
  if (pillEl) {
    const rect = pillEl.getBoundingClientRect();
    sessionStorage.setItem(
      "sonorus-pill-pos",
      JSON.stringify({ left: rect.left, top: rect.top }),
    );
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

init();
