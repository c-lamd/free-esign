/**
 * exportPdf.ts
 *
 * PDF export engine — the EXP-02 zero-alteration guarantee.
 *
 * Uses pdf-lib-incremental-save to append a new revision to the original PDF bytes.
 * The original content is prepended verbatim; the incremental update (signature XObjects
 * + updated xref/trailer) is concatenated after. This passes the first-512-byte hex
 * comparison test (EXP-02) because the original bytes are unchanged at offset 0.
 *
 * Phase 3 additions:
 *   - Per-type draw dispatch: signature/initials → drawImage; date/text → drawText; checkbox → 'X'
 *   - dataUrl validation moved inside the loop, gated on image types only (Pitfall 6)
 *   - Helvetica + HelveticaBold embedded once before the field loop (Pitfall 7)
 *   - drawTextInBox helper: sizes text to 75% of box height, baseline-centered vertically
 *   - drawCheckboxX helper: ASCII 'X' ONLY — U+2715 (✕) throws WinAnsi encode error (Pitfall 1)
 *
 * Phase 4 additions:
 *   - hasFontBackedFields gate: registers @pdf-lib/fontkit and embeds each unique script font
 *     once (subset:true) before the per-field loop.
 *   - drawSignatureText helper: fits text to box height AND width — no truncation (CONTEXT Area 2).
 *   - Font-backed branch in per-field loop: typed sig/initials → drawSignatureText (not embedPng).
 *   - loadFontBytes: same-origin fetch with 3-key FONT_FILE_MAP allowlist (T-04-04 / PRV-02).
 *
 * Security:
 *   T-02-01: dataUrl validated to start with 'data:image/png;base64,' before embedPng (type-gated).
 *   T-02-02: entire export wrapped in try/catch; re-thrown as tagged Error for ErrorBanner.
 *   T-03-04: checkbox uses ASCII 'X', not U+2715 — WinAnsi cannot encode U+2715.
 *   T-04-04: font family validated against FONT_FILE_MAP allowlist before fetch (fonts.ts).
 *   T-04-05: page.drawText emits PDF text objects — no HTML, no script execution.
 *
 * Architecture:
 *   PRV-01 / PRV-02: no third-party network calls — font bytes fetched same-origin from public/fonts/.
 */

import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, StandardFonts, PDFName, PDFRef } from 'pdf-lib-incremental-save'
import type { PDFFont, PDFPage } from 'pdf-lib-incremental-save'
import type { PlacedField } from '../store/fieldStore'
import { loadFontBytes } from './fonts'

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

/**
 * Truncates text so that it fits within maxWidth points at the given font size.
 * Returns the original string if it already fits.
 *
 * Uses binary search over character count so the result is O(log n) glyph-width
 * queries rather than O(n).
 *
 * @param text - The string to potentially truncate.
 * @param font - An embedded PDFFont used to measure glyph widths.
 * @param size - Font size in points.
 * @param maxWidth - Maximum allowed width in PDF user-space points.
 * @returns The longest prefix of `text` whose rendered width ≤ maxWidth.
 */
function truncateToFit(text: string, font: PDFFont, size: number, maxWidth: number): string {
  if (font.widthOfTextAtSize(text, size) <= maxWidth) return text
  let lo = 0
  let hi = text.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi + 1) / 2)
    if (font.widthOfTextAtSize(text.slice(0, mid), size) <= maxWidth) lo = mid
    else hi = mid - 1
  }
  return text.slice(0, lo)
}

/**
 * Draws text inside a field box, sized to 75% of box height and baseline-centered.
 * Text is truncated (not wrapped) to fit within the field's pdfWidth so that drawn
 * content never overflows into adjacent PDF content (overlay-only guarantee).
 * Returns immediately if text is empty (checkbox/no-value case).
 *
 * @param page - The PDF page to draw on.
 * @param text - The text string to draw.
 * @param font - An already-embedded PDFFont (Helvetica).
 * @param field - The PlacedField providing position/size in PDF user-space.
 */
