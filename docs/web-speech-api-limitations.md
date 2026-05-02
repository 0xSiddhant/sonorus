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

1. `onboundary` events track the last spoken word's character index into `currentCharIndex`
2. `isTTSPaused` (in `content-state.js`) tracks whether we're in a "paused" state — we own this flag because `speechSynthesis.paused` is unreliable
3. On "pause": call `speechSynthesis.pause()` (best effort) + set `isTTSPaused = true`, update UI
4. On "resume": call `resumeTTS()` which cancels the utterance and creates a new one from `currentText.slice(currentCharIndex)`

**Side effect:** there is a brief audible gap between the cancel and the new utterance starting up. This is inherent to the workaround and cannot be eliminated with `window.speechSynthesis`.

**Key functions:**
- `resumeTTS()` — `content-tts.js` — restart from `currentCharIndex`
- `isTTSPaused` — `content-state.js` — source of truth for pause state
- `onPlayPause()` — `content-pill.js` — uses `isTTSPaused`, calls `resumeTTS()`

---

## `speechSynthesis.paused` / `.speaking` are unreliable

Both properties can return stale values. Never use them to drive logic — use owned state variables (`isTTSPaused`, `currentUtterance !== null`) instead.

---

## `onboundary` charIndex is utterance-relative

`SpeechSynthesisUtterance.onboundary` fires with `e.charIndex` relative to **that utterance's text**, not the full `currentText`. When speed/voice changes restart speech from a mid-text offset, `currentCharOffset` stores that offset so the absolute position is always `currentCharOffset + e.charIndex`.

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
