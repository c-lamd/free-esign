/**
 * downloadWiring.test.ts — Unit tests for the Download PDF button wiring (EXP-01).
 *
 * Tests:
 *   1. With zero fields placed: Download PDF has aria-disabled="true" and clicking
 *      does NOT call exportSignedPdf (T-02-10 handler guard).
 *   2. With ≥1 field + originalPdfBytes: clicking calls exportSignedPdf and
 *      triggerDownload with signedFilename(fileName) — verifies the filename
 *      argument (e.g. 'report.pdf' → 'report-signed.pdf').
 *   3. When exportSignedPdf rejects: setExportError is called with the exact
 *      export-failure copy from the UI-SPEC Copywriting Contract.
 *
 * Plan 02-04 Task 2.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// ── Mock exportPdf module ─────────────────────────────────────────────────────
// Control exportSignedPdf and triggerDownload from tests.
const mockExportSignedPdf = vi.fn()
const mockTriggerDownload = vi.fn()
const mockSignedFilename = vi.fn((name: string) => {
  // replicate real signedFilename logic
  const lastDot = name.lastIndexOf('.')
  const base = lastDot !== -1 ? name.slice(0, lastDot) : name
  return `${base}-signed.pdf`
})

vi.mock('../lib/exportPdf', () => ({
  exportSignedPdf: mockExportSignedPdf,
  triggerDownload: mockTriggerDownload,
  signedFilename: mockSignedFilename,
}))

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Renders TopBar and waits for it to settle. Returns the container. */
async function renderTopBar() {
  const { TopBar } = await import('../components/TopBar')
  let container!: Element
  await act(async () => {
    const result = render(React.createElement(TopBar))
    container = result.container
  })
  return container
}

/** Resolves the Zustand stores (dynamic import to avoid stale module cache). */
async function getStores() {
  const { useDocumentStore } = await import('../store/documentStore')
  const { useFieldStore } = await import('../store/fieldStore')
  return { useDocumentStore, useFieldStore }
}

/** Build a minimal valid PlacedField for testing. */
function makeField(id = 'field-1') {
  return {
    id,
    type: 'signature' as const,
    pageNumber: 1,
    pdfX: 100,
    pdfY: 200,
    pdfWidth: 180,
    pdfHeight: 60,
    dataUrl: 'data:image/png;base64,AAAA',
  }
}

// ── Tear-down ─────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Download PDF button — zero fields (T-02-10 disabled guard)', () => {
  beforeEach(async () => {
    const { useDocumentStore, useFieldStore } = await getStores()
    // Put the app in loaded state with no fields
    useDocumentStore.getState().reset()
    useDocumentStore.getState().loadDocument('blob:test-url')
    useDocumentStore.getState().setNumPages(1)
    useFieldStore.getState().resetFields()
  })

  it('has aria-disabled="true" when zero fields are placed', async () => {
    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    expect(btn).not.toBeNull()
    expect(btn?.getAttribute('aria-disabled')).toBe('true')
  })

  it('does NOT call exportSignedPdf when clicked with zero fields', async () => {
    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    expect(btn).not.toBeNull()
    await act(async () => {
      fireEvent.click(btn!)
    })
    expect(mockExportSignedPdf).not.toHaveBeenCalled()
    expect(mockTriggerDownload).not.toHaveBeenCalled()
  })

  it('has aria-label indicating the user needs to place a signature first', async () => {
    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    expect(btn?.getAttribute('aria-label')).toContain('place at least one field first')
  })
})