function drawTextInBox(page: PDFPage, text: string, font: PDFFont, field: PlacedField): void {
  if (!text) return
  const targetSize = font.sizeAtHeight(field.pdfHeight * 0.75)
  const glyphH = font.heightAtSize(targetSize)
  // field.pdfY is the box TOP edge in PDF space (coordinate mapper flips CSS top-left → PDF Y).
  // Box bottom = field.pdfY - field.pdfHeight. Baseline is centered within the box height.
  // Pitfall 3: y is the text baseline — center it vertically in the field box
  const boxBottomY = field.pdfY - field.pdfHeight
  const baselineY = boxBottomY + (field.pdfHeight - glyphH) / 2
  // Clip text to field width (field.pdfWidth - 2pt left padding) so drawn text
  // never escapes the field box and overwrites adjacent original PDF content.
  const maxWidth = field.pdfWidth - 2
  const visibleText = truncateToFit(text, font, targetSize, maxWidth)
  page.drawText(visibleText, {
    x: field.pdfX + 2, // 2pt left padding
    y: baselineY,
    font,
    size: targetSize,
  })
}

/**
 * Draws typed signature/initials text inside a field box, scaled to fit BOTH height
 * and width WITHOUT truncation (CONTEXT Area 2 / SIG-02 / SIG-03).
 *
 * Algorithm:
 *   1. sizeFromHeight = font.sizeAtHeight(pdfHeight × 0.85)
 *   2. If text at that size exceeds maxWidth, scale down: size × (maxWidth / textWidth)
 *   3. Center horizontally via xOffset; center baseline vertically via heightAtSize
 *
 * CRITICAL: Do NOT call truncateToFit here — typed signatures must show the full text.
 * Returns immediately if text is empty (no-op guard).
 *
 * @param page - The PDF page to draw on.
 * @param text - The typed signature/initials text (full string, never truncated).
 * @param font - An already-embedded PDFFont (custom script font via fontkit).
 * @param field - The PlacedField providing position/size in PDF user-space.
 */
function drawSignatureText(page: PDFPage, text: string, font: PDFFont, field: PlacedField): void {
  if (!text) return
  const padding = 4 // pt — total horizontal padding (2pt each side)
  const maxWidth = field.pdfWidth - padding
  // Guard: if the field is degenerate (too narrow to draw anything), skip silently.
  // PlacedFieldWidget enforces minWidth:80px in the UI, but this function is also
  // a public API surface — clamp rather than crash (IN-04).
  if (maxWidth <= 0) return
  const sizeFromHeight = font.sizeAtHeight(field.pdfHeight * 0.85)
  const textWidthAtTarget = font.widthOfTextAtSize(text, sizeFromHeight)
  const finalSize =
    textWidthAtTarget > maxWidth
      ? sizeFromHeight * (maxWidth / textWidthAtTarget)
      : sizeFromHeight
  const glyphH = font.heightAtSize(finalSize)
  const xOffset = (field.pdfWidth - font.widthOfTextAtSize(text, finalSize)) / 2
  // field.pdfY is the box TOP edge; box bottom = field.pdfY - field.pdfHeight.
  const boxBottomY = field.pdfY - field.pdfHeight
  const baselineY = boxBottomY + (field.pdfHeight - glyphH) / 2
  page.drawText(text, {
    x: field.pdfX + xOffset,
    y: baselineY,
    font,
    size: finalSize,
  })
}

/**
 * Draws a bold ASCII 'X' centered inside a field box.
 *
 * CRITICAL: Use ASCII 'X', NOT '✕' (U+2715) — WinAnsi cannot encode U+2715 and
 * pdf-lib will throw `WinAnsi cannot encode "✕" (0x2715)` at runtime (Pitfall 1, VERIFIED).
 *
 * @param page - The PDF page to draw on.
 * @param fontBold - An already-embedded PDFFont (Helvetica-Bold).
 * @param field - The PlacedField providing position/size in PDF user-space.
 */
function drawCheckboxX(page: PDFPage, fontBold: PDFFont, field: PlacedField): void {
  const dim = Math.min(field.pdfWidth, field.pdfHeight)
  const targetSize = fontBold.sizeAtHeight(dim * 0.75)
  const glyphH = fontBold.heightAtSize(targetSize)
  // field.pdfY is the box TOP edge; box bottom = field.pdfY - field.pdfHeight.
  const boxBottomY = field.pdfY - field.pdfHeight
  const baselineY = boxBottomY + (field.pdfHeight - glyphH) / 2
  const xOffset = (field.pdfWidth - fontBold.widthOfTextAtSize('X', targetSize)) / 2
  // ASCII 'X' — never U+2715 (✕)
  page.drawText('X', {
    x: field.pdfX + xOffset,
    y: baselineY,
    font: fontBold,
    size: targetSize,
  })
}

