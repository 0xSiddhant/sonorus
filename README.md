# Sonorus 🪄

> Select. Listen. Float.

A browser extension that lets you select any text on any webpage and instantly listen to it via a floating pill player. Inspired by the Harry Potter spell _Sonorus_.

[![Release](https://img.shields.io/github/v/release/0xSiddhant/sonorus)](https://github.com/0xSiddhant/sonorus/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/0xSiddhant/sonorus/release.yml?label=CI)](https://github.com/0xSiddhant/sonorus/actions/workflows/release.yml)
[![JavaScript](https://img.shields.io/badge/JavaScript-ES2020-F7DF1E?logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![Manifest V3](https://img.shields.io/badge/Manifest-V3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/intro/)
[![Web Speech API](https://img.shields.io/badge/Web%20Speech%20API-offline-green.svg)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](https://github.com/0xSiddhant/sonorus/pulls)

## Browser Support

| Browser | Supported | Notes |
|---|---|---|
| Chrome | ✅ | Native MV3 |
| Firefox | ✅ | MV3 via event-page model |
| Edge | ✅ | Chromium-based, loads Chrome build |
| Opera | ✅ | Chromium-based, loads Chrome build |
| Brave | ✅ | Chromium-based, loads Chrome build |
| Safari | 🔜 Coming Soon | Requires Safari Web Extension rewrite |

## Features

- Floating 🔊 icon appears on text selection — no right-click needed
- Persistent draggable pill player with play/pause/stop
- Voice picker with live demo preview
- Speed control (0.5x – 2x)
- Per-site blocking
- No account · Fully offline · Free

## Install

**Chrome / Edge / Opera / Brave**
1. Clone this repo
2. Go to `chrome://extensions` → enable **Developer Mode**
3. Click **Load unpacked** → select the `src/` folder

**Firefox**
1. Clone this repo
2. Run `npm install && npm run dev:firefox` — stages `dev-firefox/` with the correct manifest
3. Go to `about:debugging` → **This Firefox** → **Load Temporary Add-on** → select the `dev-firefox/` folder

## Usage

1. Select any text on a webpage
2. Click the 🔊 icon that appears
3. Control playback with the floating pill player

## Build

```bash
npm install
npm run build
# → sonorus-chrome-v{version}.zip  (Chrome Web Store)
# → sonorus-firefox-v{version}.zip (addons.mozilla.org)
```

## License

MIT