describe('Download PDF button — with fields placed (EXP-01)', () => {
  let useDocumentStore: Awaited<ReturnType<typeof getStores>>['useDocumentStore']
  let useFieldStore: Awaited<ReturnType<typeof getStores>>['useFieldStore']

  const FAKE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46])
  const ORIGINAL_BYTES = new ArrayBuffer(100)

  beforeEach(async () => {
    const stores = await getStores()
    useDocumentStore = stores.useDocumentStore
    useFieldStore = stores.useFieldStore

    // Set up loaded state with a file and fields
    useDocumentStore.getState().reset()
    useDocumentStore.getState().setFileName('report.pdf')
    useDocumentStore.getState().setOriginalPdfBytes(ORIGINAL_BYTES)
    useDocumentStore.getState().loadDocument('blob:test-url')
    useDocumentStore.getState().setNumPages(1)
    useFieldStore.getState().resetFields()
    useFieldStore.getState().addField(makeField())

    // Default: exportSignedPdf resolves successfully
    mockExportSignedPdf.mockResolvedValue(FAKE_PDF_BYTES)
  })

  it('does NOT have aria-disabled when fields are placed', async () => {
    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    expect(btn).not.toBeNull()
    expect(btn?.getAttribute('aria-disabled')).toBeNull()
  })

  it('calls exportSignedPdf with originalPdfBytes and fields on click', async () => {
    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    await act(async () => {
      fireEvent.click(btn!)
    })

    expect(mockExportSignedPdf).toHaveBeenCalledTimes(1)
    const [calledBytes, calledFields] = mockExportSignedPdf.mock.calls[0]
    expect(calledBytes).toBe(ORIGINAL_BYTES)
    expect(calledFields).toHaveLength(1)
    expect(calledFields[0].id).toBe('field-1')
  })

  it('calls triggerDownload with signedFilename(fileName) — "report.pdf" → "report-signed.pdf"', async () => {
    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    await act(async () => {
      fireEvent.click(btn!)
    })

    expect(mockTriggerDownload).toHaveBeenCalledTimes(1)
    const [calledBytes, calledFilename] = mockTriggerDownload.mock.calls[0]
    expect(calledBytes).toBe(FAKE_PDF_BYTES)
    expect(calledFilename).toBe('report-signed.pdf')
  })

  it('clears exportError before attempting download', async () => {
    // Set a prior error
    useDocumentStore.getState().setExportError('old error')

    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    await act(async () => {
      fireEvent.click(btn!)
    })

    // After successful download, exportError is cleared (null)
    expect(useDocumentStore.getState().exportError).toBeNull()
  })

  it('does NOT reset the document or fields after a successful download', async () => {
    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    await act(async () => {
      fireEvent.click(btn!)
    })

    const docState = useDocumentStore.getState()
    const fieldState = useFieldStore.getState()
    // Document stays on the loaded view — not reset to empty
    expect(docState.view).toBe('loaded')
    expect(docState.fileName).toBe('report.pdf')
    // Fields remain
    expect(fieldState.fields).toHaveLength(1)
  })
})

describe('Download PDF button — export failure (T-02-02)', () => {
  let useDocumentStore: Awaited<ReturnType<typeof getStores>>['useDocumentStore']

  const ORIGINAL_BYTES = new ArrayBuffer(100)

  beforeEach(async () => {
    const stores = await getStores()
    useDocumentStore = stores.useDocumentStore
    const { useFieldStore } = stores

    useDocumentStore.getState().reset()
    useDocumentStore.getState().setFileName('doc.pdf')
    useDocumentStore.getState().setOriginalPdfBytes(ORIGINAL_BYTES)
    useDocumentStore.getState().loadDocument('blob:test-url')
    useDocumentStore.getState().setNumPages(1)
    useFieldStore.getState().resetFields()
    useFieldStore.getState().addField(makeField())

    // exportSignedPdf rejects to trigger the error path
    mockExportSignedPdf.mockRejectedValue(new Error('PDF engine failed'))
  })

  it('calls setExportError with the exact UI-SPEC copy on export failure', async () => {
    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    await act(async () => {
      fireEvent.click(btn!)
    })

    const exportError = useDocumentStore.getState().exportError
    expect(exportError).toBe(
      'Could not export the signed PDF. Try downloading again.',
    )
  })

  it('does NOT call triggerDownload when export fails', async () => {
    const container = await renderTopBar()
    const btn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.textContent?.includes('Download PDF'),
    )
    await act(async () => {
      fireEvent.click(btn!)
    })

    expect(mockTriggerDownload).not.toHaveBeenCalled()
  })
})

describe('signedFilename utility (via mock)', () => {
  it('converts "report.pdf" → "report-signed.pdf"', () => {
    expect(mockSignedFilename('report.pdf')).toBe('report-signed.pdf')
  })

  it('converts "photo.png" → "photo-signed.pdf"', () => {
    expect(mockSignedFilename('photo.png')).toBe('photo-signed.pdf')
  })

  it('converts "a.b.pdf" → "a.b-signed.pdf"', () => {
    expect(mockSignedFilename('a.b.pdf')).toBe('a.b-signed.pdf')
  })

  it('handles names without extension', () => {
    expect(mockSignedFilename('document')).toBe('document-signed.pdf')
  })
})
