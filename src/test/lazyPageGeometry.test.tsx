/**
 * lazyPageGeometry.test.tsx
 *
 * PAR-03 geometry backstop — Wave 0.
 *
 * Guards the invariant that LazyPage's outer wrapper div has:
 *   - position: relative   (required for react-rnd bounds="parent")
 *   - zero padding         (any padding shifts the bounds="parent" overlay origin)
 *   - zero border-width    (any border shifts the bounds="parent" overlay origin)
 *
 * This test MUST pass before Task 2 (documents the pre-restyle invariant) and
 * MUST still pass after Task 2 (fails immediately if registration-mark framing
 * accidentally adds padding or border to the wrapper).
 *
 * Mocks mirror documentViewer.test.ts — same react-pdf, pdfWorker, IntersectionObserver,
 * and ResizeObserver setup so this test file is self-contained.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import React from 'react'

// ── Mock react-pdf ─────────────────────────────────────────────────────────────
vi.mock('react-pdf', () => {
  const Document = ({
    children,
  }: {
    file?: string
    options?: unknown
    onLoadSuccess?: (pdf: { numPages: number }) => void
    onLoadError?: (err: Error) => void
    loading?: React.ReactNode
    children?: React.ReactNode
  }) => React.createElement('div', { 'data-testid': 'pdf-document' }, children)

  const Page = ({
    pageNumber,
  }: {
    pageNumber: number
    width?: number
    renderTextLayer?: boolean
    renderAnnotationLayer?: boolean
    onLoadSuccess?: (page: unknown) => void
  }) =>
    React.createElement('div', {
      'data-testid': `pdf-page-${pageNumber}`,
    })

  return { Document, Page }
})

// ── Mock pdfWorker ─────────────────────────────────────────────────────────────
vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: {
    cMapUrl: '/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/standard_fonts/',
  },
}))

// ── IntersectionObserver mock ──────────────────────────────────────────────────
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

// ── ResizeObserver mock ────────────────────────────────────────────────────────
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
})

afterEach(() => {
  cleanup()
})

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('LazyPage geometry invariant (PAR-03 backstop)', () => {
  it('outer wrapper has position:relative with zero padding and zero border (react-rnd bounds="parent" invariant)', async () => {
    const { LazyPage } = await import('../components/LazyPage')

    let container!: HTMLElement
    await act(async () => {
      const result = render(
        React.createElement(LazyPage, { pageNumber: 1, containerWidth: 800 }),
      )
      container = result.container
    })

    // The outer wrapper is the first element child of the test container
    const wrapper = container.firstElementChild as HTMLElement
    expect(wrapper).not.toBeNull()

    const style = getComputedStyle(wrapper)

    // Must be position:relative so react-rnd bounds="parent" overlay (inset:0)
    // resolves against this element, not a distant ancestor.
    expect(style.position).toBe('relative')

    // Must have zero padding — any padding shifts the inset:0 overlay origin,
    // causing placed fields to land at incorrect PDF coordinates on export.
    // jsdom returns '0' (not '0px') for unset numeric properties, so we check both.
    const zeroOrZeroPx = (v: string) => v === '0px' || v === '0'
    expect(zeroOrZeroPx(style.paddingTop), `paddingTop='${style.paddingTop}'`).toBe(true)
    expect(zeroOrZeroPx(style.paddingRight), `paddingRight='${style.paddingRight}'`).toBe(true)
    expect(zeroOrZeroPx(style.paddingBottom), `paddingBottom='${style.paddingBottom}'`).toBe(true)
    expect(zeroOrZeroPx(style.paddingLeft), `paddingLeft='${style.paddingLeft}'`).toBe(true)

    // Must have no visible border — any border shifts the inset:0 overlay origin.
    // jsdom returns 'medium' for border-width when border-style is 'none'
    // (the CSS spec default), so we check border-style rather than border-width.
    // When border-style is 'none' the rendered border is zero regardless of width.
    const noneOrEmpty = (v: string) => v === 'none' || v === ''
    expect(noneOrEmpty(style.borderTopStyle), `borderTopStyle='${style.borderTopStyle}'`).toBe(true)
    expect(noneOrEmpty(style.borderRightStyle), `borderRightStyle='${style.borderRightStyle}'`).toBe(true)
    expect(noneOrEmpty(style.borderBottomStyle), `borderBottomStyle='${style.borderBottomStyle}'`).toBe(true)
    expect(noneOrEmpty(style.borderLeftStyle), `borderLeftStyle='${style.borderLeftStyle}'`).toBe(true)
  })
})
