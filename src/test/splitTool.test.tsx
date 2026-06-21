/**
 * splitTool.test.tsx — Split PDF tool tests (Phase 11, plan 11-03).
 *
 * Covers, across three tasks:
 *   - Task 1: SingleFileUploadZone — single-PDF picker, PDF-only validation,
 *             a non-PDF surfaces an inline error and does NOT call onFileSelected.
 *   - Task 2: SplitRoute — upload → page-count readout, range vs each-page modes,
 *             SPLIT funnels through exactly one triggerBlobDownload (a .pdf for range,
 *             a .zip for each-page via zipFiles), invalid range shows inline error +
 *             no download, and a fetch-spy asserting ZERO network across both flows.
 *   - Task 3: registry — split flipped coming-soon → live with a non-null element,
 *             and liveTools() now contains it.
 *
 * Mocking follows mergeTool.test.tsx / downloadWiring.test.ts: the pdfOrganize +
 * toolDownload modules are mocked so the UI wiring is asserted without touching
 * pdf-lib / fflate or the real DOM download anchor.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mock the foundation libs (11-01) so the UI wiring is asserted in isolation ──
const mockSplitPdf = vi.fn()
const mockGetPageCount = vi.fn((..._args: unknown[]) => Promise.resolve(3))
const mockZipFiles = vi.fn()
const mockTriggerBlobDownload = vi.fn()

vi.mock('../lib/pdfOrganize', () => ({
  splitPdf: (...args: unknown[]) => mockSplitPdf(...args),
  getPageCount: (...args: unknown[]) => mockGetPageCount(...args),
}))
vi.mock('../lib/toolDownload', () => ({
  zipFiles: (...args: unknown[]) => mockZipFiles(...args),
  triggerBlobDownload: (...args: unknown[]) => mockTriggerBlobDownload(...args),
}))

// The tool registry's Sign element transitively imports react-pdf's pdfWorker,
// which touches DOMMatrix at import time — absent in jsdom. Mock it (and the
// worker shim) exactly as registry.test.tsx does so importing the registry here
// (for the Task 3 live-split assertions) does not throw.
vi.mock('react-pdf', () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' }, version: '0' },
}))
vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: { cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' },
}))

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Build a File with a given name + MIME type and small dummy bytes. */
function makeFile(name: string, type: string): File {
  return new File([new Uint8Array([1, 2, 3, 4])], name, { type })
}

/** Build a valid PDF File (passes validateFile: application/pdf + .pdf). */
function makePdf(name: string): File {
  return makeFile(name, 'application/pdf')
}

/**
 * Fire a change event on a file input with the given Files. jsdom does not let
 * you assign to input.files directly via fireEvent.change(target, { files }),
 * so we define the FileList on the element before dispatching.
 */
function selectFiles(input: HTMLInputElement, files: File[]) {
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  })
  fireEvent.change(input)
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ───────────────────────────────────────────────────────────────────────────
// Task 1: SingleFileUploadZone
// ───────────────────────────────────────────────────────────────────────────

