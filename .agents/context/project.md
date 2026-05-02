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
│   │   ├── content.js          ← Injected into every page: selection detection, TTS engine, pill UI
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
├── .agents/
│   ├── context/project.md      ← This file
│   ├── memory/                 ← Persistent AI memory across sessions
│   └── rules/git.md            ← Branch, commit, and PR rules for agents
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

`content.js` wraps all `sendMessage` calls in a `notifyBackground(msg)` helper that silences errors when the extension context is invalidated (e.g. after a reload).

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
