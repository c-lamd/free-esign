/**
 * incrementWiring.test.tsx — Phase 13 CNT-03: exactly one recordExport() per
 * successful export across both funnels.
 *
 * Unlike the existing tool tests (which mock `toolDownload` itself and therefore
 * never exercise the real increment hook), these tests mock `../lib/counter` so
 * `recordExport` is a spy and run the REAL call-sites:
 *   1. triggerBlobDownload — the single funnel for the 5 tools (merge / split —
 *      range + each-page-zip / organize / pdf-to-image — single + zip /
 *      image-to-pdf). One invocation = one increment.
 *   2. TopBar.handleDownload — the signing-export call-site. One increment on
 *      success; none on failure or guarded early-return.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// ── Mock the counter so recordExport is a spy (the key difference from the tool
//    tests, which mock toolDownload and skip the real hook entirely). ───────────
const mockRecordExport = vi.fn()
vi.mock('../lib/counter', () => ({
  recordExport: () => mockRecordExport(),
  fetchCount: vi.fn().mockResolvedValue(null),
}))

// ── Mock exportPdf for the signing funnel (mirror downloadWiring.test.ts). ──────
const mockExportSignedPdf = vi.fn()
const mockTriggerDownload = vi.fn()
const mockSignedFilename = vi.fn((name: string) => {
  const lastDot = name.lastIndexOf('.')
  const base = lastDot !== -1 ? name.slice(0, lastDot) : name
  return `${base}-signed.pdf`
})
vi.mock('../lib/exportPdf', () => ({
  exportSignedPdf: mockExportSignedPdf,
  triggerDownload: mockTriggerDownload,
  signedFilename: mockSignedFilename,
}))

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

// ── Tool funnel — triggerBlobDownload fires exactly one increment ──────────────

describe('triggerBlobDownload → recordExport (5 tools, CNT-03)', () => {
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // jsdom anchor click is a no-op; stub the platform bits the success path uses.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => {})
  })

  it('fires recordExport exactly once for a single-PDF export (merge/organize/image-to-pdf/pdf-to-image-single)', async () => {
    const { triggerBlobDownload } = await import('../lib/toolDownload')
    triggerBlobDownload(new Uint8Array([0x25, 0x50, 0x44, 0x46]), 'merged.pdf', 'application/pdf')
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(mockRecordExport).toHaveBeenCalledTimes(1)
  })

  it('fires recordExport exactly once for a zip export (split-each / pdf-to-image-zip)', async () => {
    const { triggerBlobDownload } = await import('../lib/toolDownload')
    triggerBlobDownload(new Uint8Array([1, 2, 3]), 'pages.zip', 'application/zip')
    expect(mockRecordExport).toHaveBeenCalledTimes(1)
  })

  it('fires once per export action — two exports increment twice (not once, not double-per-call)', async () => {
    const { triggerBlobDownload } = await import('../lib/toolDownload')
    triggerBlobDownload(new Uint8Array([1]), 'a.pdf', 'application/pdf')
    triggerBlobDownload(new Uint8Array([2]), 'b.zip', 'application/zip')
    expect(mockRecordExport).toHaveBeenCalledTimes(2)
  })
})

// ── Signing funnel — TopBar.handleDownload (mirror downloadWiring.test.ts) ───────

async function getStores() {
  const { useDocumentStore } = await import('../store/documentStore')
  const { useFieldStore } = await import('../store/fieldStore')
  return { useDocumentStore, useFieldStore }
}

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

async function renderTopBar() {
  const { TopBar } = await import('../components/TopBar')
  let container!: Element
  await act(async () => {
    container = render(React.createElement(TopBar)).container
  })
  return container
}

function exportButton(container: Element) {
  return Array.from(container.querySelectorAll('button')).find((b) =>
    b.getAttribute('aria-label')?.includes('Download PDF'),
  )
}

describe('TopBar.handleDownload → recordExport (signing, CNT-03)', () => {
  const FAKE_PDF_BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46])
  const ORIGINAL_BYTES = new ArrayBuffer(100)

  it('fires recordExport exactly once after a successful signing export', async () => {
    const { useDocumentStore, useFieldStore } = await getStores()
    useDocumentStore.getState().reset()
    useDocumentStore.getState().setFileName('report.pdf')
    useDocumentStore.getState().setOriginalPdfBytes(ORIGINAL_BYTES)
    useDocumentStore.getState().loadDocument('blob:test-url')
    useDocumentStore.getState().setNumPages(1)
    useFieldStore.getState().resetFields()
    useFieldStore.getState().addField(makeField())
    mockExportSignedPdf.mockResolvedValue(FAKE_PDF_BYTES)

    const container = await renderTopBar()
    await act(async () => {
      fireEvent.click(exportButton(container)!)
    })

    expect(mockExportSignedPdf).toHaveBeenCalledTimes(1)
    expect(mockTriggerDownload).toHaveBeenCalledTimes(1)
    expect(mockRecordExport).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire recordExport when the export fails (no double/spurious count)', async () => {
    const { useDocumentStore, useFieldStore } = await getStores()
    useDocumentStore.getState().reset()
    useDocumentStore.getState().setFileName('doc.pdf')
    useDocumentStore.getState().setOriginalPdfBytes(ORIGINAL_BYTES)
    useDocumentStore.getState().loadDocument('blob:test-url')
    useDocumentStore.getState().setNumPages(1)
    useFieldStore.getState().resetFields()
    useFieldStore.getState().addField(makeField())
    mockExportSignedPdf.mockRejectedValue(new Error('PDF engine failed'))

    const container = await renderTopBar()
    await act(async () => {
      fireEvent.click(exportButton(container)!)
    })

    expect(mockRecordExport).not.toHaveBeenCalled()
  })

  it('does NOT fire recordExport on a guarded early-return (zero fields)', async () => {
    const { useDocumentStore, useFieldStore } = await getStores()
    useDocumentStore.getState().reset()
    useDocumentStore.getState().setOriginalPdfBytes(ORIGINAL_BYTES)
    useDocumentStore.getState().loadDocument('blob:test-url')
    useDocumentStore.getState().setNumPages(1)
    useFieldStore.getState().resetFields() // zero fields

    const container = await renderTopBar()
    const btn = exportButton(container)!
    await act(async () => {
      fireEvent.click(btn)
    })

    expect(mockExportSignedPdf).not.toHaveBeenCalled()
    expect(mockRecordExport).not.toHaveBeenCalled()
  })
})
