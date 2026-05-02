/* Sonorus — settings.js */

const DEFAULTS = {
  enabled: true,
  showPopupIcon: true,
  minChars: 20,
  blockedSites: [],
  selectedVoiceName: '',
  pitch: 1.0,
  defaultSpeed: 1.0,
  defaultVolume: 1.0,
  speedStep: 0.25,
  pillPosition: 'bottom-center',
  pillTheme: 'auto',
}

let voices = []
let blockedSites = []

// ─── Voice loading ─────────────────────────────────────────────────────────

function loadVoices(selectedName) {
  voices = speechSynthesis.getVoices()
  const sel = document.getElementById('s-voice')
  if (!voices.length) return

  const grouped = {}
  voices.forEach(v => {
    const lang = v.lang.split('-')[0]
    if (!grouped[lang]) grouped[lang] = []
    grouped[lang].push(v)
  })

  const priorityLangs = ['en', 'hi']
  const allLangs = [
    ...priorityLangs.filter(l => grouped[l]),
    ...Object.keys(grouped).filter(l => !priorityLangs.includes(l)).sort(),
  ]

  let html = '<option value="">Default voice</option>'
  allLangs.forEach(lang => {
    let label = lang
    try { label = new Intl.DisplayNames(['en'], { type: 'language' }).of(lang) || lang } catch (_) {}
    html += `<optgroup label="${label}">`
    grouped[lang].forEach(v => {
      const sel2 = v.name === selectedName ? ' selected' : ''
      html += `<option value="${v.name}"${sel2}>${v.name} (${v.lang})</option>`
    })
    html += '</optgroup>'
  })
  sel.innerHTML = html
}

// ─── Blocked sites ─────────────────────────────────────────────────────────

function renderBlockedList() {
  const list = document.getElementById('s-blocked-list')
  const empty = document.getElementById('s-blocked-empty')

  // Remove existing chips
  list.querySelectorAll('.site-chip').forEach(el => el.remove())

  if (blockedSites.length === 0) {
    empty.style.display = 'block'
    return
  }
  empty.style.display = 'none'

  blockedSites.forEach(site => {
    const chip = document.createElement('div')
    chip.className = 'site-chip'
    chip.innerHTML = `<span>${site}</span><button class="chip-remove" data-site="${site}">✕</button>`
    list.appendChild(chip)
  })
}

function addSite(raw) {
  let hostname = raw.trim()
  try {
    const url = new URL(hostname.startsWith('http') ? hostname : 'https://' + hostname)
    hostname = url.hostname.replace(/^www\./, '')
  } catch (_) {
    hostname = hostname.replace(/^www\./, '')
  }
  if (!hostname || blockedSites.includes(hostname)) return
  blockedSites = [...blockedSites, hostname]
  save()
  renderBlockedList()
}

function removeSite(site) {
  blockedSites = blockedSites.filter(s => s !== site)
  save()
  renderBlockedList()
}

// ─── Save / Load ───────────────────────────────────────────────────────────

function getFormValues() {
  return {
    enabled: document.getElementById('s-enabled').checked,
    showPopupIcon: document.getElementById('s-showPopupIcon').checked,
    minChars: parseInt(document.getElementById('s-minChars').value, 10) || 20,
    blockedSites,
    selectedVoiceName: document.getElementById('s-voice').value,
    pitch: parseFloat(document.getElementById('s-pitch').value),
    defaultSpeed: parseFloat(document.getElementById('s-defaultSpeed').value),
    defaultVolume: parseFloat(document.getElementById('s-defaultVolume').value),
    speedStep: parseFloat(document.getElementById('s-speedStep').value),
    pillPosition: document.getElementById('s-pillPosition').value,
    pillTheme: document.getElementById('s-pillTheme').value,
  }
}

function save() {
  const vals = getFormValues()
  chrome.storage.sync.set(vals)
  showToast()
}

function showToast() {
  const toast = document.getElementById('save-toast')
  toast.classList.add('visible')
  clearTimeout(toast._t)
  toast._t = setTimeout(() => toast.classList.remove('visible'), 2000)
}

