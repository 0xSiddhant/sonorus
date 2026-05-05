const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT = path.resolve(__dirname, '..')
const DIST = path.resolve(ROOT, 'dist')

console.log('Running build...\n')
execSync('node scripts/build.js', { cwd: ROOT, stdio: 'inherit' })

const chrome = JSON.parse(fs.readFileSync(path.join(DIST, 'chrome/manifest.json'), 'utf8'))
const firefox = JSON.parse(fs.readFileSync(path.join(DIST, 'firefox/manifest.json'), 'utf8'))
const version = chrome.version

const errors = []

// Chrome manifest checks
if (!chrome.background?.service_worker)
  errors.push('Chrome manifest: missing background.service_worker')
if (chrome.background?.scripts)
  errors.push('Chrome manifest: unexpected background.scripts')
if (chrome.browser_specific_settings)
  errors.push('Chrome manifest: unexpected browser_specific_settings (gecko block)')

// Firefox manifest checks
if (!firefox.background?.scripts)
  errors.push('Firefox manifest: missing background.scripts')
if (firefox.background?.service_worker)
  errors.push('Firefox manifest: unexpected background.service_worker')
if (!firefox.browser_specific_settings?.gecko?.id)
  errors.push('Firefox manifest: missing browser_specific_settings.gecko.id')
if (!firefox.options_ui)
  errors.push('Firefox manifest: missing options_ui')
if (firefox.options_page)
  errors.push('Firefox manifest: unexpected options_page (use options_ui)')

// Version sync
if (chrome.version !== firefox.version)
  errors.push(`Version mismatch: Chrome=${chrome.version}, Firefox=${firefox.version}`)

// No manifest.firefox.json leaked into either dist
if (fs.existsSync(path.join(DIST, 'chrome/manifest.firefox.json')))
  errors.push('Chrome dist: manifest.firefox.json leaked into output')
if (fs.existsSync(path.join(DIST, 'firefox/manifest.firefox.json')))
  errors.push('Firefox dist: manifest.firefox.json leaked into output')

// Zip files present with correct names
const chromeZip = path.join(ROOT, `sonorus-chrome-v${version}.zip`)
const firefoxZip = path.join(ROOT, `sonorus-firefox-v${version}.zip`)
if (!fs.existsSync(chromeZip))
  errors.push(`Chrome zip not found: sonorus-chrome-v${version}.zip`)
if (!fs.existsSync(firefoxZip))
  errors.push(`Firefox zip not found: sonorus-firefox-v${version}.zip`)

// Cleanup — always run regardless of pass/fail
fs.rmSync(DIST, { recursive: true })
if (fs.existsSync(chromeZip)) fs.unlinkSync(chromeZip)
if (fs.existsSync(firefoxZip)) fs.unlinkSync(firefoxZip)

// Report
console.log()
if (errors.length > 0) {
  console.error('Validation FAILED:')
  errors.forEach(e => console.error(`  ✗ ${e}`))
  process.exit(1)
}

console.log('All checks passed:')
console.log(`  ✓ Chrome manifest: service_worker present, no scripts, no gecko block`)
console.log(`  ✓ Firefox manifest: scripts present, no service_worker, gecko id, options_ui`)
console.log(`  ✓ Versions in sync: ${version}`)
console.log(`  ✓ No manifest.firefox.json in either dist`)
console.log(`  ✓ Both zips present and named correctly`)
