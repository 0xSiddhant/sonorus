# Sonorus — Project Context

> For AI agents. Read this before making any changes.

## What Is Sonorus?

A browser extension that lets users select any text on any webpage and listen to it via a floating pill player. Zero accounts, zero cloud — fully offline using the Web Speech API.

**Supported browsers:** Chrome (and Chromium forks), Firefox, and Safari 26+. The same JavaScript runs unchanged on all three — only the manifest differs. See `docs/firefox-support.md` and `docs/safari-support.md`.

**Core flow:**
1. User selects text → floating 🔊 icon appears near selection
2. User clicks icon → pill player appears, TTS starts
3. Pill player lets user play/pause/stop, change speed, pick a voice

---

## Commands

**Every command, what it produces, and what it deletes is documented in [`docs/commands.md`](../../docs/commands.md).** Read it before running or inventing any build step — it covers all npm scripts, every `scripts/safari.sh` flag combination, which folder to load into each browser, and what runs in CI.

Two things that catch agents out:

- **`npm run validate` deletes `dist/` and both zips when it finishes**, pass or fail. Use `npm run build` when you need the artifacts to persist.
- **Chromium loads `src/` directly; Firefox and Safari cannot.** Firefox needs `npm run dev:firefox` → `dev-firefox/`, Safari needs `npm run build` → `dist/chrome/`. Pointing either at `src/` picks up the wrong manifest.

---

## File Structure

```
sonorus/
├── src/                        ← Chromium loads this folder directly as an unpacked extension
│   ├── manifest.json           ← Chrome/Safari config (MV3), all entry points defined here
│   ├── manifest.firefox.json   ← Firefox config — background.scripts + options_ui + gecko id
│   ├── background.js           ← Service worker: manages TTS state, relays commands between popup ↔ content
│   ├── icons/
│   │   ├── icon16.png          ← Toolbar icon (placeholder purple circle)
│   │   ├── icon48.png          ← Extensions page icon (placeholder)
│   │   └── icon128.png         ← Chrome Web Store icon (placeholder — replace before publishing)
│   ├── content/
│   │   ├── content-state.js    ← Shared globals (loaded first — only file that declares let vars)
│   │   ├── content-tts.js      ← TTS engine: startTTS, stopTTS, attachUtteranceEvents
│   │   ├── content-popup-icon.js ← Floating 🔊 icon shown on text selection
│   │   ├── content-pill.js     ← Pill player UI + control handlers (speed, voice, play/pause)
│   │   ├── content-drag.js     ← Drag-to-reposition logic for the pill
│   │   ├── content-selection.js ← Mouse selection detection, showPopupIconIfNeeded
│   │   ├── content-main.js     ← Boot (init) + message handler (loaded last)
│   │   └── content.css         ← Styles for floating popup icon + pill player
│   ├── popup/
│   │   ├── popup.html          ← Toolbar icon click → mini dashboard
│   │   ├── popup.js            ← Status display, quick pause/stop, per-site toggle, link to settings
│   │   └── popup.css
│   └── settings/
│       ├── settings.html       ← Full settings page (opened in new tab)
│       ├── settings.js         ← All preference controls, auto-saves to chrome.storage.sync
│       └── settings.css
├── docs/
│   ├── commands.md             ← EVERY command, its outputs, and CI — start here
│   ├── firefox-support.md      ← Manifest differences, onboundary limitation, AMO submission
│   ├── safari-support.md       ← Temporary extension vs Xcode wrapper, converter gotchas
│   ├── web-speech-api-limitations.md ← Known Chrome speechSynthesis bugs + workarounds used in the codebase
│   └── chrome-tts-vs-speech-synthesis.md ← chrome.tts API explained + why speechSynthesis was chosen instead
├── scripts/
│   ├── build.js                ← Validates src/, copies to dist/chrome + dist/firefox, writes two zips
│   ├── validate.js             ← Runs build, asserts manifest integrity, then DELETES its own output
│   ├── dev-firefox.js          ← Stages dev-firefox/ with manifest.firefox.json as manifest.json
│   └── safari.sh               ← macOS only: wraps dist/chrome in an Xcode app project
├── .github/
│   └── workflows/
│       ├── release.yml         ← Auto-releases on push to main (version bump + two zips + GitHub Release)
│       └── pr-validate.yml     ← Checks PR title format + runs npm run validate
├── .agents/
│   ├── context/project.md      ← This file
│   ├── memory/                 ← Persistent AI memory across sessions
│   └── rules/git.md            ← Branch, commit, and PR rules for agents
├── assets/                     ← Store screenshots and promo tiles (currently empty)
├── commitlint.config.js        ← VESTIGIAL — no workflow references it since commitlint was removed from CI
├── package.json                ← Only dev dep: archiver (for build.js zip step)
└── .gitignore                  ← Ignores: dist/, *.zip, node_modules/, dev-firefox/, safari/, .env, .claude/, .DS_Store
```

