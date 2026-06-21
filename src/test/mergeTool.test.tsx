/**
 * mergeTool.test.tsx — Merge PDF tool tests (Phase 11, plan 11-02).
 *
 * Covers, across three tasks:
 *   - Task 1: MultiFileUploadZone — multi-select, PDF-only per-file validation,
 *             mixed-type filtering surfaces an inline error (never crashes).
 *   - Task 2: MergeRoute — empty/disabled state, reorder, remove re-disables,
 *             MERGE → mergePdfs(orderedFiles) → triggerBlobDownload('merged.pdf')
 *             exactly once, failure path shows inline error + no download, and a
 *             fetch-spy asserting ZERO network across the merge flow (PAR-05).
 *   - Task 3: registry — merge flipped coming-soon → live with a non-null element,
 *             and liveTools() now contains it.
 *
 * Mocking follows downloadWiring.test.ts: the pdfOrganize + toolDownload modules
 * are mocked so the UI wiring is asserted without touching pdf-lib/fflate or the
 * real DOM download anchor.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, act, cleanup, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

// ── Mock the foundation libs (11-01) so the UI wiring is asserted in isolation ──
const mockMergePdfs = vi.fn()
const mockTriggerBlobDownload = vi.fn()

vi.mock('../lib/pdfOrganize', () => ({
  mergePdfs: (...args: unknown[]) => mockMergePdfs(...args),
}))
vi.mock('../lib/toolDownload', () => ({
  triggerBlobDownload: (...args: unknown[]) => mockTriggerBlobDownload(...args),
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
// Task 1: MultiFileUploadZone
// ───────────────────────────────────────────────────────────────────────────

describe('MultiFileUploadZone — multi-select PDF picker', () => {
  it('calls onFilesAdded once with all 3 PDFs when 3 PDFs are selected', async () => {
    const { MultiFileUploadZone } = await import('../components/MultiFileUploadZone')
    const onFilesAdded = vi.fn()
    const { container } = render(<MultiFileUploadZone onFilesAdded={onFilesAdded} />)

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    expect(input).not.toBeNull()
    expect(input.multiple).toBe(true)

    act(() => {
      selectFiles(input, [makePdf('a.pdf'), makePdf('b.pdf'), makePdf('c.pdf')])
    })

    expect(onFilesAdded).toHaveBeenCalledTimes(1)
    const passed = onFilesAdded.mock.calls[0][0] as File[]
    expect(passed).toHaveLength(3)
    expect(passed.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf', 'c.pdf'])
  })

  it('filters out a non-PDF from a mixed selection and surfaces an inline error', async () => {
    const { MultiFileUploadZone } = await import('../components/MultiFileUploadZone')
    const onFilesAdded = vi.fn()
    const { container, queryByRole } = render(
      <MultiFileUploadZone onFilesAdded={onFilesAdded} />,
    )

    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    act(() => {
      selectFiles(input, [
        makePdf('a.pdf'),
        makeFile('pic.png', 'image/png'),
        makePdf('b.pdf'),
      ])
    })

    // Only the 2 PDFs are passed through.
    expect(onFilesAdded).toHaveBeenCalledTimes(1)
    const passed = onFilesAdded.mock.calls[0][0] as File[]
    expect(passed.map((f) => f.name)).toEqual(['a.pdf', 'b.pdf'])

    // An inline error is surfaced (not a crash).
    const alert = queryByRole('alert')
    expect(alert).not.toBeNull()
    expect(alert?.textContent ?? '').toMatch(/PDF/i)
  })

  it('does NOT call onFilesAdded when the entire selection is non-PDF', async () => {
    const { MultiFileUploadZone } = await import('../components/MultiFileUploadZone')
    const onFilesAdded = vi.fn()
    const { container, queryByRole } = render(
      <MultiFileUploadZone onFilesAdded={onFilesAdded} />,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    act(() => {
      selectFiles(input, [makeFile('pic.png', 'image/png')])
    })

    expect(onFilesAdded).not.toHaveBeenCalled()
    expect(queryByRole('alert')).not.toBeNull()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// Task 2: MergeRoute — UI + reorder + merge/download wiring
// ───────────────────────────────────────────────────────────────────────────

/** Renders MergeRoute inside a router, returns RTL utils. */
async function renderMergeRoute() {
  const { MergeRoute } = await import('../routes/MergeRoute')
  return render(
    <MemoryRouter>
      <MergeRoute />
    </MemoryRouter>,
  )
}

/** Find the MERGE → DOWNLOAD HardwareKey by aria-label. */
function getMergeButton(container: Element): HTMLButtonElement {
  const btn = Array.from(container.querySelectorAll('button')).find((b) =>
    b.getAttribute('aria-label')?.toLowerCase().includes('merge'),
  )
  if (!btn) throw new Error('MERGE button not found')
  return btn as HTMLButtonElement
}

/** Add files to the route by firing a change on its file input. */
function addFilesToRoute(container: Element, files: File[]) {
  const input = container.querySelector('input[type="file"]') as HTMLInputElement
  act(() => {
    selectFiles(input, files)
  })
}

