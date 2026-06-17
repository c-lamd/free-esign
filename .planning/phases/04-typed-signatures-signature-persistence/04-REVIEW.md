---
phase: 04-typed-signatures-signature-persistence
reviewed: 2026-06-17T00:00:00Z
depth: deep
files_reviewed: 11
files_reviewed_list:
  - src/lib/fonts.ts
  - src/lib/exportPdf.ts
  - src/lib/savedSignatures.ts
  - src/store/fieldStore.ts
  - src/components/SignatureDrawModal.tsx
  - src/components/InitialsDrawModal.tsx
  - src/components/SavedItemCard.tsx
  - src/components/PlacedFieldWidget.tsx
  - src/components/LazyPage.tsx
  - src/App.tsx
  - src/index.css
findings:
  critical: 0
  warning: 5
  info: 4
  total: 9
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-06-17
**Depth:** deep
**Files Reviewed:** 11
**Status:** issues_found

## Summary

Reviewed all Phase 4 production source: font loader (`fonts.ts`), export engine (`exportPdf.ts`), saved-items persistence (`savedSignatures.ts`), field store (`fieldStore.ts`), both draw modals, `SavedItemCard`, `PlacedFieldWidget`, `LazyPage`, and `App.tsx`.

The EXP-02 zero-alteration guarantee is intact: `takeSnapshot` → `markRefForSave` before each draw → `saveIncremental` → `concat(original, incremental)` is correct. No rasterization of typed text — `drawSignatureText` emits PDF text objects via `page.drawText`. Privacy constraint is met: `FONT_FILE_MAP` is a static 3-key allowlist, all fetches are same-origin, no third-party network calls exist. `savedItems` is correctly excluded from `resetFields`. `registerFontkit` is called exactly once per export, gated by `hasFontBackedFields`.

No critical (BLOCKER) issues were found. Five warnings and four info-level findings are detailed below. The most impactful are a focus-trap escape vector in both modals (WR-01) and duplicate HTML IDs from the shared `saveForReuseRow` JSX variable (WR-02).

---

## Warnings

### WR-01: Focus trap silently escapes in both modals — forward Tab can leave the dialog

**File:** `src/components/SignatureDrawModal.tsx:154-175` (same pattern `src/components/InitialsDrawModal.tsx:155-179`)

**Issue:** The focus-trap implementation calls `dialog.querySelectorAll('button, canvas[tabindex="0"], input, [role="radio"]')` to find all focusable elements. All three tab panels are always present in the DOM; only their visibility is toggled with the `hidden` attribute. `querySelectorAll` returns elements inside `hidden` subtrees because it does not filter by CSS visibility or the `hidden` attribute.

As a result, `last` (the final node in the returned `NodeList`) is always the "Use signature/initials" button inside the **Saved panel** — even when that panel is hidden. Modern browsers honour `hidden` and silently drop `.focus()` calls on elements in hidden subtrees. So:

