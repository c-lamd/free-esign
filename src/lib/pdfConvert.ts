/**
 * pdfConvert.ts
 *
 * Pure, tool-agnostic PDF → page-image conversion for the Convert tool (CNV-01).
 * It takes PDF bytes in and returns named image-byte entries out — one per page —
 * by rendering each page with pdfjs to an offscreen canvas and reading it back as
 * a JPG or PNG blob.
 *
 * It DOES use the DOM (an offscreen <canvas> + pdfjs render), but is otherwise
 * UI-agnostic: the route layer (PdfToImageRoute.tsx) decides single-image-vs-zip
 * download and owns the single download call-site. This file deliberately does NOT
 * import exportPdf.ts and does NOT touch the signing overlay path (PAR-04) — the
 * tools here legitimately produce NEW image bytes, so the EXP-02 byte-identity
 * guarantee (specific to the signing path) does not apply.
 *
 * pdfjs is imported via react-pdf's re-exported `pdfjs` (the codebase convention —
 * react-pdf pins the worker version; do NOT import the raw transitive peer). The
 * pdfWorker module already self-hosts the worker + cmap/standard-font resources, so
 * `pdfOptions` keeps cmap/standard-font lookups same-origin (no CDN — PAR-07).
 *
 * MEMORY (T-12-01): pages are rendered SEQUENTIALLY in a for-loop — render N starts
 * only after page N-1's toBlob resolved (never Promise.all over all pages) — and
 * each page's canvas is released (width/height set to 0, reference dropped) right
 * after toBlob, so peak memory does not grow with page count on large/multi-page
 * PDFs. The 100 MB upload cap (validateFile in SingleFileUploadZone) bounds input.
 *
 * Privacy (PAR-05 / T-12-02): no fetch, no network — every byte stays in the browser.
 * Errors (T-12-03): load/render failures are re-thrown as a tagged Error
 * ("Could not convert this PDF: ...") so the UI can show friendly copy without
 * leaking a raw pdfjs message (mirrors pdfOrganize.ts / imageWrapper.ts tagging).
 */

import { pdfjs } from 'react-pdf'
import { pdfOptions } from './pdfWorker'

/** Output image format the user can pick. */
export type ImageFormat = 'png' | 'jpeg'

/** One rendered page image: a filename and its raw image bytes. */
export interface ImageEntry {
  name: string
  bytes: Uint8Array
}

/** Conversion options: target format, render scale, and an optional output base name. */
export interface PdfToImagesOptions {
  format: ImageFormat
  /** pdfjs render scale (≈ scale × 72 DPI). The route uses 2.0 (≈144 DPI). */
  scale: number
  /** Base for output filenames ("<base>-page-<n>.<ext>"); defaults to "document". */
  baseName?: string
}

/** Normalizes any byte input to a Uint8Array without copying when already one. */
function toBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

/** Reads a canvas as a Blob of the given mime, wrapping the callback-style toBlob. */
function canvasToBlob(canvas: HTMLCanvasElement, mime: string, quality?: number): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('canvas.toBlob produced no image data'))
      },
      mime,
      quality,
    )
  })
}

/**
 * Renders every page of a PDF to a JPG or PNG image, SEQUENTIALLY, returning one
 * named image entry per page in page order.
 *
 * Entries are named "<base>-page-<n>.<ext>" with n 1-based and zero-padded to the
 * page-count width (so a .zip of N entries sorts correctly), mirroring splitPdf's
 * each-page naming. JPEG is encoded at quality 0.92.
 *
 * @param bytes - The source PDF bytes.
 * @param opts - { format, scale, baseName? }.
 * @returns A non-empty array of { name, bytes } image entries (one per page).
 * @throws Tagged Error ("Could not convert this PDF: ...") on load/render failure.
 */
export async function pdfToImages(
  bytes: ArrayBuffer | Uint8Array,
  opts: PdfToImagesOptions,
): Promise<ImageEntry[]> {
  const { format, scale } = opts
  const base = opts.baseName ?? 'document'
  const ext = format === 'jpeg' ? 'jpg' : 'png'
  const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
  const quality = format === 'jpeg' ? 0.92 : undefined

  try {
    const doc = await pdfjs.getDocument({ data: toBytes(bytes), ...pdfOptions }).promise
    const numPages = doc.numPages
    const width = String(numPages).length
    const entries: ImageEntry[] = []

    // SEQUENTIAL render loop — one page at a time; await each toBlob before the next.
    for (let i = 1; i <= numPages; i++) {
      const page = await doc.getPage(i)
      const viewport = page.getViewport({ scale })

      let canvas: HTMLCanvasElement | null = document.createElement('canvas')
      canvas.width = Math.ceil(viewport.width)
      canvas.height = Math.ceil(viewport.height)
      const canvasContext = canvas.getContext('2d')
      if (!canvasContext) throw new Error('could not get a 2D canvas context')

      await page.render({ canvasContext, viewport }).promise
      const blob = await canvasToBlob(canvas, mime, quality)
      const pageBytes = new Uint8Array(await blob.arrayBuffer())

      const n = String(i).padStart(width, '0')
      entries.push({ name: `${base}-page-${n}.${ext}`, bytes: pageBytes })

      // Release the page bitmap + canvas so peak memory does not grow with page count.
      page.cleanup?.()
      canvas.width = 0
      canvas.height = 0
      canvas = null
    }

    return entries
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not convert this PDF: ${message}`)
  }
}
