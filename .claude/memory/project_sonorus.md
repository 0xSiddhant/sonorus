---
name: Sonorus Extension Implementation
description: Chrome TTS extension — all 5 phases done, key decisions and store-prep details
type: project
---
All 5 phases implemented on 2026-05-02. Load unpacked from `src/` in Chrome developer mode.

**Key technical decision:** Uses `window.speechSynthesis` (Web Speech API) instead of `chrome.tts` permission — gives better voice variety and works directly in content scripts.

**Storage:** `chrome.storage.sync` — syncs across devices. Keys: `enabled`, `showPopupIcon`, `minChars`, `blockedSites[]`, `selectedVoiceName`, `pitch`, `defaultSpeed`, `speedStep`, `pillPosition`, `pillTheme`.

**Store submission — what's still manual:**
- Icons are placeholder purple-circle PNGs — replace with proper designs (deep purple `#1A0A2E` bg, lavender speaker `#C4B5FD`, gold wand `#FCD34D`)
- Need 3–5 screenshots at 1280×800px in `assets/`
- Need promotional tile 440×280px in `assets/`
- $5 one-time Chrome Web Store developer registration fee
- No privacy policy needed — extension collects zero user data

**Store listing short description (132 chars):**
"Select any text, hear it instantly. Floating pill player with voice picker, speed control & per-site settings."

**Build for store:** `npm install && npm run build` → generates `sonorus-v1.0.0.zip`

**Voice demo sentence:** "Sonorus! Your text is ready to be heard."
