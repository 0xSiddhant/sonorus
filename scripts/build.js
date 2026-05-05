const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

const SRC = path.resolve(__dirname, '../src')
const DIST = path.resolve(__dirname, '../dist')
const ROOT = path.resolve(__dirname, '..')

const SOURCE_FILES = [
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

const TARGETS = [
  { name: 'chrome',  manifestSrc: 'manifest.json' },
  { name: 'firefox', manifestSrc: 'manifest.firefox.json' },
]

// Validate all shared source files exist
console.log('Validating source files...')
const missing = SOURCE_FILES.filter(f => !fs.existsSync(path.join(SRC, f)))
if (missing.length > 0) {
  console.error('Missing files:')
  missing.forEach(f => console.error(`   - src/${f}`))
  process.exit(1)
}
console.log('All source files present\n')

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'))
const version = manifest.version
console.log(`Building Sonorus v${version}...\n`)

if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true })

function buildTarget(target) {
  const distDir = path.join(DIST, target.name)
  fs.mkdirSync(distDir, { recursive: true })
  ;['icons', 'popup', 'settings', 'content'].forEach(d =>
    fs.mkdirSync(path.join(distDir, d))
  )

  SOURCE_FILES.forEach(rel => {
    fs.copyFileSync(path.join(SRC, rel), path.join(distDir, rel))
    console.log(`  [${target.name}] copied -> ${rel}`)
  })

  // Copy the browser-specific manifest as manifest.json
  fs.copyFileSync(path.join(SRC, target.manifestSrc), path.join(distDir, 'manifest.json'))
  console.log(`  [${target.name}] copied -> manifest.json (from ${target.manifestSrc})\n`)

  const zipName = `sonorus-${target.name}-v${version}.zip`
  const zipPath = path.join(ROOT, zipName)
  const output = fs.createWriteStream(zipPath)
  const archive = archiver('zip', { zlib: { level: 9 } })

  output.on('close', () => {
    const kb = (archive.pointer() / 1024).toFixed(1)
    console.log(`[${target.name}] Build complete: ${zipName} (${kb} KB)`)
  })

  archive.on('error', err => { throw err })
  archive.pipe(output)
  archive.directory(distDir, false)
  archive.finalize()
}

TARGETS.forEach(buildTarget)
