/**
 * pdfOrganize.ts
 *
 * Pure, DOM-free pdf-lib page-operation library shared by the Phase 11 organize
 * tools (Merge / Split / Organize — plans 11-02..11-04). Every function here is
 * unit-testable without a browser: it takes bytes in and returns bytes out.
 *
 * SAVE DECISION (per 11-CONTEXT decisions — read before changing):
 *   These functions use the STANDARD `PDFDocument.save()`, NOT `saveIncremental()`.
 *   Merge/Split/Organize legitimately produce NEW documents (a combined, extracted,
 *   or rebuilt PDF), so the EXP-02 byte-identity guarantee does NOT apply to their
 *   output — that guarantee is specific to the signing overlay path in exportPdf.ts,
 *   which appends an incremental revision to the original bytes. Here, page CONTENT
 *   is preserved losslessly (`copyPages` embeds source pages verbatim — no
 *   re-rasterization), but the container is a brand-new PDF. Do NOT try to force
 *   byte-identity onto these tools, and do NOT import from exportPdf.ts.
 *
 * Privacy: no fetch, no network, no DOM. All work is in-memory (PAR-05). Errors are
 * re-thrown as tagged Errors (mirrors imageWrapper.ts T-01-07) so the tool UIs can
 * map them to friendly corrupt-file copy without leaking internal pdf-lib messages.
 */

import { PDFDocument, degrees } from 'pdf-lib-incremental-save'

/** A source file's bytes plus its name (used to derive per-page output filenames). */
export interface ToolFile {
  name: string
  bytes: ArrayBuffer | Uint8Array
}

/** Result of splitPdf — a single extracted PDF or N single-page PDFs. */
export type SplitResult =
  | { kind: 'single'; bytes: Uint8Array }
  | { kind: 'multi'; files: { name: string; bytes: Uint8Array }[] }

/** Split options: extract a 1-based inclusive page range, or one PDF per page. */
export type SplitOptions = { mode: 'range'; range: string } | { mode: 'each' }

/** A single Organize op describing one page of the FINAL document (0-based src index). */
export interface OrganizeOp {
  /** 0-based index of the source page to place here. */
  srcIndex: number
  /** Optional additive rotation in degrees (normalized to {0,90,180,270}). */
  rotate?: number
}

/** Normalizes any byte input to a Uint8Array without copying when already one. */
function toBytes(input: ArrayBuffer | Uint8Array): Uint8Array {
  return input instanceof Uint8Array ? input : new Uint8Array(input)
}

/** Strips the final extension from a filename ("report.pdf" → "report"). */
function baseName(name: string): string {
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.slice(0, lastDot) : name
}

/**
 * Parses a 1-based, inclusive page-range spec into an array of 1-based page numbers.
 *
 * Accepts "N" (single page) or "A-B" (span). Whitespace is tolerated ("2 - 4").
 * Throws a tagged Error ("Invalid page range: ...") on empty, non-numeric,
 * out-of-bounds, or reversed input — BEFORE any copyPages runs (T-11-04).
 *
 * @param spec - The range spec, e.g. "3" or "2-4".
 * @param totalPages - The total page count of the source document (≥ 1).
 * @returns 1-based page numbers, e.g. parsePageRange("2-4", 10) → [2,3,4].
 */
export function parsePageRange(spec: string, totalPages: number): number[] {
  const trimmed = (spec ?? '').trim()
  if (trimmed === '') {
    throw new Error('Invalid page range: enter a page number or range like "2-4".')
  }

  const parts = trimmed.split('-').map((p) => p.trim())
  if (parts.length > 2) {
    throw new Error(`Invalid page range: "${spec}" is not a valid range.`)
  }

  const nums = parts.map((p) => {
    if (!/^\d+$/.test(p)) {
      throw new Error(`Invalid page range: "${spec}" must contain only page numbers.`)
    }
    return Number(p)
  })

  const start = nums[0]
  const end = nums.length === 2 ? nums[1] : nums[0]

  if (start < 1 || end < 1 || start > totalPages || end > totalPages) {
    throw new Error(
      `Invalid page range: "${spec}" is outside this document's 1–${totalPages} pages.`,
    )
  }
  if (start > end) {
    throw new Error(`Invalid page range: "${spec}" — the start page is after the end page.`)
  }

  const out: number[] = []
  for (let n = start; n <= end; n++) out.push(n)
  return out
}

