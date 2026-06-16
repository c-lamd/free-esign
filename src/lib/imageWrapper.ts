/**
 * imageWrapper.ts
 *
 * Wraps a JPG or PNG file into a single-page PDF using pdf-lib.
 * The original image bytes are embedded directly (embedJpg / embedPng) —
 * NO canvas rasterization, preserving document integrity (CLAUDE.md constraint).
 *
 * Threat model: T-01-07 — malicious/corrupt image bytes are caught by pdf-lib
 * and re-thrown as a tagged Error with a user-facing message the caller can map
 * to the ErrorBanner corrupt-file copy.
 *
 * Phase 2 DPI note (Pitfall 4 from RESEARCH.md):
 *   pdf-lib treats image.width/height as PDF points (72 DPI equivalence).
 *   Images captured at > 72 DPI will produce a PDF page larger (in print inches)
 *   than the original file's intended print size. The Coordinate Mapper round-trip
 *   still works correctly in the viewer because both display and PDF use the same
 *   scale. Phase 2 export must address DPI normalization if pixel-accurate placement
 *   at true print size is required.
 */

import { PDFDocument } from 'pdf-lib'

/**
 * Wraps a JPG or PNG File into a single-page PDF sized to the image's pixel
 * dimensions (treated as PDF points).
 *
 * @param file - A File with type 'image/jpeg' or 'image/png'
 * @returns A Promise resolving to a Blob URL of the resulting PDF
 * @throws An Error with a descriptive message if embedding fails
 */
export async function wrapImageAsPdf(file: File): Promise<string> {
  let arrayBuffer: ArrayBuffer

  try {
    arrayBuffer = await file.arrayBuffer()
  } catch (cause) {
    throw new Error(
      'Could not read image file bytes: ' +
        (cause instanceof Error ? cause.message : String(cause)),
    )
  }

  try {
    const pdfDoc = await PDFDocument.create()

    // embedPng for PNG; embedJpg for everything else (JPEG/JPG).
    // Original bytes are embedded directly — no lossy re-encoding (document integrity).
    const image =
      file.type === 'image/png'
        ? await pdfDoc.embedPng(arrayBuffer)
        : await pdfDoc.embedJpg(arrayBuffer)

    // Page dimensions match image pixel dimensions (treated as PDF points at 72 DPI).
    // See Phase 2 DPI note above for implications on print-accurate placement.
    const page = pdfDoc.addPage([image.width, image.height])

    page.drawImage(image, {
      x: 0,
      y: 0,
      width: image.width,
      height: image.height,
    })

    const pdfBytes = await pdfDoc.save()
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    return URL.createObjectURL(blob)
  } catch (cause) {
    // Re-throw as a tagged Error so callers can display the corrupt-file copy
    // without leaking internal pdf-lib error messages to the UI.
    throw new Error(
      'Image could not be embedded in PDF: ' +
        (cause instanceof Error ? cause.message : String(cause)),
    )
  }
}
