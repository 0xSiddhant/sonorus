// Stages src/ into dev-firefox/ with manifest.firefox.json as manifest.json,
// so Firefox's "Load Temporary Add-on" can accept the whole folder.
const fs = require('fs')
const path = require('path')

const SRC = path.resolve(__dirname, '../src')
const OUT = path.resolve(__dirname, '../dev-firefox')

if (fs.existsSync(OUT)) fs.rmSync(OUT, { recursive: true })
;['', 'icons', 'popup', 'settings', 'content'].forEach(d =>
  fs.mkdirSync(path.join(OUT, d), { recursive: true })
)

const files = [
  'background.js',
  'content/content-state.js',
  'content/content-tts.js',
  'content/content-popup-icon.js',
  'content/content-pill.js',
  'content/content-drag.js',
  'content/content-selection.js',
  'content/content-main.js',
  'content/content.css',
  'popup/popup.html',
  'popup/popup.js',
  'popup/popup.css',
  'settings/settings.html',
  'settings/settings.js',
  'settings/settings.css',
  'icons/icon16.png',
  'icons/icon48.png',
  'icons/icon128.png',
]

files.forEach(f => fs.copyFileSync(path.join(SRC, f), path.join(OUT, f)))
fs.copyFileSync(path.join(SRC, 'manifest.firefox.json'), path.join(OUT, 'manifest.json'))

console.log('Firefox dev folder ready: dev-firefox/')
console.log('  → about:debugging → This Firefox → Load Temporary Add-on → select dev-firefox/')
