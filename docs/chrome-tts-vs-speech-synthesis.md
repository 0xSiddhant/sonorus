# chrome.tts vs window.speechSynthesis

## What is chrome.tts?

`chrome.tts` is a Chrome Extension API that provides text-to-speech via the operating system's native TTS engine. It is only available inside extension pages — background service workers, popups, options pages — and is declared in `manifest.json` with the `"tts"` permission.

```json
// manifest.json
{
  "permissions": ["tts"]
}
```

Basic usage:

```js
// Speak
chrome.tts.speak("Hello world", {
  rate: 1.5,
  pitch: 1.0,
  voiceName: "Google US English",
  onEvent: (event) => {
    if (event.type === "end") console.log("Done");
    if (event.type === "word") console.log("Word boundary at", event.charIndex);
  }
});

// Pause / resume (actually works)
chrome.tts.pause();
chrome.tts.resume();

// Stop
chrome.tts.stop();

// Query available voices
chrome.tts.getVoices((voices) => {
  console.log(voices); // [{voiceName, lang, extensionId, eventTypes, ...}]
});
```

Events emitted via `onEvent`: `start`, `word`, `sentence`, `marker`, `end`, `error`, `interrupted`, `cancelled`, `pause`, `resume`.

---

## What is window.speechSynthesis?

`window.speechSynthesis` is the browser's built-in Web Speech API, available in any web page or content script — no extension permissions needed. It works by creating a `SpeechSynthesisUtterance` object and passing it to `speechSynthesis.speak()`.

```js
const utt = new SpeechSynthesisUtterance("Hello world");
utt.rate = 1.5;
utt.pitch = 1.0;
utt.voice = speechSynthesis.getVoices().find(v => v.name === "Google US English");

utt.onboundary = (e) => console.log("Boundary at", e.charIndex);
utt.onend = () => console.log("Done");

speechSynthesis.speak(utt);
speechSynthesis.pause();   // broken in Chrome
speechSynthesis.resume();  // broken in Chrome
speechSynthesis.cancel();
```

---

## Side-by-side comparison

| Feature | `chrome.tts` | `window.speechSynthesis` |
|---|---|---|
| Available in content scripts | ❌ No | ✅ Yes |
| Available in background / popup | ✅ Yes | ✅ Yes (but quirky) |
| Manifest permission required | ✅ `"tts"` | ❌ None |
| Pause / resume | ✅ Works reliably | ❌ Broken in Chrome |
| Word boundary events | ✅ `word` event | ✅ `onboundary` (unreliable timing) |
| Voice list | ✅ System + extension voices | ✅ System + Google voices |
| Number of voices | Fewer (system only) | More (includes Google cloud voices) |
| Works offline | ✅ Yes (system voices) | ✅ Yes (system voices) |
| Volume control | ✅ Works | ❌ Ignored on macOS |
| `charIndex` in events | ✅ Accurate | ⚠️ Approximate (word-level) |
| API stability | ✅ Stable extension API | ⚠️ Long-standing bugs unfixed |

---

## Why Sonorus uses speechSynthesis instead of chrome.tts

### 1. Content scripts can't use chrome.tts

TTS in Sonorus is driven from `content-tts.js`, which is injected into the page as a content script. Content scripts **do not have access to `chrome.tts`** — the API is restricted to extension pages (background, popup, options).

To use `chrome.tts`, every TTS action (start, stop, pause, position tracking) would need to be relayed through the background service worker via `chrome.runtime.sendMessage`. This adds round-trip latency, complicates state management (who owns current position? who tracks `onEvent`?), and means the background worker must stay alive for the entire playback duration — which conflicts with MV3's short-lived service worker model.

### 2. More voices with speechSynthesis

`window.speechSynthesis` exposes 20–40+ voices on a typical Chrome install, including high-quality Google cloud voices (e.g. "Google US English", "Google हिन्दी"). `chrome.tts` only exposes the OS's native system voices, which are fewer and generally lower quality on Windows and macOS.

### 3. No extra permission needed

`window.speechSynthesis` requires zero manifest permissions. Adding `"tts"` to permissions is a minor trust signal that appears in the Chrome Web Store review and install prompt — unnecessary when the Web Speech API already covers the use case.

---

## When you should use chrome.tts instead

- You need **reliable pause/resume** without the cancel+restart gap (see `docs/web-speech-api-limitations.md`)
- Your TTS logic lives in the **background service worker or popup** anyway
- You need **accurate `charIndex`** for word highlighting in a content script (relay events from background to content via messaging)
- You're building a TTS engine extension that **registers custom voices** via `chrome.ttsEngine`

---

## What a chrome.tts migration would look like for Sonorus

1. Move all TTS calls out of `content-tts.js` into `background.js`
2. Content script sends commands: `{ type: "TTS_START", text }`, `{ type: "TTS_PAUSE" }`, etc.
3. Background calls `chrome.tts.speak()`, `chrome.tts.pause()`, `chrome.tts.resume()`
4. Background relays `onEvent` back to content via `chrome.tabs.sendMessage` for progress bar + pill state updates
5. Remove `isTTSPaused` workaround — `chrome.tts.pause()`/`resume()` work correctly

This is a significant refactor but would eliminate the audible gap on pause/resume and the `isTTSPaused` workaround entirely.
