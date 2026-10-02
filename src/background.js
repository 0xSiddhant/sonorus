const IDLE_STATE = {
  status: 'idle', // 'idle' | 'playing' | 'paused'
  text: '',
  speed: 1.0,
  voice: '',
  tabId: null,
  frameId: null,
  inBackground: false, // spoken here via chrome.tts (PDF viewer), not by a content script
  backgroundId: null,
}

// TTS state maintained across popup open/close. Mirrored to storage.session
// because the worker is killed when idle; Firefox < 115 lacks it and keeps
// the in-memory copy only.
let ttsState = { ...IDLE_STATE }
const stateLoaded = (
  chrome.storage.session
    ? chrome.storage.session.get({ ttsState: IDLE_STATE }).then((data) => {
        ttsState = data.ttsState
      })
    : Promise.resolve()
).then(clearFinishedBackgroundSpeech)

function setState(next) {
  ttsState = next
  chrome.storage.session?.set({ ttsState })
}

// Only the playing frame may change its state — idle tabs and frames also send TTS_STOPPED on pagehide.
const OWNER_ONLY = new Set(['TTS_PAUSED', 'TTS_RESUMED', 'TTS_STOPPED'])

// Popup commands relayed to the playing tab.
const COMMANDS = { PAUSE: 'CMD_PAUSE', RESUME: 'CMD_RESUME', STOP: 'CMD_STOP' }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  stateLoaded
    .then(() => handleMessage(message, sender))
    .then((response) => sendResponse(response ?? { ok: true }))
  return true
})

function sendToPlayingFrame(message) {
  chrome.tabs.sendMessage(ttsState.tabId, message, { frameId: ttsState.frameId ?? 0 }, () => void chrome.runtime.lastError)
}

function isPlayingFrame(sender) {
  return sender.tab?.id === ttsState.tabId && (sender.frameId ?? 0) === ttsState.frameId
}

function handleMessage(message, sender) {
  if (OWNER_ONLY.has(message.type) && !isPlayingFrame(sender)) return

  switch (message.type) {
    case 'TTS_STARTED':
      setState({
        ...IDLE_STATE,
        status: 'playing',
        text: message.text,
        speed: message.speed || 1.0,
        voice: message.voice || '',
        tabId: sender.tab?.id ?? null,
        frameId: sender.frameId ?? 0,
      })
      break

    case 'TTS_PAUSED':
      setState({ ...ttsState, status: 'paused' })
      break

    case 'TTS_RESUMED':
      setState({ ...ttsState, status: 'playing' })
      break

    case 'TTS_STOPPED':
      setState({ ...IDLE_STATE })
      break

    case 'GET_STATE':
      return ttsState

    case 'PAUSE':
    case 'RESUME':
    case 'STOP':
      if (ttsState.inBackground) controlBackgroundSpeech(message.type)
      else if (ttsState.tabId !== null) sendToPlayingFrame({ type: COMMANDS[message.type] })
      break

    // A page is about to speak. Its cancel() can't stop chrome.tts speech, and
    // its utterance would queue behind it — so stop ours first.
    case 'STOP_BACKGROUND_TTS':
      return stopBackgroundSpeech()

    // Subframes can't read the top-level URL cross-origin.
    case 'GET_TAB_HOSTNAME': {
      let hostname = ''
      try {
        hostname = new URL(sender.tab.url).hostname.replace(/^www\./, '')
      } catch (_) {}
      return { hostname }
    }

    // Text selected in a subframe plays in the top frame, which owns the pill.
    case 'SPEAK_IN_TOP_FRAME':
      return speakInTopFrame(sender.tab.id, message.text)
  }
}

function speakInTopFrame(tabId, text) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tabId, { type: 'CMD_SPEAK', text }, { frameId: 0 }, (res) => {
      resolve(chrome.runtime.lastError ? { ok: false, reason: 'no-receiver' } : res ?? { ok: false })
    })
  })
}

// ─── Context menu + background speech ───────────────────────────────────────
// Chrome's PDF viewer exposes the selection only to context menus, and has no
// content script to show the pill — so menu text plays in the page's pill when
// it can, else here via chrome.tts with the popup as controls. Firefox and
// Safari lack chrome.tts, so PDFs stay unsupported there.

