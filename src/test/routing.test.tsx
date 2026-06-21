/**
 * routing.test.tsx — SUITE-01 router behavior (deep-link + catch-all).
 *
 * Proves, without a server, the two route guarantees:
 *   1. A deep link to /sign mounts the signing tool directly (the relocated
 *      signing experience renders under its route).
 *   2. An unknown path redirects to / (the catch-all <Navigate to="/" replace>),
 *      rendering the hub stub and NOT the signing tool.
 *
 * Uses <MemoryRouter initialEntries={[...]}> wrapping <AppRoutes> for
 * deterministic deep-link entry. The prod equivalent (real URLs resolving on
 * refresh) is guaranteed by the vercel.json SPA rewrite, asserted in
 * privacyGuard.test.ts (LND-04).
 *
 * Heavy signing deps (react-pdf, pdfWorker, idb-keyval) are mocked exactly as in
 * uploadFlow.test.tsx so SignRoute mounts cleanly in jsdom.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import React from 'react'

vi.mock('react-pdf', () => {
  const Document = ({ children }: { children?: React.ReactNode }) =>
    React.createElement('div', { 'data-testid': 'pdf-document' }, children)
  const Page = ({ pageNumber }: { pageNumber: number }) =>
    React.createElement('div', { 'data-testid': `pdf-page-${pageNumber}` })
  return { Document, Page }
})

vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: { cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' },
}))

vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

// DocumentViewer uses these observers; jsdom lacks them.
class MockIntersectionObserver {
  constructor(_cb: IntersectionObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}
class MockResizeObserver {
  constructor(_cb: ResizeObserverCallback) {}
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  global.IntersectionObserver = MockIntersectionObserver as unknown as typeof IntersectionObserver
  global.ResizeObserver = MockResizeObserver as unknown as typeof ResizeObserver
})

beforeEach(async () => {
  // Reset the document store to its construction-time landing default so the
  // SignRoute mount effect runs (landing → empty) on each render.
  const { useDocumentStore } = await import('../store/documentStore')
  act(() => {
    useDocumentStore.getState().goToLanding()
  })
})

afterEach(() => {
  cleanup()
})

async function renderAt(path: string) {
  const { AppRoutes } = await import('../App')
  let container!: HTMLElement
  await act(async () => {
    container = render(
      React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(AppRoutes)),
    ).container
  })
  return container
}

describe('SUITE-01: routing', () => {
  it('deep-link to /sign mounts the signing tool directly', async () => {
    const container = await renderAt('/sign')
    // The signing TopBar's back-to-home button is unique to the signing tool.
    const signingHeaderBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'free·esign — return to home',
    )
    expect(signingHeaderBtn, 'signing TopBar should be present at /sign').not.toBeNull()
    // And the hub stub must NOT be rendered.
    expect(container.querySelector('[data-testid="hub-stub"]')).toBeNull()
  })

  it('deep-link to /sign renders the founder-voice hero (reachable under /sign)', async () => {
    const container = await renderAt('/sign')
    // HeroSection's h1 founder-voice copy is the /sign empty-state landing content.
    expect(container.textContent).toContain(
      "I built this because I couldn't find a PDF signer that was actually free.",
    )
  })

  it('unknown path redirects to / (catch-all → hub stub, not the signing tool)', async () => {
    const container = await renderAt('/does-not-exist')
    // Catch-all <Navigate to="/" replace> lands on the hub stub.
    expect(container.querySelector('[data-testid="hub-stub"]')).not.toBeNull()
    // The signing tool must NOT render for an unknown path.
    const signingHeaderBtn = Array.from(container.querySelectorAll('button')).find(
      (b) => b.getAttribute('aria-label') === 'free·esign — return to home',
    )
    expect(signingHeaderBtn, 'signing tool must not render on an unknown path').toBeUndefined()
  })

  it('root path / renders the hub stub', async () => {
    const container = await renderAt('/')
    expect(container.querySelector('[data-testid="hub-stub"]')).not.toBeNull()
  })
})
