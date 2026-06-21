/**
 * Upload-flow regression test — the core signing loop (upload → render).
 *
 * Guards against the perpetual-loading deadlock that shipped in v1.0:
 * `loadDocument()` must transition to a view that MOUNTS <DocumentViewer>,
 * because DocumentViewer owns the react-pdf <Document> whose `onLoadSuccess`
 * is the ONLY transition into 'loaded' (via setNumPages). If loadDocument
 * routes through a standalone top-level 'loading' view, App renders a bare
 * <LoadingSpinner>, <Document> never mounts, onLoadSuccess never fires, and
 * the spinner hangs forever for every uploaded PDF.
 *
 * Why this wasn't caught before: every DocumentViewer test force-set
 * `view: 'loaded'` directly, bypassing the App view-router. This test renders
 * the REAL <App> and drives the store the way UploadZone does.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

// react-pdf <Document> mock: captures onLoadSuccess and renders a probe node.
let _pendingOnLoadSuccess: ((pdf: { numPages: number }) => void) | null = null

vi.mock('react-pdf', () => {
  const Document = ({
    onLoadSuccess,
    children,
  }: {
    file?: string
    options?: unknown
    onLoadSuccess?: (pdf: { numPages: number }) => void
    onLoadError?: (err: Error) => void
    loading?: React.ReactNode
    children?: React.ReactNode
  }) => {
    _pendingOnLoadSuccess = onLoadSuccess ?? null
    return React.createElement('div', { 'data-testid': 'pdf-document' }, children)
  }
  const Page = ({
    pageNumber,
  }: {
    pageNumber: number
    width?: number
    renderTextLayer?: boolean
    renderAnnotationLayer?: boolean
  }) => React.createElement('div', { 'data-testid': `pdf-page-${pageNumber}` })
  return { Document, Page }
})

// No real worker in tests; DocumentViewer imports pdfOptions from here.
vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: { cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' },
}))

// Keep App's on-mount loadSavedItems() (idb-keyval) deterministic in jsdom.
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

// jsdom lacks IntersectionObserver / ResizeObserver — DocumentViewer uses both.
class MockIntersectionObserver {
  constructor(_cb: IntersectionObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
class MockResizeObserver {
  private cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }
  observe(el: Element) {
    this.cb(
      [{ target: el, contentRect: { width: 800, height: 600 } as DOMRectReadOnly } as ResizeObserverEntry],
      this as unknown as ResizeObserver,
    )
  }
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

beforeEach(() => {
  _pendingOnLoadSuccess = null
})

afterEach(() => {
  cleanup()
})

describe('upload flow (core signing loop)', () => {
  it('loadDocument mounts the document viewer instead of hanging on a spinner', async () => {
    const { useDocumentStore } = await import('../store/documentStore')
    // Top-level nav moved from the view store to routes per SUITE-01: the signing
    // tool now mounts under the /sign route (SignRoute), not via view==='empty' at
    // the app root. Drive the REAL route table at /sign so SignRoute's own view
    // machine runs — the deadlock assertion below is unchanged.
    const { AppRoutes } = await import('../App')

    // User has entered the signing tool (not the hub). SignRoute's mount effect
    // transitions landing → empty; set empty explicitly so the uploader is live.
    act(() => {
      useDocumentStore.setState({ view: 'empty', docUrl: null, numPages: null, errorMessage: null })
    })

    let container!: HTMLElement
    await act(async () => {
      container = render(
        React.createElement(
          MemoryRouter,
          { initialEntries: ['/sign'] },
          React.createElement(AppRoutes),
        ),
      ).container
    })

    // Simulate UploadZone ingesting a valid PDF.
    await act(async () => {
      useDocumentStore.getState().loadDocument('blob:test-pdf')
    })

    // DocumentViewer must now be mounted (its react-pdf <Document> is in the tree).
    // With the deadlock bug (loadDocument → 'loading'), App renders only the bare
    // <LoadingSpinner> and this probe is absent.
    expect(container.querySelector('[data-testid="pdf-document"]')).not.toBeNull()

    // Completing the parse drives the rest of the loop: 'loaded' + pages render.
    await act(async () => {
      _pendingOnLoadSuccess?.({ numPages: 2 })
    })
    expect(useDocumentStore.getState().view).toBe('loaded')
    expect(useDocumentStore.getState().numPages).toBe(2)
    expect(container.querySelectorAll('[data-page-number]').length).toBe(2)
  })
})
