/**
 * wordmark.test.tsx — FND-03 component structure + TopBar aria-label tests.
 *
 * Tests:
 *   1. <Wordmark /> renders a .wm-mark element (engraved square mark present)
 *   2. Rendered text contains 'free' and 'esign'
 *   3. Middot is the Unicode middot U+00B7 (· not a hyphen, bullet, or period)
 *   4. Component does NOT render 'FreeESign' (old capitalization)
 *   5. TopBar ghost button aria-label is "free·esign — return to home"
 *
 * TDD: This file is Wave-0 RED — Wordmark.tsx does not exist yet; TopBar aria-label
 * still says "FreeESign". Goes GREEN after Tasks 2–3.
 *
 * Plan 06-02, Task 1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'
import React from 'react'

// ── Mock exportPdf module (same as downloadWiring.test.ts, required by TopBar) ──
vi.mock('../lib/exportPdf', () => ({
  exportSignedPdf: vi.fn(),
  triggerDownload: vi.fn(),
  signedFilename: vi.fn((name: string) => {
    const lastDot = name.lastIndexOf('.')
    const base = lastDot !== -1 ? name.slice(0, lastDot) : name
    return `${base}-signed.pdf`
  }),
}))

// ── Reset stores between tests ────────────────────────────────────────────────

beforeEach(async () => {
  cleanup()
  const { useDocumentStore } = await import('../store/documentStore')
  useDocumentStore.getState().goToLanding()
})

// ── FND-03: Wordmark component structure ──────────────────────────────────────

describe('FND-03: Wordmark component', () => {
  it('renders the .wm-mark element (engraved square mark is present)', async () => {
    const { Wordmark } = await import('../components/Wordmark')
    await act(async () => {
      render(React.createElement(Wordmark))
    })
    expect(document.querySelector('.wm-mark')).toBeTruthy()
  })

  it('renders brand text containing "free" and "esign"', async () => {
    const { Wordmark } = await import('../components/Wordmark')
    let container!: HTMLElement
    await act(async () => {
      const result = render(React.createElement(Wordmark))
      container = result.container
    })
    expect(container.textContent).toContain('free')
    expect(container.textContent).toContain('esign')
  })

  it('renders the middot as Unicode U+00B7 (· not a hyphen, bullet, or period)', async () => {
    const { Wordmark } = await import('../components/Wordmark')
    let container!: HTMLElement
    await act(async () => {
      const result = render(React.createElement(Wordmark))
      container = result.container
    })
    // U+00B7 MIDDLE DOT — must be this exact character, not '-', '•', or '.'
    expect(container.textContent).toContain('·')
  })

  it('does NOT render "FreeESign" (old capitalization must be absent)', async () => {
    const { Wordmark } = await import('../components/Wordmark')
    let container!: HTMLElement
    await act(async () => {
      const result = render(React.createElement(Wordmark))
      container = result.container
    })
    expect(container.textContent).not.toMatch(/FreeESign/)
  })
})

// ── FND-03: TopBar wordmark adoption + updated aria-label ─────────────────────

describe('FND-03: TopBar wordmark adoption', () => {
  it('TopBar ghost button aria-label is "free·esign — return to home"', async () => {
    const { TopBar } = await import('../components/TopBar')
    await act(async () => {
      render(React.createElement(TopBar))
    })
    // The accessible name must use the new lowercase brand with U+00B7 middot and em dash
    expect(
      screen.getByRole('button', { name: 'free·esign — return to home' }),
    ).toBeInTheDocument()
  })
})
