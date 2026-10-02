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
  // Take over the speech queue, which Chrome shares across tabs.
  speechSynthesis.cancel();
  currentText = text;

  showPill();
  setPillState("loading");
  speechSynthesis.speak(prepareChunk(0));
}

// Google voices never fire onboundary, so speak one sentence per utterance to
// keep the position known. See docs/web-speech-api-limitations.md.
const MAX_CHUNK_CHARS = 200;

// First sentence end (incl. Hindi danda) or line break, else the last space.
function nextChunkEnd(text, start) {
  const hardEnd = Math.min(text.length, start + MAX_CHUNK_CHARS);
  const span = text.slice(start, hardEnd);
  const sentence = span.match(/[.!?।॥]+["'”’)\]]*\s|\n/);
  if (sentence) return start + sentence.index + sentence[0].length;
  if (hardEnd === text.length) return hardEnd;
  const lastSpace = span.search(/\s\S*$/);
  return lastSpace > 0 ? start + lastSpace + 1 : hardEnd;
}

function prepareChunk(offset) {
  while (offset < currentText.length && /\s/.test(currentText[offset])) {
    offset++;
  }
  const end = nextChunkEnd(currentText, offset);
  currentCharOffset = offset;
  currentCharIndex = offset;
  updateProgressBar();

  currentUtterance = new SpeechSynthesisUtterance(currentText.slice(offset, end));
  currentUtterance.rate = settings.defaultSpeed;
  currentUtterance.pitch = settings.pitch;
  const voice = getSelectedVoice();
  if (voice) {
    currentUtterance.voice = voice;
    currentUtterance.lang = voice.lang;
  }
  attachUtteranceEvents(currentUtterance, end);
  return currentUtterance;
}

function stopTTS(hidePillAfter = true) {
  if (pillHideTimer) {
    clearTimeout(pillHideTimer);
    pillHideTimer = null;
  }
  // Null handlers before cancel — Chrome fires onend on the canceled utterance,
  // which would otherwise schedule a stale hidePill() 1.5s later.
  if (currentUtterance) {
    detachUtteranceEvents(currentUtterance);
    // cancel() also stops other tabs' speech — only call it if this tab is speaking.
    speechSynthesis.cancel();
  }
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

// Chrome's pause() is broken and can drop the voice on resume, so cancel
// instead — resumeTTS() restarts from the saved position.
function pauseTTS() {
  if (!currentUtterance || isTTSPaused) return;
  detachUtteranceEvents(currentUtterance);
  speechSynthesis.cancel();
  currentUtterance = null;
  isTTSPaused = true;
  setPillState("paused");
  notifyBackground({ type: "TTS_PAUSED" });
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
    detachUtteranceEvents(currentUtterance);
  }
  speechSynthesis.cancel();
  // Chrome bug: pause() leaves speechSynthesis.paused=true even after cancel(),
  // so the next speak() queues but never fires. resume() force-clears that flag.
  speechSynthesis.resume();

  const utt = prepareChunk(resumeOffset);
  // Chrome drops speak() called synchronously after cancel(); defer to next tick.
  setTimeout(() => {
    if (currentUtterance === utt) speechSynthesis.speak(utt);
  }, 0);
}

function detachUtteranceEvents(utt) {
  utt.onboundary = null;
  utt.onstart = null;
  utt.onend = null;
  utt.onerror = null;
  utt.onpause = null;
  utt.onresume = null;
}

function attachUtteranceEvents(utt, chunkEnd) {
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
    if (currentText.slice(chunkEnd).trim()) {
      speechSynthesis.speak(prepareChunk(chunkEnd));
      return;
    }
    currentUtterance = null;
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
    if (e.error === "interrupted" || e.error === "canceled") {
      // We detach handlers before our own cancels, so another tab interrupted us.
      // Null the utterance so stopTTS() doesn't cancel that tab's speech.
      currentUtterance = null;
      stopTTS();
      return;
    }
    currentUtterance = null;
    isTTSPaused = false;
    setPillState("error");
    notifyBackground({ type: "TTS_STOPPED" });
  };
}
