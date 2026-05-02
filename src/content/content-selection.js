/* content-selection.js — Text selection detection and popup icon trigger.
   Reads: pillEl, popupIconEl, settings. Calls: hidePopupIcon, showPopupIcon, startTTS. */

function onMouseUp(e) {
  if (pillEl?.contains(e.target) || popupIconEl?.contains(e.target)) return;
  // Small delay lets the browser finalise the selection range before we read it.
  setTimeout(() => showPopupIconIfNeeded(), 10);
}

function onDocMouseDown(e) {
  if (pillEl?.contains(e.target) || popupIconEl?.contains(e.target)) return;
  hidePopupIcon();
}

function showPopupIconIfNeeded() {
  const sel = window.getSelection();
  const text = sel?.toString().trim();
  if (!text || text.length < settings.minChars) {
    hidePopupIcon();
    return;
  }
  if (!settings.showPopupIcon) {
    startTTS(text);
    return;
  }
  showPopupIcon(sel, text);
}
