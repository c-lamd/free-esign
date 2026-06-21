/**
 * imageToPdfTool.test.tsx — Image → PDF tool tests (Phase 12, plan 12-02).
 *
 * Covers, across two tasks:
 *   - Task 2: MultiImageUploadZone — multi-select, JPG/PNG-only per-file validation,
 *             mixed-type filtering surfaces an inline error (never crashes).
 *   - Task 3: ImageToPdfRoute — reorderable list (page order), CONVERT enabled at
 *             ≥1 image, CONVERT → imagesToPdf(orderedFiles) → triggerBlobDownload(
 *             'images.pdf') exactly once, failure path shows inline error + no
 *             download, and a fetch-spy asserting ZERO network across the flow (PAR-05).
 *   - Task 3: registry — image-to-pdf flipped to live with a non-null element.
 *
 * Mocking follows mergeTool.test.tsx: imageWrapper + toolDownload are mocked so the
 * UI wiring is asserted without touching pdf-lib or the real DOM download anchor.
 * MultiImageUploadZone is rendered REAL so the picker → list flow is covered.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, act, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mock the foundation libs (12-02) so the UI wiring is asserted in isolation ──
const mockImagesToPdf = vi.fn()
const mockTriggerBlobDownload = vi.fn()

vi.mock('../lib/imageWrapper', () => ({
  imagesToPdf: (...args: unknown[]) => mockImagesToPdf(...args),
}))
vi.mock('../lib/toolDownload', () => ({
  triggerBlobDownload: (...args: unknown[]) => mockTriggerBlobDownload(...args),
}))

// The tool registry's Sign element transitively imports react-pdf's pdfWorker,
// which touches DOMMatrix at import time — absent in jsdom. Mock it (and the
// worker shim) exactly as registry.test.tsx does so importing the registry here
// (for the Task 3 live-image-to-pdf assertions) does not throw.
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

/** Build a valid PNG image File (passes validateFile: image/png + .png). */
function makeImage(name: string, type = 'image/png'): File {
  return makeFile(name, type)
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
// Task 2: MultiImageUploadZone
// ───────────────────────────────────────────────────────────────────────────

describe('MultiImageUploadZone — multi-select image picker', () => {
  it('calls onFilesAdded once with all 3 images when 3 JPG/PNG are selected', async () => {
    const { MultiImageUploadZone } = await import('../components/MultiImageUploadZone')
    const onFilesAdded = vi.fn()
    const { container } = render(<MultiImageUploadZone onFilesAdded={onFilesAdded} />)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.multiple).toBe(true)
    expect(input.accept).toMatch(/png/i)

    act(() => {
      selectFiles(input, [
        makeImage('a.png', 'image/png'),
        makeImage('b.jpg', 'image/jpeg'),
        makeImage('c.png', 'image/png'),
      ])
    })

    expect(onFilesAdded).toHaveBeenCalledTimes(1)
    const passed = onFilesAdded.mock.calls[0][0] as File[]
    expect(passed.map((f) => f.name)).toEqual(['a.png', 'b.jpg', 'c.png'])
  })

  it('filters out a non-image from a mixed selection and surfaces an inline error', async () => {
    const { MultiImageUploadZone } = await import('../components/MultiImageUploadZone')
    const onFilesAdded = vi.fn()
    const { container, queryByRole } = render(
      <MultiImageUploadZone onFilesAdded={onFilesAdded} />,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    act(() => {
      selectFiles(input, [
        makeImage('a.png', 'image/png'),
        makeFile('doc.pdf', 'application/pdf'),
        makeImage('b.jpg', 'image/jpeg'),
      ])
    })

    // Only the 2 images are passed through.
    expect(onFilesAdded).toHaveBeenCalledTimes(1)
    const passed = onFilesAdded.mock.calls[0][0] as File[]
    expect(passed.map((f) => f.name)).toEqual(['a.png', 'b.jpg'])

    // An inline error is surfaced (not a crash).
    const alert = queryByRole('alert')
    expect(alert).not.toBeNull()
    expect(alert?.textContent ?? '').toMatch(/image/i)
  })

  it('does NOT call onFilesAdded when the entire selection is non-image', async () => {
    const { MultiImageUploadZone } = await import('../components/MultiImageUploadZone')
    const onFilesAdded = vi.fn()
    const { container, queryByRole } = render(
      <MultiImageUploadZone onFilesAdded={onFilesAdded} />,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    act(() => {
      selectFiles(input, [makeFile('doc.pdf', 'application/pdf')])
    })

    expect(onFilesAdded).not.toHaveBeenCalled()
    expect(queryByRole('alert')).not.toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Task 3: ImageToPdfRoute — UI + reorder + convert/download wiring
// ───────────────────────────────────────────────────────────────────────────

/** Renders ImageToPdfRoute inside a router, returns RTL utils. */
async function renderImageToPdfRoute() {
  const { ImageToPdfRoute } = await import('../routes/ImageToPdfRoute')
  return render(
    <MemoryRouter>
      <ImageToPdfRoute />
    </MemoryRouter>,
  )
}

/** Find the CONVERT → DOWNLOAD HardwareKey by aria-label. */
function getConvertButton(container: Element): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.getAttribute('aria-label')?.toLowerCase().includes('convert'),
  )
  if (!btn) throw new Error('CONVERT button not found')
  return btn as HTMLButtonElement
}

/** Add files to the route by firing a change on its file input. */
function addFilesToRoute(container: Element, files: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  act(() => {
    selectFiles(input, files)
  })
}

describe('ImageToPdfRoute — empty/disabled state', () => {
  it('renders MultiImageUploadZone and a disabled CONVERT with 0 images', async () => {
    const { container } = await renderImageToPdfRoute()

    // Picker present.
    expect(container.querySelector('input[type="file"]')).not.toBeNull()

    // CONVERT disabled with 0 files.
    const convert = getConvertButton(container)
    expect(convert.getAttribute('aria-disabled')).toBe('true')
  })

  it('enables CONVERT once ≥ 1 image is added (a single image is valid)', async () => {
    const { container } = await renderImageToPdfRoute()
    addFilesToRoute(container, [makeImage('a.png')])
    const convert = getConvertButton(container)
    expect(convert.getAttribute('aria-disabled')).toBeNull()
  })
})

describe('ImageToPdfRoute — reorder + remove', () => {
  it('lists added filenames in selection order', async () => {
    const { container, getAllByTestId } = await renderImageToPdfRoute()
    addFilesToRoute(container, [makeImage('first.png'), makeImage('second.png')])
    const rows = getAllByTestId('image-file-row')
    expect(rows.map((r) => r.getAttribute('data-filename'))).toEqual([
      'first.png',
      'second.png',
    ])
  })

  it('move-down on the first item swaps items 0 and 1', async () => {
    const { container, getAllByTestId } = await renderImageToPdfRoute()
    addFilesToRoute(container, [makeImage('first.png'), makeImage('second.png')])

    const firstRow = getAllByTestId('image-file-row')[0]
    const moveDownBtn = within(firstRow).getByLabelText(/move .*down/i)
    act(() => {
      fireEvent.click(moveDownBtn)
    })

    const rows = getAllByTestId('image-file-row')
    expect(rows.map((r) => r.getAttribute('data-filename'))).toEqual([
      'second.png',
      'first.png',
    ])
  })

  it('remove drops the item; falling to 0 re-disables CONVERT', async () => {
    const { container, getAllByTestId } = await renderImageToPdfRoute()
    addFilesToRoute(container, [makeImage('a.png')])
    expect(getConvertButton(container).getAttribute('aria-disabled')).toBeNull()

    const firstRow = getAllByTestId('image-file-row')[0]
    const removeBtn = within(firstRow).getByLabelText(/remove/i)
    act(() => {
      fireEvent.click(removeBtn)
    })

    expect(getConvertButton(container).getAttribute('aria-disabled')).toBe('true')
  })
})

describe('ImageToPdfRoute — convert + download wiring', () => {
  const CONVERTED = new Uint8Array([0x25, 0x50, 0x44, 0x46])

  beforeEach(() => {
    mockImagesToPdf.mockResolvedValue(CONVERTED)
  })

  it('clicking CONVERT calls imagesToPdf with files in displayed order then downloads once', async () => {
    const { container, getAllByTestId } = await renderImageToPdfRoute()
    addFilesToRoute(container, [makeImage('a.png'), makeImage('b.png')])

    // Reorder: move first down so displayed (page) order is b, a.
    const firstRow = getAllByTestId('image-file-row')[0]
    act(() => {
      fireEvent.click(within(firstRow).getByLabelText(/move .*down/i))
    })

    await act(async () => {
      fireEvent.click(getConvertButton(container))
    })

    expect(mockImagesToPdf).toHaveBeenCalledTimes(1)
    const orderedFiles = mockImagesToPdf.mock.calls[0][0] as File[]
    expect(orderedFiles.map((f) => f.name)).toEqual(['b.png', 'a.png'])

    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    const [bytes, filename, mime] = mockTriggerBlobDownload.mock.calls[0]
    expect(bytes).toBe(CONVERTED)
    expect(filename).toBe('images.pdf')
    expect(mime).toBe('application/pdf')
  })

  it('converts a SINGLE image (CONVERT enabled at length 1)', async () => {
    const { container } = await renderImageToPdfRoute()
    addFilesToRoute(container, [makeImage('solo.png')])

    await act(async () => {
      fireEvent.click(getConvertButton(container))
    })

    expect(mockImagesToPdf).toHaveBeenCalledTimes(1)
    const orderedFiles = mockImagesToPdf.mock.calls[0][0] as File[]
    expect(orderedFiles.map((f) => f.name)).toEqual(['solo.png'])
    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    expect(mockTriggerBlobDownload.mock.calls[0][1]).toBe('images.pdf')
  })

  it('an imagesToPdf rejection surfaces an inline error and does NOT download', async () => {
    mockImagesToPdf.mockRejectedValue(new Error('Image could not be embedded in PDF: boom'))
    const { container, queryByRole } = await renderImageToPdfRoute()
    addFilesToRoute(container, [makeImage('a.png')])

    await act(async () => {
      fireEvent.click(getConvertButton(container))
    })

    expect(mockTriggerBlobDownload).not.toHaveBeenCalled()
    const alert = queryByRole('alert')
    expect(alert).not.toBeNull()
    expect(alert?.textContent ?? '').toMatch(/could not convert/i)
  })

  it('PAR-05: the convert flow makes ZERO network requests', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network blocked in test')))
    const origFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      const { container } = await renderImageToPdfRoute()
      addFilesToRoute(container, [makeImage('a.png'), makeImage('b.png')])
      await act(async () => {
        fireEvent.click(getConvertButton(container))
      })
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = origFetch
    }
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Task 3: registry — image-to-pdf flipped to live (registry zero coming-soon)
// ───────────────────────────────────────────────────────────────────────────

describe('CNV-02: image-to-pdf registry entry is live', () => {
  it('TOOL_REGISTRY image-to-pdf is live with a non-null element at /image-to-pdf', async () => {
    const { TOOL_REGISTRY } = await import('../tools/registry')
    const tool = TOOL_REGISTRY.find((t) => t.id === 'image-to-pdf')
    expect(tool).toBeDefined()
    expect(tool?.route).toBe('/image-to-pdf')
    expect(tool?.status).toBe('live')
    expect(tool?.element).not.toBeNull()
    expect(tool?.blurb ?? '').not.toMatch(/coming soon/i)
  })

  it('liveTools() now contains image-to-pdf and the registry has zero coming-soon', async () => {
    const { liveTools, TOOL_REGISTRY } = await import('../tools/registry')
    expect(liveTools().some((t) => t.id === 'image-to-pdf')).toBe(true)
    expect(TOOL_REGISTRY.filter((t) => t.status === 'coming-soon')).toHaveLength(0)
  })
})
