// TTS state maintained across popup open/close
let ttsState = {
  status: 'idle', // 'idle' | 'playing' | 'paused'
  text: '',
  speed: 1.0,
  voice: '',
  tabId: null,
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
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

// Cancel TTS when the active tab changes
chrome.tabs.onActivated.addListener(({ tabId }) => {
  if (ttsState.tabId !== null && ttsState.tabId !== tabId && ttsState.status !== 'idle') {
    chrome.tabs.sendMessage(ttsState.tabId, { type: 'CMD_STOP' })
    ttsState = { status: 'idle', text: '', speed: 1.0, voice: '', tabId: null }
  }
})
