/* content-drag.js — Drag-to-reposition logic for the pill player.
   Reads: pillEl. Writes: isDragging, dragOffsetX, dragOffsetY. */

function onDragStart(e) {
  e.preventDefault();
  isDragging = true;
  const rect = pillEl.getBoundingClientRect();
  dragOffsetX = e.clientX - rect.left;
  dragOffsetY = e.clientY - rect.top;
  pillEl.style.transform = "none";
  pillEl.style.bottom = "auto";
  pillEl.style.right = "auto";
  document.addEventListener("mousemove", onDragMove);
  document.addEventListener("mouseup", onDragEnd);
}

function onDragMove(e) {
  if (!isDragging || !pillEl) return;
  const rect = pillEl.getBoundingClientRect();
  let left = e.clientX - dragOffsetX;
  let top = e.clientY - dragOffsetY;
  left = Math.max(0, Math.min(left, window.innerWidth - rect.width));
  top = Math.max(0, Math.min(top, window.innerHeight - rect.height));
  pillEl.style.left = `${left}px`;
  pillEl.style.top = `${top}px`;
}

function onDragEnd() {
  isDragging = false;
  document.removeEventListener("mousemove", onDragMove);
  document.removeEventListener("mouseup", onDragEnd);
  if (pillEl) {
    const rect = pillEl.getBoundingClientRect();
    sessionStorage.setItem(
      "sonorus-pill-pos",
      JSON.stringify({ left: rect.left, top: rect.top }),
    );
  }
}
