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
 * Security:
 *   T-02-01: dataUrl validated to start with 'data:image/png;base64,' before embedPng (type-gated).
 *   T-02-02: entire export wrapped in try/catch; re-thrown as tagged Error for ErrorBanner.
 *   T-03-04: checkbox uses ASCII 'X', not U+2715 — WinAnsi cannot encode U+2715.
 *
 * Architecture:
 *   PRV-01 / PRV-02: no network calls — all processing is in-browser via pdf-lib-incremental-save.
 */

import { PDFDocument, StandardFonts } from 'pdf-lib-incremental-save'
import type { PDFFont, PDFPage } from 'pdf-lib-incremental-save'
import type { PlacedField } from '../store/fieldStore'

const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'

/**
 * Draws text inside a field box, sized to 75% of box height and baseline-centered.
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
  // Pitfall 3: y is the text baseline — center it vertically in the field box
  const baselineY = field.pdfY + (field.pdfHeight - glyphH) / 2
  page.drawText(text, {
    x: field.pdfX + 2, // 2pt left padding
    y: baselineY,
    font,
    size: targetSize,
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
  const baselineY = field.pdfY + (field.pdfHeight - glyphH) / 2
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

    // Embed standard fonts ONCE before the field loop (Pitfall 7 — never embed per field)
    const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

    for (const field of fields) {
      const page = pages[field.pageNumber - 1]
      if (!page) {
        throw new Error(
          `Field "${field.id}" references page ${field.pageNumber} but the PDF only has ${pages.length} page(s)`,
        )
      }

      // Mark BEFORE drawing (RESEARCH anti-pattern: marking after draw omits changes)
      snapshot.markRefForSave(page.ref)

      if (field.type === 'signature' || field.type === 'initials') {
        // T-02-01: validate dataUrl — now type-gated (Pitfall 6)
        if (!field.dataUrl?.startsWith(PNG_DATA_URL_PREFIX)) {
          throw new Error(
            `Invalid dataUrl for field "${field.id}": must start with "${PNG_DATA_URL_PREFIX}"`,
          )
        }
        // Decode base64 PNG data URL to bytes
        const base64 = field.dataUrl.slice(PNG_DATA_URL_PREFIX.length)
        const pngBytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
        const pngImage = await pdfDoc.embedPng(pngBytes)

        // field.pdfY is already bottom-left PDF-space (Coordinate Mapper handles Y-flip).
        // Do NOT additionally flip Y — that would double-invert (RESEARCH Pitfall 2).
        page.drawImage(pngImage, {
          x: field.pdfX,
          y: field.pdfY,
          width: field.pdfWidth,
          height: field.pdfHeight,
        })
      } else if (field.type === 'date' || field.type === 'text') {
        drawTextInBox(page, field.textValue ?? '', helvetica, field)
      } else if (field.type === 'checkbox') {
        drawCheckboxX(page, helveticaBold, field)
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
