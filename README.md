# Sonorus 🪄
> Select. Listen. Float.

A Chrome extension that lets you select any text on any webpage and instantly listen to it via a floating pill player. Inspired by the Harry Potter spell *Sonorus*.

## Features
- Floating 🔊 icon appears on text selection — no right-click needed
- Persistent draggable pill player with play/pause/stop
- Voice picker with live demo preview
- Speed control (0.5x – 2x)
- Per-site blocking
- No account · Fully offline · Free

## Install (Developer Mode)
1. Clone this repo
2. Go to `chrome://extensions` → enable **Developer Mode**
3. Click **Load unpacked** → select the `src/` folder

## Usage
1. Select any text on a webpage
2. Click the 🔊 icon that appears
3. Control playback with the floating pill player

## Build for Store
```bash
npm install
npm run build
# → sonorus-v1.0.0.zip
```

## Stack
Web Speech API · Chrome Manifest V3 · Vanilla JS · No build step for dev

## License
MIT
