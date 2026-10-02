/* content-selection.js — Text selection detection and popup icon trigger.
   Reads: pillEl, popupIconEl, settings, ownHostname. Writes: tabHostname.
   Calls: hidePopupIcon, showPopupIcon, playText. */

function isEnabledHere() {
  const blocked = settings.blockedSites;
  return settings.enabled && !blocked.includes(ownHostname) && !blocked.includes(tabHostname);
}

async function loadTabHostname() {
  if (tabHostname !== null) return;
  tabHostname = await new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage({ type: "GET_TAB_HOSTNAME" }, (res) =>
        resolve(chrome.runtime.lastError ? "" : res?.hostname || ""),
      );
    } catch (_) {
      resolve("");
    }
  });
}

// Snapshot of the current selection as { text, anchorNode, range }, or null.
// `path` is the mouseup's composedPath(): in Chrome, document.getSelection()
// can't see into shadow trees (it reports the host and empty text), so a
// selection made inside an open shadow root is read from that root instead.
function readSelection(path = []) {
  const docSel = window.getSelection();
  const shadowRoots = path.filter((n) => n.nodeType === Node.DOCUMENT_FRAGMENT_NODE && n.host);
  const shadow = shadowRoots.length && readShadowSelection(shadowRoots, docSel);
  if (shadow) return shadow;
  if (!docSel?.rangeCount) return null;
  return {
    text: docSel.toString().trim(),
    anchorNode: docSel.anchorNode,
    range: docSel.getRangeAt(0),
  };
}

function readShadowSelection(shadowRoots, docSel) {
  // Chrome: non-standard per-root selection.
  const rootSel = shadowRoots[0].getSelection?.();
  if (rootSel?.rangeCount && !rootSel.isCollapsed) {
    return {
      text: rootSel.toString().trim(),
      anchorNode: rootSel.anchorNode,
      range: rootSel.getRangeAt(0),
    };
  }
  // Standard API (Safari, Firefox 142+).
  if (!docSel?.getComposedRanges) return null;
  let composed;
  try {
    [composed] = docSel.getComposedRanges({ shadowRoots });
  } catch (_) {
    [composed] = docSel.getComposedRanges(...shadowRoots); // pre-2024 signature
  }
  if (!composed || composed.collapsed) return null;
  const range = document.createRange();
  range.setStart(composed.startContainer, composed.startOffset);
  range.setEnd(composed.endContainer, composed.endOffset);
  if (range.collapsed) return null; // ends in different trees
  return {
    // Range.toString() drops block line breaks; prefer the selection's text when it has one.
    text: docSel.toString().trim() || range.toString().trim(),
    anchorNode: range.startContainer,
    range,
  };
}

function onMouseUp(e) {
  if (pillEl?.contains(e.target) || popupIconEl?.contains(e.target)) return;
  const path = e.composedPath(); // only available during dispatch
  // Small delay lets the browser finalise the selection range before we read it.
  setTimeout(async () => {
    await loadTabHostname();
    if (!isEnabledHere()) {
      hidePopupIcon();
      return;
    }
    const snap = readSelection(path);
    if (!isSelectionSpeakable(snap)) {
      hidePopupIcon();
      return;
    }
    showPopupIconIfNeeded(snap);
  }, 10);
}

function onDocMouseDown(e) {
  if (pillEl?.contains(e.target) || popupIconEl?.contains(e.target)) return;
  hidePopupIcon();
}

// Returns false when the selection should NOT trigger the popup icon.
// Filters out: input-field selections, code blocks, binary blobs,
// pure URL/email/number text, and emoji-only text.
function isSelectionSpeakable(snap) {
  if (!snap?.text) return false;
  const { text, anchorNode } = snap;

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

function showPopupIconIfNeeded(snap = readSelection()) {
  if (!snap?.text || snap.text.length < settings.minChars) {
    hidePopupIcon();
    return;
  }
  if (!settings.showPopupIcon) {
    playText(snap.text);
    return;
  }
  showPopupIcon(snap);
}
