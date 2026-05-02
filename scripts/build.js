const fs = require('fs')
const path = require('path')
const archiver = require('archiver')

const SRC = path.resolve(__dirname, '../src')
const DIST = path.resolve(__dirname, '../dist')
const ROOT = path.resolve(__dirname, '..')

const REQUIRED_FILES = [
  'manifest.json',
  'background.js',
  'content/content.js',
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

console.log('Validating required files...')
const missing = REQUIRED_FILES.filter(f => !fs.existsSync(path.join(SRC, f)))
if (missing.length > 0) {
  console.error('Missing files:')
  missing.forEach(f => console.error(`   - src/${f}`))
  process.exit(1)
}
console.log('All required files present\n')

const manifest = JSON.parse(fs.readFileSync(path.join(SRC, 'manifest.json'), 'utf8'))
const version = manifest.version
console.log(`Building Sonorus v${version}...\n`)

if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true })
fs.mkdirSync(DIST)
fs.mkdirSync(path.join(DIST, 'icons'))
fs.mkdirSync(path.join(DIST, 'popup'))
fs.mkdirSync(path.join(DIST, 'settings'))
fs.mkdirSync(path.join(DIST, 'content'))

const copyFile = (rel) => {
  fs.copyFileSync(path.join(SRC, rel), path.join(DIST, rel))
  console.log(`  copied -> dist/${rel}`)
}

REQUIRED_FILES.forEach(copyFile)
console.log()

const zipName = `sonorus-v${version}.zip`
const zipPath = path.join(ROOT, zipName)
const output = fs.createWriteStream(zipPath)
const archive = archiver('zip', { zlib: { level: 9 } })

output.on('close', () => {
  const kb = (archive.pointer() / 1024).toFixed(1)
  console.log(`Build complete!`)
  console.log(`   Output: ${zipName} (${kb} KB)`)
  console.log(`\nReady to upload to Chrome Web Store`)
})

archive.on('error', err => { throw err })
archive.pipe(output)
archive.directory(DIST, false)
archive.finalize()