describe('SingleFileUploadZone — single-PDF picker', () => {
  it('renders a single (not multiple) PDF-only file input', async () => {
    const { SingleFileUploadZone } = await import('../components/SingleFileUploadZone')
    const { container } = render(<SingleFileUploadZone onFileSelected={vi.fn()} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.multiple).toBe(false)
    expect(input.accept).toContain('.pdf')
  })

  it('calls onFileSelected with the chosen PDF', async () => {
    const { SingleFileUploadZone } = await import('../components/SingleFileUploadZone')
    const onFileSelected = vi.fn()
    const { container } = render(<SingleFileUploadZone onFileSelected={onFileSelected} />)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    act(() => {
      selectFiles(input, [makePdf('doc.pdf')])
    })

    expect(onFileSelected).toHaveBeenCalledTimes(1)
    expect((onFileSelected.mock.calls[0][0] as File).name).toBe('doc.pdf')
  })

  it('does NOT call onFileSelected for a non-PDF and surfaces an inline error', async () => {
    const { SingleFileUploadZone } = await import('../components/SingleFileUploadZone')
    const onFileSelected = vi.fn()
    const { container, queryByRole } = render(
      <SingleFileUploadZone onFileSelected={onFileSelected} />,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement

    act(() => {
      selectFiles(input, [makeFile('pic.png', 'image/png')])
    })

    expect(onFileSelected).not.toHaveBeenCalled()
    const alert = queryByRole('alert')
    expect(alert).not.toBeNull()
    expect(alert?.textContent ?? '').toMatch(/PDF/i)
  })

  it('renders an externally-supplied error', async () => {
    const { SingleFileUploadZone } = await import('../components/SingleFileUploadZone')
    const { queryByRole } = render(
      <SingleFileUploadZone onFileSelected={vi.fn()} error="boom from parent" />,
    )
    expect(queryByRole('alert')?.textContent ?? '').toMatch(/boom from parent/i)
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Task 2: SplitRoute — page count, modes, split/download wiring
// ───────────────────────────────────────────────────────────────────────────

/** Renders SplitRoute inside a router, returns RTL utils. */
async function renderSplitRoute() {
  const { SplitRoute } = await import('../routes/SplitRoute')
  return render(
    <MemoryRouter>
      <SplitRoute />
    </MemoryRouter>,
  )
}

/** Add a single PDF to the route by firing a change on its file input. */
function uploadPdf(container: Element, file: File) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  act(() => {
    selectFiles(input, [file])
  })
}

/** Find a button whose aria-label matches the given regex. */
function getButton(container: Element, re: RegExp): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    re.test(b.getAttribute('aria-label') ?? ''),
  )
  if (!btn) throw new Error(`button matching ${re} not found`)
  return btn as HTMLButtonElement
}

describe('SplitRoute — upload + page count', () => {
  it('shows the page count after a PDF is uploaded', async () => {
    // mockGetPageCount resolves to 3 — the route reads N once after upload.
    const { container, findByText } = await renderSplitRoute()
    uploadPdf(container, makePdf('report.pdf'))
    expect(await findByText(/PAGES\s*—?\s*3/i)).toBeTruthy()
  })
})

describe('SplitRoute — range mode', () => {
  it('SPLIT in range mode downloads one PDF named with the range, no zip', async () => {
    const SINGLE = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    mockSplitPdf.mockResolvedValue({ kind: 'single', bytes: SINGLE })

    const { container, getByRole } = await renderSplitRoute()
    uploadPdf(container, makePdf('report.pdf'))

    // Choose range mode + enter a range.
    act(() => {
      fireEvent.click(getButton(container, /extract range/i))
    })
    const rangeInput = getByRole('textbox') as HTMLInputElement
    act(() => {
      fireEvent.change(rangeInput, { target: { value: '1-2' } })
    })

    await act(async () => {
      fireEvent.click(getButton(container, /split/i))
    })

    expect(mockSplitPdf).toHaveBeenCalledTimes(1)
    expect(mockSplitPdf.mock.calls[0][1]).toEqual({ mode: 'range', range: '1-2' })
    expect(mockZipFiles).not.toHaveBeenCalled()
    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    const [bytes, filename, mime] = mockTriggerBlobDownload.mock.calls[0]
    expect(bytes).toBe(SINGLE)
    expect(filename).toMatch(/report-pages-1-2\.pdf$/)
    expect(mime).toBe('application/pdf')
  })

  it('an invalid range rejection surfaces an inline error and does NOT download', async () => {
    mockSplitPdf.mockRejectedValue(
      new Error('Invalid page range: "9-9" is outside this document\'s 1–3 pages.'),
    )
    const { container, getByRole, queryByRole } = await renderSplitRoute()
    uploadPdf(container, makePdf('report.pdf'))

    act(() => {
      fireEvent.click(getButton(container, /extract range/i))
    })
    act(() => {
      fireEvent.change(getByRole('textbox'), { target: { value: '9-9' } })
    })
    await act(async () => {
      fireEvent.click(getButton(container, /split/i))
    })

    expect(mockTriggerBlobDownload).not.toHaveBeenCalled()
    expect(mockZipFiles).not.toHaveBeenCalled()
    const alert = queryByRole('alert')
    expect(alert).not.toBeNull()
    expect(alert?.textContent ?? '').toMatch(/range/i)
  })
})

describe('SplitRoute — each-page mode', () => {
  it('SPLIT in each mode zips the multi files then downloads one .zip', async () => {
    const files = [
      { name: 'report-page-1.pdf', bytes: new Uint8Array([1]) },
      { name: 'report-page-2.pdf', bytes: new Uint8Array([2]) },
      { name: 'report-page-3.pdf', bytes: new Uint8Array([3]) },
    ]
    const ZIP = new Uint8Array([0x50, 0x4b, 0x03, 0x04])
    mockSplitPdf.mockResolvedValue({ kind: 'multi', files })
    mockZipFiles.mockReturnValue(ZIP)

    const { container } = await renderSplitRoute()
    uploadPdf(container, makePdf('report.pdf'))

    act(() => {
      fireEvent.click(getButton(container, /each page/i))
    })
    await act(async () => {
      fireEvent.click(getButton(container, /split/i))
    })

    expect(mockSplitPdf).toHaveBeenCalledTimes(1)
    expect(mockSplitPdf.mock.calls[0][1]).toEqual({ mode: 'each' })
    expect(mockZipFiles).toHaveBeenCalledTimes(1)
    expect(mockZipFiles.mock.calls[0][0]).toBe(files)
    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    const [bytes, filename, mime] = mockTriggerBlobDownload.mock.calls[0]
    expect(bytes).toBe(ZIP)
    expect(filename).toMatch(/report-pages\.zip$/)
    expect(mime).toBe('application/zip')
  })
})

describe('SplitRoute — PAR-05 zero network', () => {
  it('neither range nor each-page split flow makes any network request', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network blocked in test')))
    const origFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      // range flow
      mockSplitPdf.mockResolvedValue({ kind: 'single', bytes: new Uint8Array([1]) })
      const r1 = await renderSplitRoute()
      uploadPdf(r1.container, makePdf('a.pdf'))
      act(() => {
        fireEvent.click(getButton(r1.container, /extract range/i))
      })
      act(() => {
        fireEvent.change(r1.getByRole('textbox'), { target: { value: '1' } })
      })
      await act(async () => {
        fireEvent.click(getButton(r1.container, /split/i))
      })
      cleanup()

      // each-page flow
      mockSplitPdf.mockResolvedValue({
        kind: 'multi',
        files: [{ name: 'a-page-1.pdf', bytes: new Uint8Array([1]) }],
      })
      mockZipFiles.mockReturnValue(new Uint8Array([0x50, 0x4b]))
      const r2 = await renderSplitRoute()
      uploadPdf(r2.container, makePdf('a.pdf'))
      act(() => {
        fireEvent.click(getButton(r2.container, /each page/i))
      })
      await act(async () => {
        fireEvent.click(getButton(r2.container, /split/i))
      })

      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      globalThis.fetch = origFetch
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Task 3: registry — split flipped coming-soon → live
// ───────────────────────────────────────────────────────────────────────────

describe('SPL-01: split registry entry is live', () => {
  it('TOOL_REGISTRY split is live with a non-null element and no "coming soon" blurb', async () => {
    const { TOOL_REGISTRY } = await import('../tools/registry')
    const split = TOOL_REGISTRY.find((t) => t.id === 'split')
    expect(split).toBeDefined()
    expect(split?.route).toBe('/split')
    expect(split?.status).toBe('live')
    expect(split?.element).not.toBeNull()
    expect(split?.blurb ?? '').not.toMatch(/coming soon/i)
  })

  it('liveTools() now contains split', async () => {
    const { liveTools } = await import('../tools/registry')
    expect(liveTools().some((t) => t.id === 'split')).toBe(true)
  })
})