/**
 * Marks the Catalog (Root) and the given page's full parent chain for inclusion in the
 * incremental save revision.
 *
 * When the original PDF uses object streams (ObjStm — the default for pdf-lib / modern PDFs),
 * embedPng causes pdf-lib-incremental-save to rewrite the ObjStm that contains the compressed
 * Catalog entry. If only the page ref is marked, the new xref resolves /Root via /Prev into
 * the clobbered ObjStm → Catalog becomes unresolvable → "Invalid Root reference" in pdfjs.
 *
 * Re-emitting the Catalog + page-tree parent chain as standalone objects in the incremental
 * update ensures all cross-reference entries resolve correctly after the ObjStm is rewritten.
 * This call is idempotent — marking a ref multiple times has no negative effect.
 *
 * @param pdfDoc  - The loaded PDFDocument.
 * @param snapshot - The snapshot obtained from pdfDoc.takeSnapshot().
 * @param page    - The PDFPage being modified.
 */
function markPageStructureForSave(
  pdfDoc: PDFDocument,
  snapshot: ReturnType<PDFDocument['takeSnapshot']>,
  page: PDFPage,
): void {
  snapshot.markRefForSave(page.ref)
  const rootRef = pdfDoc.context.trailerInfo?.Root
  if (rootRef instanceof PDFRef) snapshot.markRefForSave(rootRef)
  let node = page.node
  let guard = 0
  while (node && guard++ < 50) {
    const parentRef = node.get(PDFName.of('Parent'))
    if (!(parentRef instanceof PDFRef)) break
    snapshot.markRefForSave(parentRef)
    node = pdfDoc.context.lookup(parentRef) as typeof node
  }
}

/**
 * Exports a signed PDF by appending an incremental revision to the original bytes.
 *
 * EXP-02 guarantee: `output.slice(0, 512)` is byte-identical to `input.slice(0, 512)`.
 *
 * @param originalPdfBytes - The raw bytes of the original PDF (as ArrayBuffer).
 * @param fields - Placed fields to overlay onto the PDF pages.
 * @returns A Uint8Array containing the signed PDF (original + incremental update).
 * @throws Tagged Error if a field dataUrl is invalid (T-02-01) or if pdf-lib fails (T-02-02).
 */
