/**
 * pdfToImageTool.test.tsx — PDF → image tool route tests (Phase 12, plan 12-01).
 *
 * Asserts the route WIRING in isolation (never real pdfjs rendering):
 *   - upload one PDF → JPG/PNG picker + CONVERT key appear; CONVERT is gated until a
 *     format is chosen.
 *   - CONVERT calls pdfToImages(bytes, {format, scale: 2.0, baseName}) exactly once,
 *     then funnels through exactly ONE triggerBlobDownload call-site:
 *       single entry → triggerBlobDownload(entry.bytes, "<base>.<ext>", image mime)
 *       multiple     → zipFiles(entries) then triggerBlobDownload(zip, "<base>-pages.zip",
 *                      'application/zip')
 *   - a pdfToImages rejection surfaces an inline role="alert" and does NOT download.
 *   - a fetch-spy proves ZERO network across the convert flow (PAR-05).
 *   - CHANGE FILE resets to the upload state.
 *
 * Mocking discipline mirrors organizeTool.test.tsx: mock 'react-pdf' + '../lib/pdfWorker'
 * (so any transitive import is clean in jsdom), and mock '../lib/pdfConvert' (pdfToImages)
 * and '../lib/toolDownload' (zipFiles + triggerBlobDownload) so wiring is asserted alone.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Clean jsdom imports (react-pdf touches DOMMatrix/worker at import time) ──
vi.mock('react-pdf', () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' }, version: '0' },
}))
vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: { cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' },
}))

// ── Mock the conversion lib + download layer so route wiring is asserted alone ──
const mockPdfToImages = vi.fn()
const mockZipFiles = vi.fn((..._args: unknown[]) => new Uint8Array([0x50, 0x4b]))
const mockTriggerBlobDownload = vi.fn()

vi.mock('../lib/pdfConvert', () => ({
  pdfToImages: (...args: unknown[]) => mockPdfToImages(...args),
}))
vi.mock('../lib/toolDownload', () => ({
  zipFiles: (...args: unknown[]) => mockZipFiles(...args),
  triggerBlobDownload: (...args: unknown[]) => mockTriggerBlobDownload(...args),
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Helpers (organizeTool.test.tsx pattern) ─────────────────────────────────
function makePdf(name: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type: 'application/pdf' })
}

function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', { configurable: true, value: files })
  fireEvent.change(input)
}

function getButton(container: Element, re: RegExp): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    re.test(b.getAttribute('aria-label') ?? ''),
  )
  if (!btn) throw new Error(`button matching ${re} not found`)
  return btn as HTMLButtonElement
}

function queryButton(container: Element, re: RegExp): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    re.test(b.getAttribute('aria-label') ?? ''),
  ) as HTMLButtonElement | undefined
}

async function renderRoute() {
  const { PdfToImageRoute } = await import('../routes/PdfToImageRoute')
  return render(
    <MemoryRouter>
      <PdfToImageRoute />
    </MemoryRouter>,
  )
}

async function upload(container: Element, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  await act(async () => {
    selectFiles(input, [file])
  })
}

// ───────────────────────────────────────────────────────────────────────────

describe('PdfToImageRoute — upload + format picker', () => {
  it('shows the JPG/PNG picker and a CONVERT key after upload', async () => {
    const { container } = await renderRoute()
    await upload(container, makePdf('report.pdf'))
    expect(queryButton(container, /jpg|jpeg/i)).toBeDefined()
    expect(queryButton(container, /png/i)).toBeDefined()
    expect(queryButton(container, /convert/i)).toBeDefined()
  })

  it('CONVERT is disabled until a format is chosen', async () => {
    mockPdfToImages.mockResolvedValue([{ name: 'report-page-1.png', bytes: new Uint8Array([1]) }])
    const { container } = await renderRoute()
    await upload(container, makePdf('report.pdf'))

    const convert = getButton(container, /convert/i)
    expect(convert.getAttribute('aria-disabled')).toBe('true')

    await act(async () => {
      fireEvent.click(convert)
    })
    expect(mockPdfToImages).not.toHaveBeenCalled()
  })
})

describe('PdfToImageRoute — single page → one image download', () => {
  it('CONVERT calls pdfToImages once then ONE triggerBlobDownload of the image', async () => {
    const IMG = new Uint8Array([0x89, 0x50, 0x4e, 0x47])
    mockPdfToImages.mockResolvedValue([{ name: 'report-page-1.png', bytes: IMG }])

    const { container } = await renderRoute()
    await upload(container, makePdf('report.pdf'))

    act(() => {
      fireEvent.click(getButton(container, /png/i))
    })
    await act(async () => {
      fireEvent.click(getButton(container, /convert/i))
    })

    expect(mockPdfToImages).toHaveBeenCalledTimes(1)
    const [, opts] = mockPdfToImages.mock.calls[0]
    expect(opts).toMatchObject({ format: 'png', scale: 2.0, baseName: 'report' })

    expect(mockZipFiles).not.toHaveBeenCalled()
    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    const [bytes, filename, mime] = mockTriggerBlobDownload.mock.calls[0]
    expect(bytes).toBe(IMG)
    expect(filename).toBe('report.png')
    expect(mime).toBe('image/png')
  })

  it('jpeg single page → image/jpeg mime + .jpg filename', async () => {
    const IMG = new Uint8Array([0xff, 0xd8])
    mockPdfToImages.mockResolvedValue([{ name: 'a-page-1.jpg', bytes: IMG }])
    const { container } = await renderRoute()
    await upload(container, makePdf('a.pdf'))
    act(() => {
      fireEvent.click(getButton(container, /jpg|jpeg/i))
    })
    await act(async () => {
      fireEvent.click(getButton(container, /convert/i))
    })
    const [, filename, mime] = mockTriggerBlobDownload.mock.calls[0]
    expect(filename).toBe('a.jpg')
    expect(mime).toBe('image/jpeg')
  })
})

describe('PdfToImageRoute — multi page → zip download', () => {
  it('multi-entry → zipFiles then ONE triggerBlobDownload of the .zip', async () => {
    const entries = [
      { name: 'report-page-1.png', bytes: new Uint8Array([1]) },
      { name: 'report-page-2.png', bytes: new Uint8Array([2]) },
      { name: 'report-page-3.png', bytes: new Uint8Array([3]) },
    ]
    const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    mockPdfToImages.mockResolvedValue(entries)
    mockZipFiles.mockReturnValue(ZIP)

    const { container } = await renderRoute()
    await upload(container, makePdf('report.pdf'))
    act(() => {
      fireEvent.click(getButton(container, /png/i))
    })
    await act(async () => {
      fireEvent.click(getButton(container, /convert/i))
    })

    expect(mockZipFiles).toHaveBeenCalledTimes(1)
    expect(mockZipFiles.mock.calls[0][0]).toBe(entries)
    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    const [bytes, filename, mime] = mockTriggerBlobDownload.mock.calls[0]
    expect(bytes).toBe(ZIP)
    expect(filename).toBe('report-pages.zip')
    expect(mime).toBe('application/zip')
  })
})

describe('PdfToImageRoute — error path', () => {
  it('a rejection surfaces role="alert" and does NOT download', async () => {
    mockPdfToImages.mockRejectedValue(new Error('Could not convert this PDF: boom'))
    const { container, queryByRole } = await renderRoute()
    await upload(container, makePdf('report.pdf'))
    act(() => {
      fireEvent.click(getButton(container, /png/i))
    })
    await act(async () => {
      fireEvent.click(getButton(container, /convert/i))
    })

    expect(mockTriggerBlobDownload).not.toHaveBeenCalled()
    const alert = queryByRole('alert')
    expect(alert).not.toBeNull()
    expect(alert?.textContent ?? '').toMatch(/convert|corrupt/i)
  })
})

describe('PdfToImageRoute — CHANGE FILE reset', () => {
  it('CHANGE FILE returns to the upload state', async () => {
    const { container } = await renderRoute()
    await upload(container, makePdf('report.pdf'))
    expect(queryButton(container, /convert/i)).toBeDefined()
    act(() => {
      fireEvent.click(getButton(container, /change file|different pdf/i))
    })
    // back to upload: the file input is present again, no CONVERT key
    expect(container.querySelector('input[type="file"]')).not.toBeNull()
    expect(queryButton(container, /convert/i)).toBeUndefined()
  })
})

describe('PdfToImageRoute — PAR-05 zero network', () => {
  it('the convert flow makes no network request', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network blocked in test')))
    const origFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      mockPdfToImages.mockResolvedValue([{ name: 'a-page-1.png', bytes: new Uint8Array([1]) }])
      const { container } = await renderRoute()
      await upload(container, makePdf('a.pdf'))
      act(() => {
        fireEvent.click(getButton(container, /png/i))
      })
      await act(async () => {
        fireEvent.click(getButton(container, /convert/i))
      })
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = origFetch
    }
  })
})
