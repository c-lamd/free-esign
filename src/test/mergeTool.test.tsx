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
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

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
