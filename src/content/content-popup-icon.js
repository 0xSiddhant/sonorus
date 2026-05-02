/* content-popup-icon.js — Floating 🔊 icon shown near a text selection.
   Reads: (none). Writes: popupIconEl. Calls: startTTS. */

function showPopupIcon(sel, text) {
  hidePopupIcon();

  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();

  popupIconEl = document.createElement("div");
  popupIconEl.id = "sonorus-popup-icon";
  popupIconEl.innerHTML = "🔊";
  popupIconEl.setAttribute("aria-label", "Listen with Sonorus");
  popupIconEl.setAttribute("role", "button");
  popupIconEl.title = "Listen with Sonorus";

  const x = rect.right + window.scrollX - 18;
  const y = rect.top + window.scrollY - 48;

  popupIconEl.style.left = `${Math.max(8, x)}px`;
  popupIconEl.style.top = `${Math.max(8, y)}px`;

  popupIconEl.addEventListener("click", (e) => {
    e.stopPropagation();
    hidePopupIcon();
    startTTS(text);
  });

  document.body.appendChild(popupIconEl);
  requestAnimationFrame(() => popupIconEl?.classList.add("sonorus-visible"));
}

function hidePopupIcon() {
  if (popupIconEl) {
    popupIconEl.remove();
    popupIconEl = null;
  }
}