---

## Key Architectural Decisions

### Web Speech API, not `chrome.tts`
`window.speechSynthesis` is used directly in content scripts. This gives access to 20–40+ system + Google voices. See `docs/chrome-tts-vs-speech-synthesis.md` for a full comparison — the short reason is that `chrome.tts` is unavailable in content scripts and would require routing every TTS call through `background.js` via message passing.

**Known limitations** — see `docs/web-speech-api-limitations.md` for full details:
- `speechSynthesis.pause()` / `resume()` are broken in Chrome. The codebase uses a cancel+restart workaround via `resumeTTS()` and tracks position with `onboundary` + `isTTSPaused`.
- `SpeechSynthesisUtterance.volume` is ignored on macOS — volume control was intentionally removed from the UI.

### Vanilla JS, no bundler
No React, no Webpack, no TypeScript. Edit files in `src/`, reload the extension in `chrome://extensions` — changes are live instantly. Run `npm run build` only for store submission or to stage a Firefox/Safari load.

### One source, three manifests
`src/manifest.json` (Chrome + Safari) and `src/manifest.firefox.json` differ in exactly three keys — `background`, options page, and the gecko block. `build.js` copies the right one into each `dist/` target as `manifest.json`. Safari needs no manifest of its own: Safari 16.4+ supports MV3 `service_worker` and aliases `chrome.*`, so it consumes the Chrome build verbatim. Never add browser-detection branches to the JS — if a browser needs something different, it belongs in a manifest.

### Storage schema (`chrome.storage.sync`)
Syncs across devices. Keys used throughout all JS files:

```js
{
  enabled: true,              // master on/off switch
  showPopupIcon: true,        // show 🔊 icon on text selection
  minChars: 20,               // minimum selection length to trigger
  blockedSites: [],           // hostnames where extension is disabled
  selectedVoiceName: '',      // e.g. "Google US English"
  pitch: 1.0,                 // 0.5 – 2.0
  defaultSpeed: 1.0,          // 0.5 – 2.0
  speedStep: 0.25,            // speed slider increment
  pillPosition: 'bottom-center', // 'bottom-left' | 'bottom-center' | 'bottom-right'
  pillTheme: 'auto',          // 'light' | 'dark' | 'auto'
}
```

### Message protocol (background ↔ content ↔ popup)
All communication is via `chrome.runtime.sendMessage` / `chrome.tabs.sendMessage`. No direct imports between scripts.

| Direction | Message type | Purpose |
|---|---|---|
| content → background | `TTS_STARTED` | TTS began; carries text snippet, speed, voice |
| content → background | `TTS_PAUSED` | Speech paused |
| content → background | `TTS_RESUMED` | Speech resumed |
| content → background | `TTS_STOPPED` | Speech ended or cancelled |
| popup → background | `GET_STATE` | Query current TTS status for popup display |
| popup → background | `PAUSE` / `STOP` / `RESUME` | Quick controls from popup |
| background → content | `CMD_PAUSE` | Background relays pause command to content |
| background → content | `CMD_STOP` | Background relays stop command to content |

