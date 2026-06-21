/**
 * pdfConvert.test.ts — Unit coverage for the pure pdfToImages() conversion lib (12-01).
 *
 * Covers (per 12-01 PLAN <behavior>):
 *   - pdfToImages(bytes, {format, scale}) → non-empty array of { name, bytes } image
 *     entries, one per source page, in page order.
 *   - N-page document → N entries named "<base>-page-<n>.<ext>" with n zero-padded to
 *     the page-count width (so zip entries sort correctly), mirroring splitPdf naming.
 *   - format 'jpeg' → '.jpg' + image/jpeg blob; format 'png' → '.png' + image/png blob.
 *   - SEQUENTIAL render: pages are processed one at a time (render N starts only after
 *     render N-1's toBlob resolved), and each page's canvas is released after toBlob
 *     (width/height set to 0) so memory does not grow with page count.
 *   - A load/render failure re-throws a tagged Error ("Could not convert this PDF: ...")
 *     — never leaks a raw pdfjs message.
 *   - Zero-network: a fetch spy asserts fetch is NEVER called across the conversion.
 *
 * pdfjs-in-jsdom note: react-pdf touches DOMMatrix/worker at import time, which jsdom
 * lacks. We mock 'react-pdf' (its re-exported pdfjs.getDocument) and '../lib/pdfWorker'
 * EXACTLY as the route/registry tests do, plus stub canvas.getContext / canvas.toBlob,
 * so pdfConvert imports and runs cleanly with no real pdfjs rendering.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── Track render ordering + canvas release across all pages ──────────────────
interface RenderEvent {
  page: number
  phase: 'render-start' | 'toBlob'
}
let events: RenderEvent[]
let releasedCanvases: number // count of canvases whose width/height were zeroed
let getDocumentMock: ReturnType<typeof vi.fn<(...args: unknown[]) => unknown>>

// Build a mocked pdfjs document with `numPages` pages. Each page's render+toBlob
// records ordering so we can assert sequential processing.
function makeMockDoc(numPages: number) {
  return {
    numPages,
    getPage: vi.fn((pageNumber: number) =>
      Promise.resolve({
        getViewport: ({ scale }: { scale: number }) => ({
          width: 100 * scale,
          height: 200 * scale,
        }),
        render: ({ canvasContext: _ctx }: { canvasContext: unknown }) => {
          events.push({ page: pageNumber, phase: 'render-start' })
          return { promise: Promise.resolve() }
        },
        cleanup: vi.fn(),
      }),
    ),
  }
}

// ── Mock react-pdf's re-exported pdfjs ───────────────────────────────────────
vi.mock('react-pdf', () => ({
  pdfjs: {
    GlobalWorkerOptions: { workerSrc: '' },
    version: '0',
    getDocument: (...args: unknown[]) => getDocumentMock(...args),
  },
}))
vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: { cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' },
}))

// ── Canvas stub: getContext returns a dummy 2d ctx; toBlob fires async, after
//    which the lib must zero the canvas dimensions (memory release). ───────────
let currentPageForBlob = 0
beforeEach(() => {
  events = []
  releasedCanvases = 0
  currentPageForBlob = 0
  getDocumentMock = vi.fn<(...args: unknown[]) => unknown>()

  // Each created canvas tracks the page it belongs to via insertion order.
  vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
    if (tag !== 'canvas') {
      // Fall back to a minimal element for any non-canvas creation.
      return { tagName: tag.toUpperCase() } as unknown as HTMLElement
    }
    const myPage = ++currentPageForBlob
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({}),
      toBlob: (cb: (b: Blob | null) => void, type: string, _q?: number) => {
        events.push({ page: myPage, phase: 'toBlob' })
        // Resolve on a microtask so a non-sequential impl (Promise.all) would
        // interleave render-starts before toBlobs — caught by the ordering assert.
        Promise.resolve().then(() =>
          cb(new Blob([new Uint8Array([0xde, 0xad])], { type })),
        )
      },
    }
    // Detect release: when width AND height are set to 0 after a non-zero value,
    // we count it. Use a setter to observe.
    let _w = 0
    let _h = 0
    Object.defineProperty(canvas, 'width', {
      get: () => _w,
      set: (v: number) => {
        if (v === 0 && _w !== 0) releasedCanvases++
        _w = v
      },
    })
    Object.defineProperty(canvas, 'height', {
      get: () => _h,
      set: (v: number) => {
        _h = v
      },
    })
    return canvas as unknown as HTMLCanvasElement
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// ── Zero-network fetch spy ───────────────────────────────────────────────────
let fetchSpy: ReturnType<typeof vi.fn>
beforeEach(() => {
  fetchSpy = vi.fn(() => {
    throw new Error('Network call attempted — pdfConvert must be fully offline (PAR-05)')
  })
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
})

describe('pdfToImages — pure pdfjs → canvas → blob conversion', () => {
  it('returns one named entry per page, in page order, zero-padded to the page-count width', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(makeMockDoc(12)) })
    const { pdfToImages } = await import('../lib/pdfConvert')

    const entries = await pdfToImages(new Uint8Array([1, 2, 3]), {
      format: 'png',
      scale: 2.0,
      baseName: 'report',
    })

    expect(entries.length).toBe(12)
    // 12 pages → width 2 → page 1 = "01", page 12 = "12"
    expect(entries[0].name).toBe('report-page-01.png')
    expect(entries[11].name).toBe('report-page-12.png')
    // each entry carries non-empty bytes
    for (const e of entries) expect(e.bytes.byteLength).toBeGreaterThan(0)
  })

  it('jpeg → .jpg extension; png → .png extension', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(makeMockDoc(1)) })
    const { pdfToImages } = await import('../lib/pdfConvert')

    const jpg = await pdfToImages(new Uint8Array([1]), { format: 'jpeg', scale: 1, baseName: 'a' })
    expect(jpg[0].name).toBe('a-page-1.jpg')

    getDocumentMock.mockReturnValue({ promise: Promise.resolve(makeMockDoc(1)) })
    const png = await pdfToImages(new Uint8Array([1]), { format: 'png', scale: 1, baseName: 'a' })
    expect(png[0].name).toBe('a-page-1.png')
  })

  it('defaults baseName to "document" when omitted', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(makeMockDoc(1)) })
    const { pdfToImages } = await import('../lib/pdfConvert')
    const entries = await pdfToImages(new Uint8Array([1]), { format: 'png', scale: 1 })
    expect(entries[0].name).toBe('document-page-1.png')
  })

  it('renders pages SEQUENTIALLY — render N starts only after page N-1 toBlob', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(makeMockDoc(3)) })
    const { pdfToImages } = await import('../lib/pdfConvert')
    await pdfToImages(new Uint8Array([1]), { format: 'png', scale: 1, baseName: 'x' })

    // Expected strictly-sequential trace: r1, b1, r2, b2, r3, b3.
    expect(events).toEqual([
      { page: 1, phase: 'render-start' },
      { page: 1, phase: 'toBlob' },
      { page: 2, phase: 'render-start' },
      { page: 2, phase: 'toBlob' },
      { page: 3, phase: 'render-start' },
      { page: 3, phase: 'toBlob' },
    ])
  })

  it('releases each canvas after toBlob (memory-bounded)', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(makeMockDoc(4)) })
    const { pdfToImages } = await import('../lib/pdfConvert')
    await pdfToImages(new Uint8Array([1]), { format: 'png', scale: 1, baseName: 'x' })
    // one release per page
    expect(releasedCanvases).toBe(4)
  })

  it('re-throws a tagged Error on load failure (never leaks the raw pdfjs message)', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.reject(new Error('xref table broken')) })
    const { pdfToImages } = await import('../lib/pdfConvert')
    await expect(
      pdfToImages(new Uint8Array([1]), { format: 'png', scale: 1 }),
    ).rejects.toThrow(/could not convert this pdf/i)
  })

  it('makes no network request across the conversion (PAR-05)', async () => {
    getDocumentMock.mockReturnValue({ promise: Promise.resolve(makeMockDoc(2)) })
    const { pdfToImages } = await import('../lib/pdfConvert')
    await pdfToImages(new Uint8Array([1]), { format: 'png', scale: 1, baseName: 'x' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
