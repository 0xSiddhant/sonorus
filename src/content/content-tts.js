/* content-tts.js — TTS engine: start, stop, and utterance lifecycle.
   Reads: settings, voices, currentText, pillHideTimer, currentCharOffset.
   Writes: currentUtterance, currentText, voices, pillHideTimer, currentCharIndex, currentCharOffset.
   Calls: showPill, hidePill, setPillState, updateProgressBar, notifyBackground. */

function loadVoices() {
  voices = speechSynthesis.getVoices();
}

function getSelectedVoice() {
  if (!settings.selectedVoiceName) return null;
  return voices.find((v) => v.name === settings.selectedVoiceName) || null;
}

function startTTS(text) {
  // Clear any pending auto-hide from a prior session before starting fresh.
  if (pillHideTimer) {
    clearTimeout(pillHideTimer);
    pillHideTimer = null;
  }
  stopTTS(false);
  currentText = text;
  currentCharIndex = 0;
  currentCharOffset = 0;

  showPill();
  setPillState("loading");
  updateProgressBar();

  currentUtterance = new SpeechSynthesisUtterance(text);
  currentUtterance.rate = settings.defaultSpeed;
  currentUtterance.pitch = settings.pitch;

  const voice = getSelectedVoice();
  if (voice) {
    currentUtterance.voice = voice;
    currentUtterance.lang = voice.lang;
  }

  attachUtteranceEvents(currentUtterance);
  speechSynthesis.speak(currentUtterance);
}

function stopTTS(hidePillAfter = true) {
  if (pillHideTimer) {
    clearTimeout(pillHideTimer);
    pillHideTimer = null;
  }
  // Null handlers before cancel — Chrome fires onend on the canceled utterance,
  // which would otherwise schedule a stale hidePill() 1.5s later.
  if (currentUtterance) {
    currentUtterance.onboundary = null;
    currentUtterance.onstart = null;
    currentUtterance.onend = null;
    currentUtterance.onerror = null;
    currentUtterance.onpause = null;
    currentUtterance.onresume = null;
  }
  speechSynthesis.cancel();
  currentUtterance = null;
  currentText = "";
  currentCharIndex = 0;
  currentCharOffset = 0;
  isTTSPaused = false;
  if (hidePillAfter) {
    setPillState("idle");
    notifyBackground({ type: "TTS_STOPPED" });
    hidePill();
  }
}

function resumeTTS() {
  if (!currentText) return;
  // Snap back to the start of the word at currentCharIndex.
  // onboundary already fires at word starts, but this guards against mid-word positions from Chrome quirks.
  let resumeOffset = currentCharIndex;
  while (resumeOffset > 0 && /\S/.test(currentText[resumeOffset - 1])) {
    resumeOffset--;
  }
  if (currentUtterance) {
    currentUtterance.onboundary = null;
    currentUtterance.onstart = null;
    currentUtterance.onend = null;
    currentUtterance.onerror = null;
    currentUtterance.onpause = null;
    currentUtterance.onresume = null;
  }
  speechSynthesis.cancel();
  // Chrome bug: pause() leaves speechSynthesis.paused=true even after cancel(),
  // so the next speak() queues but never fires. resume() force-clears that flag.
  speechSynthesis.resume();

  currentCharOffset = resumeOffset;
  currentCharIndex = resumeOffset;
  currentUtterance = new SpeechSynthesisUtterance(
    currentText.slice(resumeOffset),
  );
  currentUtterance.rate = settings.defaultSpeed;
  currentUtterance.pitch = settings.pitch;
  const voice = getSelectedVoice();
  if (voice) {
    currentUtterance.voice = voice;
    currentUtterance.lang = voice.lang;
  }
  attachUtteranceEvents(currentUtterance);
  // Chrome drops speak() called synchronously after cancel(); defer to next tick.
  const utt = currentUtterance;
  setTimeout(() => {
    if (currentUtterance === utt) speechSynthesis.speak(utt);
  }, 0);
}

function attachUtteranceEvents(utt) {
  // charIndex from onboundary is relative to this utterance's text slice,
  // so add currentCharOffset to get the absolute position in currentText.
  utt.onboundary = (e) => {
    currentCharIndex = currentCharOffset + e.charIndex;
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
    isTTSPaused = true;
    setPillState("paused");
    notifyBackground({ type: "TTS_PAUSED" });
  };
  utt.onresume = () => {
    isTTSPaused = false;
    setPillState("playing");
    notifyBackground({ type: "TTS_RESUMED" });
  };
  utt.onend = () => {
    currentCharIndex = 0;
    currentCharOffset = 0;
    isTTSPaused = false;
    updateProgressBar();
    setPillState("idle");
    notifyBackground({ type: "TTS_STOPPED" });
    pillHideTimer = setTimeout(() => {
      pillHideTimer = null;
      hidePill();
    }, 1500);
  };
  utt.onerror = (e) => {
    if (e.error === "interrupted" || e.error === "canceled") return;
    isTTSPaused = false;
    setPillState("error");
    notifyBackground({ type: "TTS_STOPPED" });
  };
}