- **Forward Tab from the actual last visible button**: `current === last` is never `true` (because `last` is a hidden element the browser won't focus), so `e.preventDefault()` is never called and focus escapes the modal.
- **Shift+Tab from the first element**: `last.focus()` is called but silently no-ops; focus stays on `first` rather than wrapping to the actual last visible element.

**Fix:** Filter out elements that are inside a `hidden` ancestor before computing `first`/`last`:

```ts
const nodes = Array.from(allFocusable).filter(
  (el) => !el.closest('[hidden]') && !el.closest('[aria-hidden="true"]')
)
```

---

### WR-02: Duplicate HTML `id` from shared `saveForReuseRow` JSX variable

**File:** `src/components/SignatureDrawModal.tsx:416-699` (same in `src/components/InitialsDrawModal.tsx:421-704`)

**Issue:** `saveForReuseRow` is a JSX variable that contains `<input id="sig-save-for-reuse" ...>` and `<label htmlFor="sig-save-for-reuse">`. It is placed inside **both** the Draw panel (line 462) and the Type panel (line 699). Because all three panels are always in the DOM (toggled with `hidden`), the document always contains two elements with `id="sig-save-for-reuse"`. The `htmlFor` binding becomes ambiguous — the browser associates the label with whichever element with that ID appears first in the DOM. Clicking the label in the Type panel activates the wrong (Draw panel) checkbox.

The same defect exists in `InitialsDrawModal` with `id="ini-save-for-reuse"`.

**Fix:** Use distinct IDs per panel and use a helper function (not a shared JSX variable) so each panel produces a unique ID:

```tsx
function SaveForReuseRow({ idSuffix, checked, onChange }: {...}) {
  const id = `save-for-reuse-${idSuffix}` // e.g. "save-for-reuse-draw", "save-for-reuse-type"
  return (
    <div>
      <input id={id} type="checkbox" checked={checked} onChange={onChange} />
      <label htmlFor={id}>Save for reuse</label>
    </div>
  )
}
```

---

### WR-03: `SavedItemCard` exposes `role="radio"` with no keyboard activation handler

**File:** `src/components/SavedItemCard.tsx:82-106`

**Issue:** The card `div` carries `role="radio"`, `aria-checked`, and `tabIndex` (roving), which correctly advertises it as a keyboard-navigable radio button. However, the component has **no `onKeyDown` handler**. Enter and Space — the ARIA-specified activation keys for a radio element — do nothing. Keyboard users can Tab to a card and visually see focus, but cannot select it.

The parent `SavedItemCard` radiogroup in both modals also lacks arrow-key navigation for moving between cards (a separate but related omission also present in the font picker radiogroup — see IN-02).

**Fix:** Add an `onKeyDown` handler to the card `div`:

```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    onSelect(item.id)
  }
}}
```

---

### WR-04: `fetch` response not checked for HTTP success — 404 produces silent corrupt-bytes path

**File:** `src/lib/fonts.ts:58`

**Issue:** The fetch call does not check `response.ok` before reading `arrayBuffer()`:

```ts
const buffer = await fetch(path).then((r) => r.arrayBuffer())
```

If a font file is missing in deployment (e.g. a botched Vercel deploy), `fetch` resolves successfully with a `404` status. `r.arrayBuffer()` also resolves, returning the HTML error-page bytes. Those bytes are stored in `fontBytesCache` and passed to `pdfDoc.embedFont(ttfBytes)`. fontkit then throws an opaque parse error ("Not a supported font format") with no indication that the underlying cause is a missing file. The cache also poisoned: subsequent exports reuse the invalid bytes from cache without fetching again.

**Fix:**

```ts
const response = await fetch(path)
if (!response.ok) {
  throw new Error(`Failed to fetch font "${fontFamily}": HTTP ${response.status}`)
}
const buffer = await response.arrayBuffer()
```

---

### WR-05: `img.naturalHeight === 0` produces `aspectRatio = Infinity`, then `defaultHeightPx = 0`

**File:** `src/components/LazyPage.tsx:165`

**Issue:**

```ts
resolve(img.naturalWidth / img.naturalHeight || (armedFieldType === 'signature' ? 3 : 2))
```

If `img.naturalHeight === 0` (a degenerate PNG — zero-height canvas output), `naturalWidth / naturalHeight` evaluates to `Infinity`. `Infinity` is truthy, so `|| fallback` is not taken. `aspectRatio` becomes `Infinity`. Then:

```ts
defaultHeightPx = defaultWidthPx / aspectRatio  // → 0
```

A field with `pdfHeight = 0` is placed and reaches `drawSignatureText` or `page.drawImage` with a zero-height dimension. `pdf-lib` does not validate dimensions before writing; the resulting PDF object is malformed. The field also renders as invisible in `PlacedFieldWidget`.

In practice `signature_pad` outputs a correctly sized PNG, so this edge case only manifests with programmatically created or externally sourced data URLs. The guard should be explicit:

```ts
resolve(img.naturalWidth > 0 && img.naturalHeight > 0
  ? img.naturalWidth / img.naturalHeight
  : (armedFieldType === 'signature' ? 3 : 2))
```

---

## Info

### IN-01: Font picker radiogroup has no arrow-key navigation (ARIA pattern violation)

**File:** `src/components/SignatureDrawModal.tsx:603-665` (same `src/components/InitialsDrawModal.tsx:608-670`)

**Issue:** The font picker `<div role="radiogroup">` uses a roving `tabIndex` (active font = 0, others = −1), which is the correct ARIA pattern. However, there are no `ArrowLeft`/`ArrowRight` handlers on the radiogroup or its items. The ARIA authoring practices require a radiogroup to support arrow-key navigation; Tab is reserved for moving focus between widgets, not within them. Because non-selected options have `tabIndex={-1}`, they are unreachable by Tab, making the font picker keyboard-inaccessible for users who cannot use a mouse.

**Fix:** Add `onKeyDown` to the radiogroup `div` or to each radio `div` to handle `ArrowRight`/`ArrowLeft` and call `setSelectedFont` with the next/previous font, mirroring the tab-bar implementation already in the same file.

---

### IN-02: `console.warn` statements will surface in production

**File:** `src/store/fieldStore.ts:299,316,330`

**Issue:** Three `console.warn` calls report IndexedDB failures to the browser console in production. These are appropriate for non-blocking failures but should be stripped or gated behind a `DEBUG` flag for production builds. End users seeing DevTools output can be confusing; in a future version these could map to an observable error state.

**Fix:** Gate behind an environment check or use a structured internal logging helper:

```ts
if (import.meta.env.DEV) console.warn('[savedItems] ...', err)
```

---

### IN-03: Embed loop condition is looser than `hasFontBackedFields` guard — may embed font unnecessarily

**File:** `src/lib/exportPdf.ts:205-214`

**Issue:** `hasFontBackedFields` (line 195–198) requires `!!f.textValue && !!f.fontFamily` to be true before calling `registerFontkit` or running the embed loop. But inside the embed loop, the condition is only `field.fontFamily && !embeddedFonts.has(field.fontFamily)` — it does **not** require `field.textValue`. This means a field that has `fontFamily` set but `textValue` absent would be embedded into the PDF even though it will never be drawn (the per-field dispatch at line 250 additionally requires `field.textValue`). The embedded font wastes bytes in the incremental revision. It cannot cause incorrect output because the embed-only-once deduplication Map is keyed by fontFamily and the draw gate at line 250 is independent.

**Fix:** Mirror the `hasFontBackedFields` condition in the embed loop:

```ts
field.textValue &&
field.fontFamily &&
!embeddedFonts.has(field.fontFamily)
```

---

### IN-04: `drawSignatureText` can compute `finalSize ≤ 0` for degenerate field dimensions

**File:** `src/lib/exportPdf.ts:120-124`

**Issue:** When `field.pdfWidth ≤ 4` (the padding constant), `maxWidth = field.pdfWidth - 4` is zero or negative. Any positive `textWidthAtTarget` satisfies `textWidthAtTarget > maxWidth`, triggering the scale-down branch:

```ts
finalSize = sizeFromHeight * (maxWidth / textWidthAtTarget)
```

A negative `maxWidth` produces a negative `finalSize`. Calling `font.heightAtSize(negative)` and `page.drawText(..., { size: negative })` are undefined-behaviour territory for pdf-lib — likely a silent no-draw or a thrown error. The minimum field widths enforced by `PlacedFieldWidget` (`minWidth: 80`) prevent this in the normal UI path, but the export function is a public API with no such guarantee.

**Fix:** Clamp `finalSize` to a floor value, and return early if `maxWidth <= 0`:

```ts
const maxWidth = field.pdfWidth - padding
if (maxWidth <= 0) return  // field too narrow to draw anything
```

---

_Reviewed: 2026-06-17_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
