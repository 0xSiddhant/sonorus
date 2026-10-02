// TTS state maintained across popup open/close
let ttsState = {
  status: 'idle', // 'idle' | 'playing' | 'paused'
  text: '',
  speed: 1.0,
  voice: '',
  tabId: null,
}

// Lifecycle messages that only the tab currently owning playback may send.
// Any tab's content script fires TTS_STOPPED on pagehide, so without this an
// idle tab reloading would reset the state of a tab that is still speaking.
const OWNER_ONLY = new Set(['TTS_PAUSED', 'TTS_RESUMED', 'TTS_STOPPED'])

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (OWNER_ONLY.has(message.type) && sender.tab?.id !== ttsState.tabId) {
    sendResponse({ ok: true })
    return true
  }
  switch (message.type) {
    case 'TTS_STARTED':
      ttsState = {
        status: 'playing',
        text: message.text,
        speed: message.speed || 1.0,
        voice: message.voice || '',
        tabId: sender.tab?.id || null,
      }
      sendResponse({ ok: true })
      break

    case 'TTS_PAUSED':
      ttsState.status = 'paused'
      sendResponse({ ok: true })
      break

    case 'TTS_RESUMED':
      ttsState.status = 'playing'
      sendResponse({ ok: true })
      break

    case 'TTS_STOPPED':
      ttsState = { status: 'idle', text: '', speed: 1.0, voice: '', tabId: null }
      sendResponse({ ok: true })
      break

    case 'GET_STATE':
      sendResponse(ttsState)
      break

    case 'PAUSE':
      if (ttsState.tabId !== null) {
        chrome.tabs.sendMessage(ttsState.tabId, { type: 'CMD_PAUSE' })
      }
      sendResponse({ ok: true })
      break

    case 'STOP':
      if (ttsState.tabId !== null) {
        chrome.tabs.sendMessage(ttsState.tabId, { type: 'CMD_STOP' })
      }
      sendResponse({ ok: true })
      break
  }
  return true
})

// Stop TTS when the TTS tab navigates to a new URL (same-tab navigation).
// Tab switches are intentionally ignored so TTS keeps playing in background tabs.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading' && tabId === ttsState.tabId && ttsState.status !== 'idle') {
    ttsState = { status: 'idle', text: '', speed: 1.0, voice: '', tabId: null }
    chrome.tabs.sendMessage(tabId, { type: 'CMD_STOP' }, () => void chrome.runtime.lastError)
  }
})
