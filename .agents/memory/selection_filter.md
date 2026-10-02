---
name: Selection Filter for Popup Icon
description: Pre-validation gate that decides whether a text selection should trigger the Sonorus voice popup
type: feature
---

# Selection Filter

`onMouseUp` in `src/content/content-selection.js` no longer calls `showPopupIconIfNeeded()` directly. It first runs `isSelectionSpeakable(snap)` and only proceeds when that returns `true`. `snap` is the `{ text, anchorNode, range }` snapshot from `readSelection(path)`, which also reads selections inside open shadow roots.

## Filter rules (return `false` → popup is hidden)

| # | Rule | Detection |
|---|------|-----------|
| 1 | Pure URL / email / number | regex match against the full trimmed text (`urlRe`, `emailRe`, `numberRe`) |
| 2 | Emoji-only selection | `/^(\s|\p{Extended_Pictographic}|\p{Emoji_Component})+$/u` over the whole text |
| 3 | Code selection | `anchorEl.closest('code, pre, kbd, samp, tt, .hljs, .highlight, [class*="language-"], [class*="prism"]')` |
| 4 | Binary blob | hex run ≥32 chars OR base64 run ≥40 chars (mixed case + digits) with no whitespace |
| 5 | Input field selection | `anchorEl.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')` |

## Notes for future edits

- Anchor element is derived from `snap.anchorNode` (handles both element and text nodes). For a shadow-DOM selection it is a node inside the shadow tree, so `closest()` filters only see that tree.
- The Unicode property regex is wrapped in `try/catch` for engines that don't support `\p{...}` escapes.
- Number regex intentionally allows currency symbols, percent, parentheses and separators so prices, phone numbers and ratios are filtered out.
- `showPopupIconIfNeeded(snap)` takes the snapshot from `onMouseUp`; called with no args it reads the document selection via `readSelection()`.
