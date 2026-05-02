/* Sonorus — popup.js */

const statusDot = document.getElementById('status-dot')
const statusLabel = document.getElementById('status-label')
const statusText = document.getElementById('status-text')
const popupControls = document.getElementById('popup-controls')
const popupIdle = document.getElementById('popup-idle')
const btnPause = document.getElementById('btn-pause')
const btnStop = document.getElementById('btn-stop')
const btnSettings = document.getElementById('btn-settings')
const siteToggle = document.getElementById('site-toggle')
const siteHostname = document.getElementById('site-hostname')

let currentTabHostname = ''

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  try {
    const url = new URL(tab.url)
    currentTabHostname = url.hostname.replace(/^www\./, '')
  } catch (_) {
    currentTabHostname = ''
  }
  siteHostname.textContent = currentTabHostname || '—'

  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] })
  siteToggle.checked = !blockedSites.includes(currentTabHostname)

  chrome.runtime.sendMessage({ type: 'GET_STATE' }, (state) => {
    if (chrome.runtime.lastError) {
      renderIdle()
      return
    }
    renderState(state)
  })
}

function renderState(state) {
  if (!state || state.status === 'idle') {
    renderIdle()
    return
  }
  if (state.status === 'playing') {
    statusDot.className = 'status-dot playing'
    statusLabel.textContent = 'Playing'
    btnPause.textContent = '❚❚ Pause'
    btnPause.dataset.action = 'pause'
  } else if (state.status === 'paused') {
    statusDot.className = 'status-dot paused'
    statusLabel.textContent = 'Paused'
    btnPause.textContent = '▶ Resume'
    btnPause.dataset.action = 'resume'
  }
  statusText.textContent = state.text ? `"${state.text.slice(0, 60)}${state.text.length > 60 ? '…' : ''}"` : ''
  popupControls.style.display = 'flex'
  popupIdle.style.display = 'none'
}

function renderIdle() {
  statusDot.className = 'status-dot idle'
  statusLabel.textContent = 'Idle'
  statusText.textContent = ''
  popupControls.style.display = 'none'
  popupIdle.style.display = 'block'
}

btnPause.addEventListener('click', async () => {
  const action = btnPause.dataset.action || 'pause'
  if (action === 'resume') {
    chrome.runtime.sendMessage({ type: 'RESUME' })
    btnPause.textContent = '❚❚ Pause'
    btnPause.dataset.action = 'pause'
  } else {
    chrome.runtime.sendMessage({ type: 'PAUSE' })
    btnPause.textContent = '▶ Resume'
    btnPause.dataset.action = 'resume'
  }
})

btnStop.addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'STOP' })
  renderIdle()
})

btnSettings.addEventListener('click', () => {
  chrome.runtime.openOptionsPage()
  window.close()
})

siteToggle.addEventListener('change', async () => {
  const { blockedSites = [] } = await chrome.storage.sync.get({ blockedSites: [] })
  let updated
  if (siteToggle.checked) {
    updated = blockedSites.filter(s => s !== currentTabHostname)
  } else {
    if (!blockedSites.includes(currentTabHostname)) {
      updated = [...blockedSites, currentTabHostname]
    } else {
      updated = blockedSites
    }
  }
  await chrome.storage.sync.set({ blockedSites: updated })
})

init()
