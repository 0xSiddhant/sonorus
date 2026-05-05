# Firefox Support

Sonorus supports Firefox via Manifest V3. The same JavaScript source runs unchanged in both browsers — Firefox fully supports the `chrome.*` namespace in MV3 extensions.

## What changed to add Firefox support

### 1. Separate manifest (`src/manifest.firefox.json`)

Firefox requires three things the Chrome manifest doesn't have or handles differently:

| Key | Chrome (`manifest.json`) | Firefox (`manifest.firefox.json`) |
|---|---|---|
| `background` | `{ "service_worker": "background.js" }` | `{ "scripts": ["background.js"] }` |
| `options_page` | `"settings/settings.html"` | — |
| `options_ui` | — | `{ "page": "settings/settings.html", "browser_style": false }` |
| `browser_specific_settings` | Not used | `{ "gecko": { "id": "...", "strict_min_version": "109.0" } }` |

**Why `scripts` instead of `service_worker`?**
Firefox MV3 uses an event-page model for background scripts, not a true service worker. Using `scripts` works across all Firefox 109+ versions. Firefox 109 is the minimum because it's the first stable release with full MV3 support.

**Why `browser_specific_settings`?**
The `gecko` block with a unique addon `id` is required to submit to [addons.mozilla.org (AMO)](https://addons.mozilla.org). Without it, Firefox can still load the extension in developer mode but won't allow store submission.

### 2. Build script produces two zips

`npm run build` now outputs:
- `sonorus-chrome-v{version}.zip` — for the Chrome Web Store
- `sonorus-firefox-v{version}.zip` — for AMO

The Firefox zip is identical in content except `manifest.json` is replaced with `manifest.firefox.json`.

### 3. No JavaScript changes

All Chrome APIs used by Sonorus map directly to Firefox equivalents under the `chrome.*` namespace:

| API | Works in Firefox |
|---|---|
| `chrome.storage.sync` | ✅ |
| `chrome.runtime.sendMessage` | ✅ |
| `chrome.runtime.onMessage` | ✅ |
| `chrome.runtime.openOptionsPage` | ✅ |
| `chrome.tabs.query` | ✅ |
| `chrome.tabs.sendMessage` | ✅ |
| `chrome.tabs.onUpdated` | ✅ |

---

## Known Firefox limitation: `onboundary` word events

Firefox has limited support for `SpeechSynthesisUtterance.onboundary`. In Chrome, this event fires at every word boundary during playback, which Sonorus uses to drive the progress bar in the pill player. In Firefox, this event fires inconsistently or not at all for word boundaries.

**Impact:** The progress bar in the floating pill player will not move during playback on Firefox. Playback itself (start, stop, pause/resume workaround, pill UI) works correctly — only the word-by-word progress indicator is affected.

This is a [long-standing Firefox bug](https://bugzilla.mozilla.org/show_bug.cgi?id=1567000) with no timeline for a fix.

---

## Installing on Firefox (Developer Mode)

Use the `dev:firefox` script — do **not** try to load `src/manifest.firefox.json` directly (see note below).

```bash
npm install
npm run dev:firefox
# → stages dev-firefox/ with the correct manifest.json
```

Then in Firefox:
`about:debugging` → **This Firefox** → **Load Temporary Add-on** → select the **`dev-firefox/` folder**.

> **Why not load `src/manifest.firefox.json` directly?**
> Firefox resolves the extension root as the directory containing the selected file. Since both `manifest.json` (Chrome) and `manifest.firefox.json` live in `src/`, Firefox finds `manifest.json` first and uses that — ignoring the file you selected. The `dev:firefox` script puts the Firefox manifest in its own folder as `manifest.json`, eliminating the ambiguity.

For a permanent install (survives restarts), the extension must be signed by Mozilla — either via AMO or via a self-hosted signed XPI.

---

## Loading the built zip on Firefox

1. Run `npm install && npm run build`
2. Go to `about:debugging` → **This Firefox** → **Load Temporary Add-on**
3. Select `sonorus-firefox-v{version}.zip`
