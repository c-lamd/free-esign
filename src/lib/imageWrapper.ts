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

import { PDFDocument } from 'pdf-lib-incremental-save'

/**
 * Core implementation: builds a single-page PDF from image bytes.
 * Shared by both wrapImageAsPdf (returns Blob URL) and wrapImageAsPdfBytes (returns raw bytes).
 *
 * @internal
 */
async function buildWrappedPdf(file: File, arrayBuffer: ArrayBuffer): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  await appendImagePage(pdfDoc, file.type, arrayBuffer)
  return pdfDoc.save()
}

/**
 * Embeds one image's original bytes into `pdfDoc` and appends a single page sized
 * to that image, drawn full-bleed at the page origin.
 *
 * embedPng for PNG; embedJpg for everything else (JPEG/JPG). Original bytes are
 * embedded directly — no canvas rasterization, no lossy re-encode (document
 * integrity / CLAUDE.md constraint). Identical embed branch to buildWrappedPdf,
 * shared so the single-image and multi-image paths stay byte-for-byte consistent.
 *
 * @internal
 */
async function appendImagePage(
  pdfDoc: PDFDocument,
  mimeType: string,
  arrayBuffer: ArrayBuffer,
): Promise<void> {
  const image =
    mimeType === 'image/png'
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
}

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
    const pdfBytes = await buildWrappedPdf(file, arrayBuffer)
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

/**
 * Wraps a JPG or PNG File into a single-page PDF and returns BOTH the Blob URL
 * (for display) and the raw PDF bytes (for export via exportSignedPdf).
 *
 * This satisfies EXP-03: image-sourced documents export as a PDF containing the
 * original image plus overlaid signature fields.
 *
 * @param file - A File with type 'image/jpeg' or 'image/png'
 * @returns A Promise resolving to { url: string, bytes: Uint8Array }
 * @throws An Error with a descriptive message if embedding fails
 */
export async function wrapImageAsPdfWithBytes(
  file: File,
): Promise<{ url: string; bytes: Uint8Array }> {
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
    const pdfBytes = await buildWrappedPdf(file, arrayBuffer)
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    return { url, bytes: pdfBytes }
  } catch (cause) {
    // Re-throw as a tagged Error so callers can display the corrupt-file copy
    // without leaking internal pdf-lib error messages to the UI.
    throw new Error(
      'Image could not be embedded in PDF: ' +
        (cause instanceof Error ? cause.message : String(cause)),
    )
  }
}

/**
 * Wraps one or more JPG/PNG Files into a SINGLE multi-page PDF — one page per
 * image, in the input-array order. This is the Image → PDF tool's lossless core
 * (CNV-02): each image's original bytes are embedded via embedPng/embedJpg (no
 * canvas rasterization, no re-encode), exactly like the single-image wrap path.
 *
 * Distinct from wrapImageAsPdf / wrapImageAsPdfWithBytes (which the signing image
 * path depends on and which must stay one-page) — this builds ONE PDFDocument and
 * appends a page per file.
 *
 * Threat model: T-12-06 — a corrupt/unsupported image is caught and re-thrown as
 * a tagged Error ("Image could not be embedded in PDF: ...") so the route can map
 * it to friendly inline copy and never download. T-12-05 — purely in-browser; no
 * fetch, no bytes leave the device (PAR-05).
 *
 * @param files - One or more Files with type 'image/jpeg' or 'image/png', in page order.
 * @returns A Promise resolving to the combined PDF bytes (Uint8Array).
 * @throws A tagged Error if `files` is empty, a file's bytes cannot be read, or an
 *         image cannot be embedded.
 */
export async function imagesToPdf(files: File[]): Promise<Uint8Array> {
  if (files.length === 0) {
    throw new Error('There are no images to convert.')
  }

  const pdfDoc = await PDFDocument.create()

  for (const file of files) {
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
      await appendImagePage(pdfDoc, file.type, arrayBuffer)
    } catch (cause) {
      // Re-throw as a tagged Error so callers can display the corrupt-file copy
      // without leaking internal pdf-lib error messages to the UI.
      throw new Error(
        'Image could not be embedded in PDF: ' +
          (cause instanceof Error ? cause.message : String(cause)),
      )
    }
  }

  return pdfDoc.save()
}
