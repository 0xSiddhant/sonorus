# Safari Support

Sonorus runs on Safari with **no third manifest and no JavaScript changes**. Safari 16.4+ supports Manifest V3 including `background.service_worker`, and aliases the `chrome.*` namespace to `browser.*` — so the existing Chrome build (`dist/chrome`) is the correct input.

For *distribution*, Safari requires a wrapper: the extension must ship inside a macOS or iOS app bundle, which Xcode generates from the extension directory. For *development* it does not — Safari 26 can load an unpacked folder directly.

There are two ways to run it, and for day-to-day development you do **not** need Xcode:

| | Xcode needed? | Survives Safari restart? | Use for |
|---|---|---|---|
| [Temporary extension](#development-no-xcode-required) | No | No | Development, matches Chrome's "Load unpacked" |
| [Xcode app wrapper](#packaging-xcode) | Yes | Yes | Distribution, App Store |

---

## Development (no Xcode required)

Safari 26 added **Add Temporary Extension…**, the direct equivalent of Chrome's *Load unpacked*. Point it at a folder containing `manifest.json` and Safari loads it in place — no app wrapper, no build, no signing.

```bash
npm install
npm run build        # → dist/chrome
```

Then in Safari:

1. **Safari** → **Settings…** → **Developer** tab
2. Click **Add Temporary Extension…**
3. Authenticate with your password or Touch ID — Safari always requires this
4. Select the **`dist/chrome/` folder**
5. **Settings** → **Extensions** → enable **Sonorus**
6. Click the toolbar icon → **Allow on Every Website**

If the **Developer** tab isn't visible: **Settings** → **Advanced** → check **Show features for web developers**.

> **Use `dist/chrome/`, not `src/`.** Both `manifest.json` and `manifest.firefox.json` live in `src/`, so loading `src/` drags the unused Firefox manifest along as a bundled resource. `dist/chrome/` is a clean tree with exactly the right `manifest.json` — the same input the Xcode converter uses.

Safari also accepts a **zip archive**, so `sonorus-chrome-v{version}.zip` from `npm run build` works if you'd rather test the exact release artifact.

### Lifecycle

The extension is unloaded when you quit Safari — this is development-only, by design. Re-add it after each restart. After editing source, re-run `npm run build` and reload the extension.

Unlike the Xcode path, this does **not** require toggling *Allow Unsigned Extensions*; the per-load authentication prompt replaces it.

### Known limitation: background service worker debugging

Safari's Web Inspector cannot attach to an MV3 `background.service_worker`. Sonorus's Chrome manifest uses exactly that, so `background.js` is not directly debuggable in this mode. Content scripts, the popup, and the settings page all inspect normally.

Workaround, if you need to step through `background.js`: temporarily load `dist/firefox/` instead, which declares `background.scripts` (a non-persistent background page) and *is* inspectable. Safari ignores the `browser_specific_settings.gecko` block. Untested — verify before relying on it.

---

## Packaging (Xcode)

For anything that must survive a Safari restart, or for distribution, the extension has to be wrapped in an app:

```bash
npm run dev:safari          # → safari/Sonorus/Sonorus.xcodeproj
```

Or drive it directly:

```bash
scripts/safari.sh --build --open            # also compile, then open Xcode
scripts/safari.sh --bundle-id com.you.App   # custom bundle identifier
scripts/safari.sh --help
```

| Flag | Default | Purpose |
|---|---|---|
| `--bundle-id <id>` | `com.0xSiddhant.Sonorus` | Bundle identifier for the generated app |
| `--build` | off | Compile with `xcodebuild` after generating |
| `--open` | off | Open the project in Xcode when done |
| `--force` | off | Overwrite an existing `safari/` directory |

The script targets **macOS only**. Sonorus's UI is a draggable floating pill driven by text selection, which doesn't translate to iOS Safari — if you ever need an iOS target, add `--ios-only` or drop `--macos-only` from the converter call in the script.

---

## Why no `manifest.safari.json`

Unlike Firefox, Safari needs no manifest divergence. Every key the Chrome manifest uses is supported:

| Key | Safari |
|---|---|
| `manifest_version: 3` | ✅ Safari 16.4+ |
| `background.service_worker` | ✅ Safari 16.4+ |
| `options_page` | ✅ (`options_ui` also works) |
| `action.default_popup` | ✅ |
| `permissions: storage, activeTab, tabs` | ✅ |
| `host_permissions: <all_urls>` | ✅ — but **not auto-granted**, see below |

Same for the APIs — Safari maps `chrome.*` onto its own `browser.*` implementation, and supports callback-style calls plus `chrome.runtime.lastError`:

| API | Works in Safari |
|---|---|
| `chrome.storage.sync` | ✅ |
| `chrome.runtime.sendMessage` / `onMessage` | ✅ |
| `chrome.runtime.openOptionsPage` | ✅ |
| `chrome.tabs.query` / `sendMessage` / `onUpdated` | ✅ |

Because the Firefox manifest's `browser_specific_settings.gecko` block would be meaningless to Safari, the script converts `dist/chrome`, never `dist/firefox`. The validation step asserts that no gecko keys leaked into the bundled resources.

---

## The converter command

The underlying tool is Xcode's Safari web extension converter. Two things bite people:

**The flag is `--copy-resources`, plural.** With `--copy-resource` the argument parser swallows the path that follows and reports a misleading error that points at the path instead of the flag:

```
$ xcrun safari-web-extension-converter --copy-resource dist/chrome
Please provide a path to a web extension to convert.
```

**The path must be a directory containing `manifest.json`.** Pointing at the repo root fails, because the manifests live in `src/`:

```
$ xcrun safari-web-extension-converter --copy-resources /path/to/sonorus
Unable to parse manifest.json at file:///path/to/sonorus/
```

`--copy-resources` matters beyond just working: without it the generated project only *references* `dist/chrome`, which the next `npm run build` wipes out. The script always passes it so the project is self-contained.

> `safari-web-extension-packager` is the legacy name for the same tool and still works. `safari-web-extension-converter` is current; the script prefers it and falls back automatically.

---

## Installing the Xcode build in Safari

1. `npm run dev:safari`
2. `open safari/Sonorus/Sonorus.xcodeproj`
3. Set your Team under **Signing & Capabilities** for **both** the `Sonorus` and `Sonorus Extension` targets — Xcode does not clearly warn you if only one is set.
4. Build & run the container app once (⌘R). This is what registers the extension with Safari — the app window itself does nothing but link to Safari settings.
5. Safari → **Settings** → **Advanced** → check **Show features for web developers**.
6. **Develop** menu → **Allow Unsigned Extensions**.
7. Safari → **Settings** → **Extensions** → enable **Sonorus**.
8. Click the toolbar icon → **Allow on Every Website**.

> **Step 8 is not optional.** Safari does not auto-grant `<all_urls>` the way Chrome does — it always starts at "Ask". Until you grant it, content scripts never inject and the extension appears completely dead with no error anywhere. This applies to the temporary-extension flow too.

> **Step 6 resets on every Safari restart.** To avoid it, sign the app with a Developer ID and notarize it — supported since Safari 18.4.

---

## Runtime status

Playback was **verified working on Safari 26.5 / macOS 26.5 (July 2026)** — selection, the floating pill, and playback controls all behave correctly. No Safari-specific code changes were needed.

**Watch the pause/resume path if it ever regresses.** Two places still carry Chrome-specific workarounds for Chrome's broken `speechSynthesis.resume()`:

- `src/content/content-tts.js` — cancels then calls `resume()` to clear Chrome's stuck `paused` flag.
- `src/content/content-pill.js` — *"speechSynthesis.resume() is broken in Chrome — restart from the last tracked word position"*, so resume re-speaks from the last tracked word.

Safari's `resume()` is not broken, so this restart path is redundant there rather than necessary. It tested fine, but it's the first thing to check if resume ever starts replaying or skipping words on Safari.

**Voice list differs.** Safari exposes the macOS system voices, which are named differently from Chrome's. A `selectedVoiceName` saved on Chrome will not resolve on Safari; playback falls back to the default voice.

---

## Distribution

Safari extensions cannot be side-loaded permanently. Options:

1. **App Store** — archive the container app in Xcode (**Product → Archive**) and submit through App Store Connect. Requires a paid Apple Developer account. The extension is reviewed as part of the app.
2. **Developer ID + notarization** — distribute the `.app` directly outside the App Store. Also requires a paid account.

There is no free permanent-install path equivalent to Firefox's self-hosted signed XPI.

### There is no Safari zip

`npm run build` produces `sonorus-chrome-v{version}.zip` and `sonorus-firefox-v{version}.zip` because the Chrome Web Store and AMO both ingest a zip of the extension files. **Safari has no equivalent** — Apple's pipeline only accepts a signed app archive, so a Safari zip would have nowhere to go.

It would also be redundant: Safari runs the unmodified Chrome manifest, so the extension resources inside the generated Xcode project are byte-for-byte identical to `dist/chrome`:

```bash
diff -r dist/chrome "safari/Sonorus/Sonorus Extension/Resources"   # no differences
```

If you want to test from an archive rather than a folder, **Add Temporary Extension…** accepts `sonorus-chrome-v{version}.zip` directly.

`release.yml` therefore attaches only the Chrome and Firefox zips. Automating Safari releases would mean importing a signing certificate into the CI keychain plus `notarytool` credentials — an unsigned `.app` is useless to end users, since it needs *Allow Unsigned Extensions*, which resets on every Safari restart.