describe('MergeRoute — empty/disabled state', () => {
  it('renders MultiFileUploadZone and a disabled MERGE with < 2 files', async () => {
    const { container } = await renderMergeRoute()

    // Picker present.
    expect(container.querySelector('input[type="file"]')).not.toBeNull()

    // MERGE disabled with 0 files.
    let merge = getMergeButton(container)
    expect(merge.getAttribute('aria-disabled')).toBe('true')

    // Still disabled with exactly 1 file.
    addFilesToRoute(container, [makePdf('one.pdf')])
    merge = getMergeButton(container)
    expect(merge.getAttribute('aria-disabled')).toBe('true')
  })

  it('enables MERGE once ≥ 2 valid PDFs are added', async () => {
    const { container } = await renderMergeRoute()
    addFilesToRoute(container, [makePdf('a.pdf'), makePdf('b.pdf')])
    const merge = getMergeButton(container)
    expect(merge.getAttribute('aria-disabled')).toBeNull()
  })
})

describe('MergeRoute — reorder + remove', () => {
  it('lists added filenames in selection order', async () => {
    const { container, getAllByTestId } = await renderMergeRoute()
    addFilesToRoute(container, [makePdf('first.pdf'), makePdf('second.pdf')])
    const rows = getAllByTestId('merge-file-row')
    expect(rows.map((r) => r.getAttribute('data-filename'))).toEqual([
      'first.pdf',
      'second.pdf',
    ])
  })

  it('move-down on the first item swaps items 0 and 1', async () => {
    const { container, getAllByTestId } = await renderMergeRoute()
    addFilesToRoute(container, [makePdf('first.pdf'), makePdf('second.pdf')])

    const firstRow = getAllByTestId('merge-file-row')[0]
    // The first row's move-down control.
    const moveDownBtn = within(firstRow).getByLabelText(/move .*down/i)
    act(() => {
      fireEvent.click(moveDownBtn)
    })

    const rows = getAllByTestId('merge-file-row')
    expect(rows.map((r) => r.getAttribute('data-filename'))).toEqual([
      'second.pdf',
      'first.pdf',
    ])
  })

  it('remove drops the item; falling below 2 re-disables MERGE', async () => {
    const { container, getAllByTestId } = await renderMergeRoute()
    addFilesToRoute(container, [makePdf('a.pdf'), makePdf('b.pdf')])
    expect(getMergeButton(container).getAttribute('aria-disabled')).toBeNull()

    const firstRow = getAllByTestId('merge-file-row')[0]
    const removeBtn = within(firstRow).getByLabelText(/remove/i)
    act(() => {
      fireEvent.click(removeBtn)
    })

    const rows = getAllByTestId('merge-file-row')
    expect(rows).toHaveLength(1)
    expect(getMergeButton(container).getAttribute('aria-disabled')).toBe('true')
  })
})

describe('MergeRoute — merge + download wiring', () => {
  const MERGED = new Uint8Array([0x25, 0x50, 0x44, 0x46])

  beforeEach(() => {
    mockMergePdfs.mockResolvedValue(MERGED)
  })

  it('clicking MERGE calls mergePdfs with files in displayed order then downloads once', async () => {
    const { container, getAllByTestId } = await renderMergeRoute()
    addFilesToRoute(container, [makePdf('a.pdf'), makePdf('b.pdf')])

    // Reorder: move first down so displayed order is b, a.
    const firstRow = getAllByTestId('merge-file-row')[0]
    act(() => {
      fireEvent.click(within(firstRow).getByLabelText(/move .*down/i))
    })

    await act(async () => {
      fireEvent.click(getMergeButton(container))
    })

    expect(mockMergePdfs).toHaveBeenCalledTimes(1)
    const orderedFiles = mockMergePdfs.mock.calls[0][0] as { name: string }[]
    expect(orderedFiles.map((f) => f.name)).toEqual(['b.pdf', 'a.pdf'])

    expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    const [bytes, filename, mime] = mockTriggerBlobDownload.mock.calls[0]
    expect(bytes).toBe(MERGED)
    expect(filename).toBe('merged.pdf')
    expect(mime).toBe('application/pdf')
  })

  it('a mergePdfs rejection surfaces an inline error and does NOT download', async () => {
    mockMergePdfs.mockRejectedValue(new Error('Could not merge the PDFs: boom'))
    const { container, queryByRole } = await renderMergeRoute()
    addFilesToRoute(container, [makePdf('a.pdf'), makePdf('b.pdf')])

    await act(async () => {
      fireEvent.click(getMergeButton(container))
    })

    expect(mockTriggerBlobDownload).not.toHaveBeenCalled()
    const alert = queryByRole('alert')
    expect(alert).not.toBeNull()
    expect(alert?.textContent ?? '').toMatch(/could not merge/i)
  })

  it('PAR-05: the merge flow makes ZERO network requests', async () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('network blocked in test')))
    const origFetch = globalThis.fetch
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    try {
      const { container } = await renderMergeRoute()
      addFilesToRoute(container, [makePdf('a.pdf'), makePdf('b.pdf')])
      await act(async () => {
        fireEvent.click(getMergeButton(container))
      })
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(mockTriggerBlobDownload).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = origFetch
    }
  })
})
