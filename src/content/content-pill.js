/* content-pill.js — Floating pill player UI and its control handlers.
   Reads: settings, voices, currentText, currentCharIndex, currentUtterance.
   Writes: pillEl, currentUtterance, currentCharOffset.
   Calls: stopTTS, getSelectedVoice, attachUtteranceEvents, showPopupIcon, onDragStart, notifyBackground. */

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
    <div id="sonorus-progress-wrap"><div id="sonorus-progress-bar"></div></div>
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
  if (!pillEl) return;
  pillEl.remove();
  pillEl = null;
  // Call showPopupIcon directly (not showPopupIconIfNeeded) to avoid
  // auto-restarting TTS when the showPopupIcon setting is off and the pill is dismissed.
  if (settings.showPopupIcon) {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (text && text.length >= settings.minChars) {
      showPopupIcon(sel, text);
    }
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

function updateProgressBar() {
  const bar = document.getElementById("sonorus-progress-bar");
  if (!bar) return;
  const pct =
    currentText.length > 0
      ? Math.min(100, (currentCharIndex / currentText.length) * 100)
      : 0;
  bar.style.width = `${pct}%`;
}

// ─── Pill control handlers ────────────────────────────────────────────────────

function onPlayPause() {
  if (isTTSPaused) {
    // speechSynthesis.resume() is broken in Chrome — restart from the last tracked word position.
    isTTSPaused = false;
    resumeTTS();
    setPillState("playing");
    notifyBackground({ type: "TTS_RESUMED" });
  } else if (speechSynthesis.speaking) {
    speechSynthesis.pause();
    isTTSPaused = true;
    setPillState("paused");
    notifyBackground({ type: "TTS_PAUSED" });
  }
}

function onSpeedChange(e) {
  const rate = parseFloat(e.target.value);
  settings.defaultSpeed = rate;
  const label = document.getElementById("sonorus-speed-val");
  if (label) label.textContent = `${rate}x`;

  // If paused, don't restart — resumeTTS() reads settings.defaultSpeed so the
  // new rate will be picked up automatically when the user clicks play.
  if (!currentText || isTTSPaused) return;
  if (speechSynthesis.speaking) resumeTTS();
}

function onVoiceChange(e) {
  settings.selectedVoiceName = e.target.value;
  chrome.storage.sync.set({ selectedVoiceName: e.target.value });

  // If paused, don't restart — resumeTTS() reads settings.selectedVoiceName so the
  // new voice will be picked up automatically when the user clicks play.
  if (!currentText || isTTSPaused) return;
  if (speechSynthesis.speaking) resumeTTS();
}