`content-state.js` defines `notifyBackground(msg)` — a helper that wraps all `sendMessage` calls and silences errors when the extension context is invalidated (e.g. after a reload).

### Content script file split
`content/` is split into 7 files injected in order via `manifest.json`. They all share the same global scope — no bundler or ES modules needed. Load order: `content-state.js` first (declares all shared globals), then TTS/UI/drag/selection modules, then `content-main.js` last (calls `init()`). Never re-declare a shared global with `let`/`const` outside of `content-state.js`.

---

## Development Workflow

**Day-to-day on Chromium (no build needed):**
1. Edit files in `src/`
2. Go to `chrome://extensions`
3. Click the refresh icon on the Sonorus card
4. Changes are live

**Firefox / Safari** require a staged folder — see [`docs/commands.md`](../../docs/commands.md#loading-into-each-browser).

**Store submission:**
```bash
npm install       # once — installs archiver
npm run build     # → dist/chrome + dist/firefox, and two zips at the repo root
```

**Before publishing:**
- Replace placeholder icons in `src/icons/` with proper designs
- Add screenshots (1280×800px) and promo tile (440×280px) to `assets/`
- Register at Chrome Web Store developer console ($5 one-time fee)

---

## CI/CD — GitHub Actions

### `release.yml` — triggered on push to `main`

Runs automatically when a PR from `develop` merges into `main`.

| Step | What happens |
|---|---|
| Get current version | Reads latest git tag (e.g. `v1.2.3`). Falls back to `1.0.0` on first run. |
| Determine bump | Analyzes commit messages since last tag using conventional commit types |
| Calculate new version | Applies major / minor / patch bump |
| Stamp version | Updates **both** `manifest.json` and `manifest.firefox.json`, plus the version badge in `settings/settings.html` |
| Commit bump | Commits those three files straight back to `main` as `chore: sync version to v{version}...` |
| Build | `npm run build` → produces `sonorus-chrome-v{version}.zip` and `sonorus-firefox-v{version}.zip` |
| Tag | Creates and pushes git tag `v{version}` — this becomes the source of truth for the next run |
| Release | Creates a GitHub Release with **both** zips attached and auto-generated notes |

**Bump rules:**

| Commit type | Bump |
|---|---|
| `type!:` or `BREAKING CHANGE` in body | major |
| `feat:` | minor |
| Anything else (`fix`, `chore`, `refactor`, `style`, `docs`, `test`, `ci`, `build`, `perf`, `revert`) | patch |

### `pr-validate.yml` — triggered on every PR event

Two parallel jobs block a PR until both pass:

- **PR title (conventional commit)** — checks the PR title follows `<type>: <subject>` (`amannn/action-semantic-pull-request`). The PR title is the squash-merge commit message, so this directly controls what lands in git history. Allowed types: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `test`, `ci`, `build`, `perf`, `revert`. Subject must start lowercase and not end with a period.
- **Build output (dual manifest)** — `npm install` + `npm run validate`, which asserts both manifests have the right keys, that versions are in sync, and that neither zip leaked source-only files.

> **There is no commitlint job.** It was removed from CI (commit `9f4a3d2`). `commitlint.config.js` still sits in the repo but nothing reads it — individual commit messages inside a PR are no longer linted, only the PR title. Do not assume commits are validated.

### Agent rules — what NOT to do

- **Never edit the `version` field in either manifest manually** — `release.yml` owns both and commits them back to `main`; manual edits cause version conflicts on the next release run. `npm run validate` fails if the two manifests disagree.
- **Never rename the zip outputs** — `sonorus-chrome-v{version}.zip` and `sonorus-firefox-v{version}.zip` are derived from `manifest.json`; `release.yml` attaches those exact filenames
- **Never add a third manifest for Safari** — Safari consumes the Chrome build unchanged
- **Never add browser-detection branches to the JS** — differences belong in the manifests
- **PR titles must follow conventional commit format** — `pr-validate.yml` will block the PR otherwise
