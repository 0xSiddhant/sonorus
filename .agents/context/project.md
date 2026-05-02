# Sonorus — Project Context

> For AI agents. Read this before making any changes.

## What Is Sonorus?

A Chrome extension that lets users select any text on any webpage and listen to it via a floating pill player. Zero accounts, zero cloud — fully offline using the Web Speech API.

**Core flow:**
1. User selects text → floating 🔊 icon appears near selection
2. User clicks icon → pill player appears, TTS starts
3. Pill player lets user play/pause/stop, change speed, pick a voice

---

## File Structure

```
sonorus/
├── src/                        ← Load this folder as unpacked Chrome extension
│   ├── manifest.json           ← Extension config (MV3), all entry points defined here
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
├── scripts/
│   └── build.js                ← Validates src/, copies to dist/, zips for Chrome Web Store
├── .github/
│   └── workflows/
│       ├── release.yml         ← Auto-releases on push to main (version bump + zip + GitHub Release)
│       └── pr-validate.yml     ← Blocks PRs with non-conventional commit messages
├── .agents/
│   ├── context/project.md      ← This file
│   ├── memory/                 ← Persistent AI memory across sessions
│   └── rules/git.md            ← Branch, commit, and PR rules for agents
├── commitlint.config.js        ← Commitlint rules used by pr-validate.yml
├── package.json                ← Only dev dep: archiver (for build.js zip step)
└── .gitignore                  ← Ignores: dist/, *.zip, node_modules/, .DS_Store
```

---

## Key Architectural Decisions

### Web Speech API, not `chrome.tts`
`window.speechSynthesis` is used directly in `content.js` (content script). This gives access to 20–40+ system + Google voices. `chrome.tts` is only available in extension pages (background/popup), not content scripts, and would require routing all TTS through background.js.

**Known limitation:** `SpeechSynthesisUtterance.volume` is ignored by Chrome on macOS — system volume controls audio instead. Volume control was intentionally removed from the UI for this reason.

### Vanilla JS, no bundler
No React, no Webpack, no TypeScript. Edit files in `src/`, reload the extension in `chrome://extensions` — changes are live instantly. Only run `npm run build` for Chrome Web Store submission.

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

**Day-to-day (no build needed):**
1. Edit files in `src/`
2. Go to `chrome://extensions`
3. Click the refresh icon on the Sonorus card
4. Changes are live

**Store submission:**
```bash
npm install       # once — installs archiver
npm run build     # validates src/ → copies to dist/ → zips to sonorus-v1.0.0.zip
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
| Stamp version | Updates `manifest.json` + version badge in `settings/settings.html` |
| Build | `npm run build` → produces `sonorus-v{version}.zip` |
| Tag | Creates and pushes git tag `v{version}` — this becomes the source of truth for the next run |
| Release | Creates a GitHub Release with the zip attached and auto-generated notes |

**Bump rules:**

| Commit type | Bump |
|---|---|
| `type!:` or `BREAKING CHANGE` in body | major |
| `feat:` | minor |
| `fix:`, `chore:`, `refactor:`, `style:`, `docs:`, `test:` | patch |

### `pr-validate.yml` — triggered on every PR event

Two parallel jobs block a PR until both pass:

- **Validate PR title** — checks the PR title follows `<type>: <subject>` format (`amannn/action-semantic-pull-request`). The PR title is the squash-merge commit message, so this directly controls what lands in git history.
- **Validate commit messages** — runs commitlint on every individual commit in the PR branch (`wagoid/commitlint-action` + `commitlint.config.js`).

Rules enforced (mirrors `.agents/rules/git.md`):
- Type must be one of: `feat`, `fix`, `refactor`, `style`, `chore`, `docs`, `test`
- Subject must be lowercase, no trailing period, max 72 chars total

### Agent rules — what NOT to do

- **Never edit `manifest.json` version manually** — `release.yml` owns it; manual edits will cause version conflicts on the next release run
- **Never rename the zip output** — `sonorus-v{version}.zip` is derived from `manifest.json`; the release workflow expects this exact filename
- **Commit messages and PR titles must follow conventional commit format** — `pr-validate.yml` will block the PR otherwise
