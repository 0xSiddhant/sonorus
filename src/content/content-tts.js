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
  // Chrome's speech queue is browser-wide: take it over so this tab doesn't
  // wait behind an utterance still playing in another tab.
  speechSynthesis.cancel();
  currentText = text;

  showPill();
  setPillState("loading");
  speechSynthesis.speak(prepareChunk(0));
}

// Network voices (e.g. "Google हिन्दी") never fire onboundary, so the spoken
// position can't be tracked word-by-word. Speaking one sentence-sized chunk per
// utterance makes the position known at every chunk start: speed/voice changes
// and resume restart from the current sentence instead of the beginning, and
// the progress bar advances per chunk. Voices that do fire onboundary still
// refine the position word-by-word within each chunk.
const MAX_CHUNK_CHARS = 200;

// Returns the end index (exclusive) of the chunk starting at `start`: the first
// sentence end (incl. Devanagari danda) or line break, else the last space
// within MAX_CHUNK_CHARS, else a hard cut.
function nextChunkEnd(text, start) {
  const hardEnd = Math.min(text.length, start + MAX_CHUNK_CHARS);
  const span = text.slice(start, hardEnd);
  const sentence = span.match(/[.!?।॥]+["'”’)\]]*\s|\n/);
  if (sentence) return start + sentence.index + sentence[0].length;
  if (hardEnd === text.length) return hardEnd;
  const lastSpace = span.search(/\s\S*$/);
  return lastSpace > 0 ? start + lastSpace + 1 : hardEnd;
}

// Builds the utterance for the chunk starting at `offset` and makes it current.
// The caller is responsible for speak() — resumeTTS() must defer it.
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
    // cancel() stops whatever is speaking from this origin in ANY tab, so only
    // call it when this tab owns the utterance — otherwise a reload or Stop in
    // an idle tab would kill playback in another tab.
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

// Pause = remember the position and cancel, never speechSynthesis.pause().
// resumeTTS() restarts from currentCharIndex regardless, and Chrome's pause()
// is broken: it sometimes keeps playing, and after it the next utterance can
// ignore its voice and fall back to the default one.
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
    currentUtterance = null; // finished — this tab no longer owns the speech queue
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
      // Our own cancel() calls null these handlers first, so reaching here means
      // another tab cancelled or took over the shared speech queue. Reset the
      // pill instead of leaving it stuck on "playing". Drop the utterance first
      // so stopTTS() skips cancel() and doesn't kill the tab that took over.
      currentUtterance = null;
      stopTTS();
      return;
    }
    isTTSPaused = false;
    setPillState("error");
    notifyBackground({ type: "TTS_STOPPED" });
  };
}
