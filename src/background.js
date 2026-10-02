const IDLE_STATE = {
  status: 'idle', // 'idle' | 'playing' | 'paused'
  text: '',
  speed: 1.0,
  voice: '',
  tabId: null,
  frameId: null,
}

// TTS state maintained across popup open/close. Mirrored to storage.session
// because the worker is killed when idle; Firefox < 115 lacks it and keeps
// the in-memory copy only.
let ttsState = { ...IDLE_STATE }
const stateLoaded = chrome.storage.session
  ? chrome.storage.session.get({ ttsState: IDLE_STATE }).then((data) => {
      ttsState = data.ttsState
    })
  : Promise.resolve()

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
      if (ttsState.tabId !== null) sendToPlayingFrame({ type: COMMANDS[message.type] })
      break

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
      return new Promise((resolve) => {
        chrome.tabs.sendMessage(sender.tab.id, { type: 'CMD_SPEAK', text: message.text }, { frameId: 0 }, (res) => {
          resolve({ ok: !chrome.runtime.lastError && !!res?.ok })
        })
      })
  }
}

// Stop TTS when the TTS tab navigates to a new URL (same-tab navigation).
// Tab switches are intentionally ignored so TTS keeps playing in background tabs.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  await stateLoaded
  if (changeInfo.status === 'loading' && tabId === ttsState.tabId && ttsState.status !== 'idle') {
    sendToPlayingFrame({ type: 'CMD_STOP' })
    setState({ ...IDLE_STATE })
  }
})