function applyToForm(data) {
  document.getElementById('s-enabled').checked = data.enabled
  document.getElementById('s-showPopupIcon').checked = data.showPopupIcon
  document.getElementById('s-minChars').value = data.minChars

  document.getElementById('s-pitch').value = data.pitch
  document.getElementById('s-pitch-val').textContent = parseFloat(data.pitch).toFixed(1)

  document.getElementById('s-defaultSpeed').value = data.defaultSpeed
  document.getElementById('s-speed-val').textContent = `${parseFloat(data.defaultSpeed).toFixed(2).replace(/\.?0+$/, '')}x`

  document.getElementById('s-defaultVolume').value = data.defaultVolume
  document.getElementById('s-volume-val').textContent = `${Math.round(data.defaultVolume * 100)}%`

  document.getElementById('s-speedStep').value = String(data.speedStep)
  document.getElementById('s-pillPosition').value = data.pillPosition
  document.getElementById('s-pillTheme').value = data.pillTheme

  blockedSites = data.blockedSites || []
  renderBlockedList()

  loadVoices(data.selectedVoiceName)
}

// ─── Event wiring ──────────────────────────────────────────────────────────

function wire() {
  // Auto-save all changes
  const autoSaveIds = ['s-enabled', 's-showPopupIcon', 's-minChars', 's-voice',
    's-speedStep', 's-pillPosition', 's-pillTheme']
  autoSaveIds.forEach(id => {
    const el = document.getElementById(id)
    el.addEventListener('change', save)
  })

  // Sliders with live label update
  document.getElementById('s-pitch').addEventListener('input', (e) => {
    document.getElementById('s-pitch-val').textContent = parseFloat(e.target.value).toFixed(1)
    save()
  })

  document.getElementById('s-defaultSpeed').addEventListener('input', (e) => {
    const v = parseFloat(e.target.value)
    document.getElementById('s-speed-val').textContent = `${v}x`
    save()
  })

  document.getElementById('s-defaultVolume').addEventListener('input', (e) => {
    document.getElementById('s-volume-val').textContent = `${Math.round(parseFloat(e.target.value) * 100)}%`
    save()
  })

  // Speed presets
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const speed = parseFloat(btn.dataset.speed)
      document.getElementById('s-defaultSpeed').value = speed
      document.getElementById('s-speed-val').textContent = `${speed}x`
      save()
    })
  })

  // Add blocked site
  document.getElementById('s-site-add').addEventListener('click', () => {
    const input = document.getElementById('s-site-input')
    addSite(input.value)
    input.value = ''
  })
  document.getElementById('s-site-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      addSite(e.target.value)
      e.target.value = ''
    }
  })

  // Remove blocked site (delegated)
  document.getElementById('s-blocked-list').addEventListener('click', (e) => {
    if (e.target.classList.contains('chip-remove')) {
      removeSite(e.target.dataset.site)
    }
  })

  // Voice demo
  document.getElementById('s-voice-demo').addEventListener('click', () => {
    speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance('Sonorus! Your text is ready to be heard.')
    const voiceName = document.getElementById('s-voice').value
    const voice = voices.find(v => v.name === voiceName)
    if (voice) { utt.voice = voice; utt.lang = voice.lang }
    utt.rate = parseFloat(document.getElementById('s-defaultSpeed').value)
    utt.pitch = parseFloat(document.getElementById('s-pitch').value)
    utt.volume = parseFloat(document.getElementById('s-defaultVolume').value)
    speechSynthesis.speak(utt)
  })
}

// ─── Init ──────────────────────────────────────────────────────────────────

async function init() {
  const data = await chrome.storage.sync.get(DEFAULTS)
  applyToForm(data)
  wire()

  speechSynthesis.onvoiceschanged = () => {
    const currentVoice = document.getElementById('s-voice').value
    loadVoices(currentVoice || data.selectedVoiceName)
  }
  loadVoices(data.selectedVoiceName)
}

init()
