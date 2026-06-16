/**
 * DocumentViewer component tests — DOC-03 unit/component coverage.
 *
 * Tests verify that numPages from react-pdf's onLoadSuccess drives the
 * LazyPage array length, and that LazyPage renders correctly.
 *
 * jsdom lacks IntersectionObserver and ResizeObserver — both are mocked
 * globally. react-pdf is mocked so tests don't need a real PDF or worker.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import React from 'react'

// ── Pending callback for the Document mock ────────────────────────────────────
// Module-level so vi.mock() factory closure can write to it during render,
// and tests can call it inside act() to trigger numPages state updates.
let _pendingOnLoadSuccess: ((pdf: { numPages: number }) => void) | null = null

// ── Mock react-pdf (hoisted above imports by vi.mock) ─────────────────────────
// <Document> stores its onLoadSuccess callback so tests can trigger it inside
// act() to avoid the "setState during render" React warning.
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
    // Store the callback so tests can trigger it at the right time
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
  }) =>
    React.createElement('div', {
      'data-testid': `pdf-page-${pageNumber}`,
      // NOTE: no data-page-number here — only LazyPage wrapper sets it,
      // so querySelectorAll('[data-page-number]') counts wrappers only.
    })

  return { Document, Page }
})

// ── Mock pdfWorker (no real worker in tests) ──────────────────────────────────
vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: {
    cMapUrl: '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/standard_fonts/',
  },
}))

// ── IntersectionObserver mock ─────────────────────────────────────────────────
// Stores observe calls; tests call triggerIntersection() to fire the callback.
let _intersectionCallbacks: Array<{
  cb: IntersectionObserverCallback
  el: Element
  observer: IntersectionObserver
}> = []

class MockIntersectionObserver {
  private cb: IntersectionObserverCallback
  constructor(cb: IntersectionObserverCallback) {
    this.cb = cb
  }
  observe(el: Element) {
    _intersectionCallbacks.push({ cb: this.cb, el, observer: this as unknown as IntersectionObserver })
  }
  unobserve() {}
  disconnect() {
    _intersectionCallbacks = []
  }
}

function triggerAllIntersections() {
  _intersectionCallbacks.forEach(({ cb, el, observer }) => {
    cb(
      [{ isIntersecting: true, intersectionRatio: 1, target: el } as IntersectionObserverEntry],
      observer,
    )
  })
}

// ── ResizeObserver mock ───────────────────────────────────────────────────────
// Fires immediately with fixed 800px width so containerWidth is set.
class MockResizeObserver {
  private cb: ResizeObserverCallback
  constructor(cb: ResizeObserverCallback) {
    this.cb = cb
  }
  observe(el: Element) {
    this.cb(
      [
        {
          target: el,
          contentRect: { width: 800, height: 600 } as DOMRectReadOnly,
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver,
    )
  }
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  global.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

beforeEach(() => {
  _intersectionCallbacks = []
  _pendingOnLoadSuccess = null
})

afterEach(() => {
  cleanup()
})

// ── Store reset helper ────────────────────────────────────────────────────────
async function resetStore(docUrl: string, numPages: number | null = null) {
  const { useDocumentStore } = await import('../store/documentStore')
  useDocumentStore.setState({
    view: 'loaded',
    docUrl,
    numPages,
    currentPage: 1,
    errorMessage: null,
  })
}

// ── Helper: render DocumentViewer and fire onLoadSuccess synchronously ────────
async function renderViewerWithPages(docUrl: string, numPages: number) {
  await resetStore(docUrl, numPages)

  const { DocumentViewer } = await import('../components/DocumentViewer')

  let container!: Element
  await act(async () => {
    const result = render(React.createElement(DocumentViewer))
    container = result.container
    // Fire onLoadSuccess to update store numPages (triggers re-render with page list)
    if (_pendingOnLoadSuccess) {
      _pendingOnLoadSuccess({ numPages })
    }
  })

  return container
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('DocumentViewer', () => {
  it('renders 5 LazyPage wrappers when numPages = 5', async () => {
    const container = await renderViewerWithPages('blob:fake-5', 5)

    const pageEls = container.querySelectorAll('[data-page-number]')
    expect(pageEls.length).toBe(5)
  })

  it('renders 1 LazyPage wrapper for a single-page document', async () => {
    const container = await renderViewerWithPages('blob:fake-1', 1)

    const pageEls = container.querySelectorAll('[data-page-number]')
    expect(pageEls.length).toBe(1)
  })

  it('renders nothing when docUrl is null', async () => {
    await resetStore('blob:fake-null', 3)

    const { useDocumentStore } = await import('../store/documentStore')
    useDocumentStore.setState({ docUrl: null })

    const { DocumentViewer } = await import('../components/DocumentViewer')

    let container!: Element
    await act(async () => {
      const result = render(React.createElement(DocumentViewer))
      container = result.container
    })

    expect(container.querySelector('[data-testid="pdf-document"]')).toBeNull()
  })

  it('page wrappers carry sequential data-page-number values starting from 1', async () => {
    const container = await renderViewerWithPages('blob:fake-3', 3)

    const pageEls = container.querySelectorAll<HTMLElement>('[data-page-number]')
    const pageNumbers = Array.from(pageEls).map((el) =>
      parseInt(el.dataset.pageNumber ?? '0', 10),
    )
    expect(pageNumbers).toEqual([1, 2, 3])
  })
})

describe('LazyPage', () => {
  it('renders the page content after IntersectionObserver fires', async () => {
    const { LazyPage } = await import('../components/LazyPage')

    let container!: Element
    // First act: render the component (effect registers observer)
    await act(async () => {
      const result = render(
        React.createElement(LazyPage, { pageNumber: 2, containerWidth: 800 }),
      )
      container = result.container
    })

    // Second act: trigger intersection (state update → re-render with Page)
    await act(async () => {
      triggerAllIntersections()
    })

    // After intersection, LazyPage renders the mock Page (data-testid="pdf-page-2")
    expect(container.querySelector('[data-testid="pdf-page-2"]')).not.toBeNull()
  })

  it('sets data-page-number on the outer wrapper div', async () => {
    const { LazyPage } = await import('../components/LazyPage')

    let container!: Element
    await act(async () => {
      const result = render(
        React.createElement(LazyPage, { pageNumber: 7, containerWidth: 600 }),
      )
      container = result.container
    })

    expect(container.querySelector('[data-page-number="7"]')).not.toBeNull()
  })
})
