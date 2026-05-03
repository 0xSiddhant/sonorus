/* content-selection.js — Text selection detection and popup icon trigger.
   Reads: pillEl, popupIconEl, settings. Calls: hidePopupIcon, showPopupIcon, startTTS. */

function onMouseUp(e) {
  if (pillEl?.contains(e.target) || popupIconEl?.contains(e.target)) return;
  // Small delay lets the browser finalise the selection range before we read it.
  setTimeout(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() || "";
    if (!isSelectionSpeakable(sel, text)) {
      hidePopupIcon();
      return;
    }
    showPopupIconIfNeeded(sel, text);
  }, 10);
}

function onDocMouseDown(e) {
  if (pillEl?.contains(e.target) || popupIconEl?.contains(e.target)) return;
  hidePopupIcon();
}

// Returns false when the selection should NOT trigger the popup icon.
// Filters out: input-field selections, code blocks, binary blobs,
// pure URL/email/number text, and emoji-only text.
function isSelectionSpeakable(sel, text) {
  if (!sel || !text) return false;

  const anchorNode = sel.anchorNode;
  const anchorEl = anchorNode?.nodeType === 1 ? anchorNode : anchorNode?.parentElement;

  if (anchorEl) {
    // 5. Selection inside an input / textarea / contenteditable field
    if (anchorEl.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')) {
      return false;
    }
    // 3. Selection inside a code block
    if (anchorEl.closest('code, pre, kbd, samp, tt, .hljs, .highlight, [class*="language-"], [class*="prism"]')) {
      return false;
    }
  }

  // 1. Pure URL, email, or number (with common numeric punctuation/units)
  const urlRe = /^(https?:\/\/|ftp:\/\/|www\.)\S+$/i;
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const numberRe = /^[+\-]?[\d\s.,/()%$€£¥]+$/;
  if (urlRe.test(text) || emailRe.test(text) || numberRe.test(text)) return false;

  // 2. Only emoji / pictographs (and whitespace)
  try {
    if (/^(\s|\p{Extended_Pictographic}|\p{Emoji_Component})+$/u.test(text)) return false;
  } catch (_) { /* older engines without Unicode property escapes */ }

  // 4. Binary-ish data: long hex or base64 blobs with no whitespace
  const noSpace = text.replace(/\s+/g, "");
  if (noSpace.length >= 32 && /^[0-9a-f]+$/i.test(noSpace) && /[a-f]/i.test(noSpace)) return false;
  if (noSpace.length >= 40 && /^[A-Za-z0-9+/=]+$/.test(noSpace) && !/\s/.test(text)
      && /[A-Z]/.test(noSpace) && /[a-z]/.test(noSpace) && /\d/.test(noSpace)) return false;

  return true;
}

function showPopupIconIfNeeded(sel, text) {
  if (!sel || !text) {
    sel = window.getSelection();
    text = sel?.toString().trim() || "";
  }
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