const MENU_ID = 'sonorus-read-selection'
const SPEECH_SETTINGS = { enabled: true, blockedSites: [], selectedVoiceName: '', defaultSpeed: 1.0, pitch: 1.0 }
const SPEECH_DONE = ['end', 'interrupted', 'cancelled', 'error']
let resolveBackgroundStop = null

chrome.runtime.onInstalled.addListener(async () => {
  const { enabled } = await chrome.storage.sync.get({ enabled: true })
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: MENU_ID, title: 'Read aloud with Sonorus', contexts: ['selection'], visible: enabled })
  })
})

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.enabled) {
    chrome.contextMenus.update(MENU_ID, { visible: changes.enabled.newValue !== false }, () => void chrome.runtime.lastError)
  }
})

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const text = info.selectionText?.trim()
  if (info.menuItemId !== MENU_ID || !text || !tab?.id) return
  await stateLoaded
  const res = await speakInTopFrame(tab.id, text)
  if (res.reason === 'no-receiver') speakInBackground(text, tab)
})

async function speakInBackground(text, tab) {
  if (!chrome.tts) return
  const s = await chrome.storage.sync.get(SPEECH_SETTINGS)
  let hostname = ''
  try {
    hostname = new URL(tab.url).hostname.replace(/^www\./, '')
  } catch (_) {}
  if (!s.enabled || s.blockedSites.includes(hostname)) return

  const id = Date.now()
  setState({
    ...IDLE_STATE,
    status: 'playing',
    text: text.slice(0, 100),
    speed: s.defaultSpeed,
    voice: s.selectedVoiceName,
    tabId: tab.id,
    inBackground: true,
    backgroundId: id,
  })
  chrome.tts.speak(text, {
    voiceName: s.selectedVoiceName || undefined,
    rate: s.defaultSpeed,
    pitch: s.pitch,
    onEvent: (e) => {
      if (!SPEECH_DONE.includes(e.type)) return
      resolveBackgroundStop?.()
      // An older utterance's "interrupted" must not clear a newer one's state.
      if (ttsState.backgroundId === id) setState({ ...IDLE_STATE })
    },
  })
}

function controlBackgroundSpeech(command) {
  if (command === 'PAUSE') {
    chrome.tts.pause()
    setState({ ...ttsState, status: 'paused' })
  } else if (command === 'RESUME') {
    chrome.tts.resume()
    setState({ ...ttsState, status: 'playing' })
  } else {
    chrome.tts.stop()
    setState({ ...IDLE_STATE })
  }
}

// Resolves once chrome.tts reports the utterance ended, so the caller's speak()
// can't land in the queue before stop() clears it.
function stopBackgroundSpeech() {
  if (!ttsState.inBackground) return
  return new Promise((resolve) => {
    resolveBackgroundStop = resolve
    setTimeout(resolve, 300) // worker restarted and lost the onEvent callback
    chrome.tts.stop()
    setState({ ...IDLE_STATE })
  })
}

// The worker can be killed mid-utterance, losing its onEvent callback.
function clearFinishedBackgroundSpeech() {
  if (!ttsState.inBackground || !chrome.tts) return
  return new Promise((resolve) => {
    chrome.tts.isSpeaking((speaking) => {
      if (!speaking) setState({ ...IDLE_STATE })
      resolve()
    })
  })
}

// Stop TTS when the TTS tab navigates to a new URL (same-tab navigation).
// Tab switches are intentionally ignored so TTS keeps playing in background tabs.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  await stateLoaded
  if (changeInfo.status === 'loading' && tabId === ttsState.tabId && ttsState.status !== 'idle') {
    if (ttsState.inBackground) chrome.tts.stop()
    else sendToPlayingFrame({ type: 'CMD_STOP' })
    setState({ ...IDLE_STATE })
  }
})

chrome.tabs.onRemoved.addListener(async (tabId) => {
  await stateLoaded
  if (tabId !== ttsState.tabId) return
  if (ttsState.inBackground) chrome.tts.stop()
  setState({ ...IDLE_STATE })
})
