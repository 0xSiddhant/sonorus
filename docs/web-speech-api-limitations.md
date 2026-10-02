# Web Speech API — Known Limitations in Chrome

## Pause / Resume is broken

`speechSynthesis.pause()` and `speechSynthesis.resume()` are **broken in Chrome** and have been for years. These are open Chromium bugs with no timeline for a fix.

### Symptoms

| API call | Expected | Actual in Chrome |
|---|---|---|
| `pause()` | Audio pauses | Sometimes has no effect — audio keeps playing |
| `resume()` | Audio resumes | Silently does nothing on most Chrome versions |
| `speechSynthesis.paused` | `true` after `pause()` | Unreliable — may stay `false` |
| `utterance.onpause` | Fires after pause | Often never fires |
| `utterance.onresume` | Fires after resume | Often never fires |

### Current workaround (implemented in `src/content/content-tts.js`)

True pause/resume is replaced by **cancel + restart from position**:

1. Text is spoken one sentence-sized chunk per utterance (`prepareChunk()`), so `currentCharIndex` is known at every chunk start; `onboundary` events refine it word-by-word for voices that fire them (see below)
2. `isTTSPaused` (in `content-state.js`) tracks whether we're in a "paused" state — we own this flag because `speechSynthesis.paused` is unreliable
3. On "pause": `pauseTTS()` cancels the utterance and sets `isTTSPaused = true` — it **never calls `speechSynthesis.pause()`**. Besides the bugs above, after `pause()` Chrome could speak the next utterance in the default voice instead of the one set on it (seen when switching voice mid-playback, then pausing and resuming)
4. On "resume": call `resumeTTS()` which cancels the utterance and speaks the chunk starting at `currentCharIndex`

**Side effect:** there is a brief audible gap between the cancel and the new utterance starting up. This is inherent to the workaround and cannot be eliminated with `window.speechSynthesis`.

**Key functions:**
- `resumeTTS()` — `content-tts.js` — restart from `currentCharIndex`
- `pauseTTS()` — `content-tts.js` — cancel and remember position
- `isTTSPaused` — `content-state.js` — source of truth for pause state
- `onPlayPause()` — `content-pill.js` — uses `isTTSPaused`, calls `resumeTTS()`

---

## `speechSynthesis.paused` / `.speaking` are unreliable

Both properties can return stale values. Never use them to drive logic — use owned state variables (`isTTSPaused`, `currentUtterance !== null`) instead.

---

## `onboundary` charIndex is utterance-relative

`SpeechSynthesisUtterance.onboundary` fires with `e.charIndex` relative to **that utterance's text**, not the full `currentText`. When speed/voice changes restart speech from a mid-text offset, `currentCharOffset` stores that offset so the absolute position is always `currentCharOffset + e.charIndex`.

---

## Network voices never fire `onboundary`

Chrome's Google voices (`Google US English`, `Google हिन्दी`, …) are synthesised remotely and fire only `start` / `end` — no word `boundary` events. Local OS voices do fire them. Firefox fires them inconsistently for any voice.

Sonorus used to speak the whole selection as one utterance and track position purely from `onboundary`, so with a Google voice `currentCharIndex` stayed at `0`: speed/voice changes and resume restarted from the beginning, and the progress bar never moved.

The fix is chunking: `nextChunkEnd()` splits at the first sentence end (`. ! ? ।`) or line break, else the last space within `MAX_CHUNK_CHARS` (200). Each chunk's `onend` speaks the next one. With a network voice the position is accurate to the current sentence; with a local voice it is still accurate to the word.

**Trade-offs:** network voices fetch each chunk separately, so there can be a short gap between sentences. Abbreviations like `Dr.` end a chunk early, which only adds a slight pause.

---

## The speech queue is shared across tabs

Chrome runs every page's `speechSynthesis` through one browser-wide `TtsController`. `speechSynthesis.cancel()` from **any tab** stops the current utterance if it came from the same origin (`TtsControllerImpl::StopCurrentUtteranceIfMatches`), and the tab that was speaking receives `onerror` with `"interrupted"`.

Consequences in the codebase:
- `stopTTS()` only calls `cancel()` when this tab owns `currentUtterance`. Otherwise the `pagehide` handler in an idle tab (e.g. reloading it) would silently kill playback in another tab.
- Every self-initiated `cancel()` nulls the utterance handlers first, so an `"interrupted"`/`"canceled"` that reaches `onerror` means another tab took over — the pill resets instead of staying stuck on "playing".
- `background.js` ignores `TTS_PAUSED` / `TTS_RESUMED` / `TTS_STOPPED` from any tab other than the one that sent the latest `TTS_STARTED`.

---

## Volume control doesn't work on macOS

`SpeechSynthesisUtterance.volume` is ignored by Chrome on macOS — the system audio level controls volume instead. This is why Sonorus has no volume slider. It was intentionally removed rather than showing a control that does nothing.

---

## If seamless pause/resume becomes a hard requirement

The only path to true seamless pause/resume without the audible gap is switching away from `window.speechSynthesis`. Options:

| Approach | Trade-off |
|---|---|
| Web Audio API + cloud TTS (e.g. Google TTS, ElevenLabs) | Seamless control, offline mode lost, costs money per character |
| Web Audio API + local model (e.g. Kokoro WASM) | Offline, no gap, but large download (~50–200 MB) |
| `chrome.tts` API | Native OS voices, but only accessible from background/popup — not content scripts without message relay |

All three are significant architectural changes from the current zero-dependency, fully-offline design.