/**
 * Reads the page count of a PDF without producing any output document.
 *
 * Used by the Split tool UI to show "PAGES — N" once after upload (and to bound
 * the range input) without re-implementing pdf-lib loading in the route. Throws a
 * tagged Error ("Could not read this PDF ...") on load failure so the UI can show
 * friendly corrupt-file copy.
 *
 * @param bytes - The source PDF bytes.
 * @returns The page count (≥ 1 for a valid PDF).
 * @throws Tagged Error on load failure (T-11-09 — corrupt/encrypted input).
 */
export async function getPageCount(bytes: ArrayBuffer | Uint8Array): Promise<number> {
  try {
    const doc = await PDFDocument.load(toBytes(bytes))
    return doc.getPageCount()
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not read this PDF: ${message}`)
  }
}

/**
 * Merges multiple PDFs into one, preserving input-array order then page order
 * within each file. Page content is embedded losslessly via copyPages.
 *
 * @param files - Source PDFs (name + bytes), in the desired merge order.
 * @returns The combined PDF bytes (standard save()).
 * @throws Tagged Error ("Could not merge ...") if any input fails to load (T-11-02).
 */
export async function mergePdfs(files: ToolFile[]): Promise<Uint8Array> {
  try {
    const out = await PDFDocument.create()
    for (const file of files) {
      const src = await PDFDocument.load(toBytes(file.bytes))
      const copied = await out.copyPages(src, src.getPageIndices())
      for (const page of copied) out.addPage(page)
    }
    return await out.save()
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not merge the PDFs: ${message}`)
  }
}

/**
 * Splits a PDF either into a single extracted range or into one PDF per page.
 *
 * range mode: returns { kind:'single', bytes } containing exactly the requested span.
 * each mode:  returns { kind:'multi', files } — one single-page PDF per source page,
 *             named "<base>-page-<n>.pdf" (n zero-padded to the page-count width so
 *             zip entries sort correctly).
 *
 * @param file - The source PDF (name + bytes).
 * @param opts - { mode:'range', range } or { mode:'each' }.
 * @throws Tagged Error ("Could not split ...") on load failure (parsePageRange's
 *         "Invalid page range" message propagates through unwrapped for the UI).
 */
export async function splitPdf(file: ToolFile, opts: SplitOptions): Promise<SplitResult> {
  let src: PDFDocument
  try {
    src = await PDFDocument.load(toBytes(file.bytes))
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not split the PDF: ${message}`)
  }

  const totalPages = src.getPageCount()
  const base = baseName(file.name)

  if (opts.mode === 'range') {
    // parsePageRange throws "Invalid page range: ..." — let it propagate for the UI.
    const pages1 = parsePageRange(opts.range, totalPages)
    try {
      const out = await PDFDocument.create()
      const copied = await out.copyPages(src, pages1.map((n) => n - 1))
      for (const page of copied) out.addPage(page)
      return { kind: 'single', bytes: await out.save() }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : String(cause)
      throw new Error(`Could not split the PDF: ${message}`)
    }
  }

  // mode: 'each' — one single-page PDF per source page.
  try {
    const width = String(totalPages).length
    const files: { name: string; bytes: Uint8Array }[] = []
    for (let i = 0; i < totalPages; i++) {
      const out = await PDFDocument.create()
      const [page] = await out.copyPages(src, [i])
      out.addPage(page)
      const n = String(i + 1).padStart(width, '0')
      files.push({ name: `${base}-page-${n}.pdf`, bytes: await out.save() })
    }
    return { kind: 'multi', files }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not split the PDF: ${message}`)
  }
}

/**
 * Rebuilds a PDF from an ordered list of source-page ops describing the FINAL
 * document. Deleted pages are simply absent from `ops`. Reorder follows the op
 * order; per-op `rotate` is applied additively to the copied page's existing
 * rotation and normalized into {0,90,180,270}.
 *
 * @param file - The source PDF (name + bytes).
 * @param ops - Ordered ops; each { srcIndex (0-based), rotate? (degrees) }.
 * @returns The rebuilt PDF bytes (standard save()).
 * @throws Tagged Error ("Could not organize ...") on load/op failure (T-11-02).
 */
export async function organizePages(file: ToolFile, ops: OrganizeOp[]): Promise<Uint8Array> {
  try {
    const src = await PDFDocument.load(toBytes(file.bytes))
    const out = await PDFDocument.create()
    const copied = await out.copyPages(
      src,
      ops.map((o) => o.srcIndex),
    )
    copied.forEach((page, i) => {
      out.addPage(page)
      const rotate = ops[i].rotate
      if (rotate) {
        const existing = page.getRotation().angle
        const normalized = (((existing + rotate) % 360) + 360) % 360
        page.setRotation(degrees(normalized))
      }
    })
    return await out.save()
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause)
    throw new Error(`Could not organize the pages: ${message}`)
  }
}