export async function exportSignedPdf(
  originalPdfBytes: ArrayBuffer,
  fields: PlacedField[],
): Promise<Uint8Array> {
  try {
    const srcBytes = new Uint8Array(originalPdfBytes)
    const pdfDoc = await PDFDocument.load(srcBytes)
    const snapshot = pdfDoc.takeSnapshot()
    const pages = pdfDoc.getPages()

    // Embed standard fonts ONCE before the field loop, but only when text/checkbox
    // fields are present — signature/initials-only exports need no font objects.
    const hasTextFields = fields.some(
      (f) => f.type === 'date' || f.type === 'text' || f.type === 'checkbox',
    )
    const helvetica = hasTextFields ? await pdfDoc.embedFont(StandardFonts.Helvetica) : null
    const helveticaBold = hasTextFields
      ? await pdfDoc.embedFont(StandardFonts.HelveticaBold)
      : null

    // Phase 4: register fontkit and embed each unique script font once — only when
    // font-backed (typed) signature/initials fields are present.
    // CRITICAL: registerFontkit MUST be called before any embedFont for custom TTFs;
    // otherwise fontkit throws FontkitNotRegisteredError (RESEARCH Pitfall 1).
    const hasFontBackedFields = fields.some(
      (f) =>
        (f.type === 'signature' || f.type === 'initials') && !!f.textValue && !!f.fontFamily,
    )

    const embeddedFonts = new Map<string, PDFFont>()
    if (hasFontBackedFields) {
      pdfDoc.registerFontkit(fontkit)
      // Embed each UNIQUE font family exactly once (dedup via Map).
      // Embedding the same font N times wastes space — one embed per family per export.
      for (const field of fields) {
        if (
          (field.type === 'signature' || field.type === 'initials') &&
          field.textValue &&
          field.fontFamily &&
          !embeddedFonts.has(field.fontFamily)
        ) {
          const ttfBytes = await loadFontBytes(field.fontFamily)
          const pdfFont = await pdfDoc.embedFont(ttfBytes, { subset: true })
          embeddedFonts.set(field.fontFamily, pdfFont)
        }
      }
    }

    for (const field of fields) {
      const page = pages[field.pageNumber - 1]
      if (!page) {
        throw new Error(
          `Field "${field.id}" references page ${field.pageNumber} but the PDF only has ${pages.length} page(s)`,
        )
      }

      // Mark BEFORE drawing (RESEARCH anti-pattern: marking after draw omits changes).
      // markPageStructureForSave re-emits the Catalog + page-tree parent chain so that
      // object-stream originals remain openable after embedPng rewrites their ObjStm.
      markPageStructureForSave(pdfDoc, snapshot, page)

      if (field.type === 'signature' || field.type === 'initials') {
        if (field.dataUrl) {
          // Image-backed (drawn) path — UNCHANGED (T-02-01 validation preserved)
          if (!field.dataUrl.startsWith(PNG_DATA_URL_PREFIX)) {
            throw new Error(
              `Invalid dataUrl for field "${field.id}": must start with "${PNG_DATA_URL_PREFIX}"`,
            )
          }
          // Decode base64 PNG data URL to bytes
          const base64 = field.dataUrl.slice(PNG_DATA_URL_PREFIX.length)
          const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
          const pngImage = await pdfDoc.embedPng(pngBytes)

          // field.pdfY is the box TOP edge in PDF space (coordinate mapper stores the top,
          // despite the old "bottom-left" comment — naming was misleading).
          // pdf-lib drawImage(y) expects the lower-left corner → box bottom = pdfY - pdfHeight.
          const boxBottomY = field.pdfY - field.pdfHeight
          page.drawImage(pngImage, {
            x: field.pdfX,
            y: boxBottomY,
            width: field.pdfWidth,
            height: field.pdfHeight,
          })
        } else if (field.textValue && field.fontFamily) {
          // Font-backed (typed) path — real embedded vector text, NOT rasterized PNG (SIG-02/SIG-03).
          // T-04-05: page.drawText emits PDF text objects — no HTML, no script execution.
          const pdfFont = embeddedFonts.get(field.fontFamily)!
          drawSignatureText(page, field.textValue, pdfFont, field)
        } else {
          // Neither image-backed nor font-backed — reject
          throw new Error(
            `Invalid signature/initials field "${field.id}": must have either dataUrl or textValue+fontFamily`,
          )
        }
      } else if (field.type === 'date' || field.type === 'text') {
        // helvetica is guaranteed non-null here: hasTextFields is true when
        // any date/text/checkbox field is present, so embedFont ran above.
        drawTextInBox(page, field.textValue ?? '', helvetica!, field)
      } else if (field.type === 'checkbox') {
        drawCheckboxX(page, helveticaBold!, field)
      }
    }

    const incrementalBytes = await pdfDoc.saveIncremental(snapshot)

    // Concatenate: original bytes verbatim + incremental revision
    // This is the EXP-02 mechanism: srcBytes is untouched at offset 0.
    const result = new Uint8Array(srcBytes.length + incrementalBytes.length)
    result.set(srcBytes, 0)
    result.set(incrementalBytes, srcBytes.length)
    return result
  } catch (cause) {
    // T-02-02: re-throw as tagged Error so callers can map to the ErrorBanner copy
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not export the signed PDF: ${message}`)
  }
}

/**
 * Triggers a browser file download of a PDF Uint8Array.
 *
 * Creates a temporary Blob URL, appends an anchor to the document, clicks it,
 * then removes the anchor and revokes the URL after a brief delay.
 *
 * @param bytes - The PDF bytes to download.
 * @param filename - The filename for the downloaded file (e.g. 'report-signed.pdf').
 */
export function triggerDownload(bytes: Uint8Array, filename: string): void {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Revoke after a brief delay so the download has time to start
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

/**
 * Produces the signed output filename from the original document name.
 *
 * Examples:
 *   'report.pdf'  → 'report-signed.pdf'
 *   'photo.png'   → 'photo-signed.pdf'
 *   'a.b.pdf'     → 'a.b-signed.pdf'
 *   'document'    → 'document-signed.pdf'
 *
 * @param originalName - The original filename (with or without extension).
 * @returns The signed filename always ending in '-signed.pdf'.
 */
export function signedFilename(originalName: string): string {
  const lastDot = originalName.lastIndexOf('.')
  const base = lastDot !== -1 ? originalName.slice(0, lastDot) : originalName
  return `${base}-signed.pdf`
}
