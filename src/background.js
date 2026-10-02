const IDLE_STATE = {
  status: 'idle', // 'idle' | 'playing' | 'paused'
  text: '',
  speed: 1.0,
  voice: '',
  tabId: null,
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

// Only the playing tab may change its state — idle tabs also send TTS_STOPPED on pagehide.
const OWNER_ONLY = new Set(['TTS_PAUSED', 'TTS_RESUMED', 'TTS_STOPPED'])

// Popup commands relayed to the playing tab.
const COMMANDS = { PAUSE: 'CMD_PAUSE', RESUME: 'CMD_RESUME', STOP: 'CMD_STOP' }

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  stateLoaded.then(() => {
    handleMessage(message, sender)
    sendResponse(message.type === 'GET_STATE' ? ttsState : { ok: true })
  })
  return true
})

function handleMessage(message, sender) {
  if (OWNER_ONLY.has(message.type) && sender.tab?.id !== ttsState.tabId) return

  switch (message.type) {
    case 'TTS_STARTED':
      setState({
        status: 'playing',
        text: message.text,
        speed: message.speed || 1.0,
        voice: message.voice || '',
        tabId: sender.tab?.id ?? null,
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

    case 'PAUSE':
    case 'RESUME':
    case 'STOP':
      if (ttsState.tabId !== null) {
        chrome.tabs.sendMessage(ttsState.tabId, { type: COMMANDS[message.type] }, () => void chrome.runtime.lastError)
      }
      break
  }
}

// Stop TTS when the TTS tab navigates to a new URL (same-tab navigation).
// Tab switches are intentionally ignored so TTS keeps playing in background tabs.
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo) => {
  await stateLoaded
  if (changeInfo.status === 'loading' && tabId === ttsState.tabId && ttsState.status !== 'idle') {
    setState({ ...IDLE_STATE })
    chrome.tabs.sendMessage(tabId, { type: 'CMD_STOP' }, () => void chrome.runtime.lastError)
  }
})
