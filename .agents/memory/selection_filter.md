---
name: Selection Filter for Popup Icon
description: Pre-validation gate that decides whether a text selection should trigger the Sonorus voice popup
type: feature
---

# Selection Filter

`onMouseUp` in `src/content/content-selection.js` no longer calls `showPopupIconIfNeeded()` directly. It first runs `isSelectionSpeakable(sel, text)` and only proceeds when that returns `true`.

## Filter rules (return `false` → popup is hidden)

| # | Rule | Detection |
|---|------|-----------|
| 1 | Pure URL / email / number | regex match against the full trimmed text (`urlRe`, `emailRe`, `numberRe`) |
| 2 | Emoji-only selection | `/^(\s|\p{Extended_Pictographic}|\p{Emoji_Component})+$/u` over the whole text |
| 3 | Code selection | `anchorEl.closest('code, pre, kbd, samp, tt, .hljs, .highlight, [class*="language-"], [class*="prism"]')` |
| 4 | Binary blob | hex run ≥32 chars OR base64 run ≥40 chars (mixed case + digits) with no whitespace |
| 5 | Input field selection | `anchorEl.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')` |

## Notes for future edits

- Anchor element is derived from `sel.anchorNode` (handles both element and text nodes).
- The Unicode property regex is wrapped in `try/catch` for engines that don't support `\p{...}` escapes.
- Number regex intentionally allows currency symbols, percent, parentheses and separators so prices, phone numbers and ratios are filtered out.
- `showPopupIconIfNeeded(sel, text)` now accepts the pre-resolved selection/text from `onMouseUp` to avoid re-querying `window.getSelection()`; it still works when called with no args.
