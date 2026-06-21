/**
 * vestaboard.test.tsx — SUITE-02 vestaboard hero placeholder shell (Phase 10).
 *
 * The Vestaboard is the hero centerpiece of the tools-hub homepage. This phase
 * ships a STATIC/placeholder split-flap shell — no live data, no network. Phase
 * 13 wires it to /api/count. These tests pin the static contract:
 *   - default render shows a placeholder (em-dash cells) + a documents-processed label
 *   - a given `value` renders one flap cell per character
 *   - the component performs ZERO network requests on render (T-10-04 fetch-spy)
 *   - it has an accessible name conveying "documents processed"
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { Vestaboard } from '../components/Vestaboard'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SUITE-02: Vestaboard hero placeholder shell', () => {
  it('renders a documents-processed accessible label by default', () => {
    const { getByLabelText } = render(<Vestaboard />)
    // The hero reads as the documents-processed counter even while static.
    expect(getByLabelText(/documents processed/i)).toBeTruthy()
  })

  it('renders placeholder em-dash cells when no value is supplied', () => {
    const { container } = render(<Vestaboard />)
    const cells = container.querySelectorAll('[data-flap-cell]')
    expect(cells.length).toBeGreaterThan(0)
    // Every default cell is a neutral placeholder em-dash.
    for (const cell of Array.from(cells)) {
      expect(cell.textContent).toBe('—')
    }
  })

  it('renders one flap cell per character of a given value', () => {
    const { container } = render(<Vestaboard value="12345" />)
    const cells = container.querySelectorAll('[data-flap-cell]')
    expect(cells.length).toBe(5)
    expect(Array.from(cells).map((c) => c.textContent).join('')).toBe('12345')
  })

  it('accepts a numeric value and renders one cell per digit', () => {
    const { container } = render(<Vestaboard value={42} />)
    const cells = container.querySelectorAll('[data-flap-cell]')
    expect(cells.length).toBe(2)
    expect(Array.from(cells).map((c) => c.textContent).join('')).toBe('42')
  })

  it('respects a custom label prop', () => {
    const { getByLabelText } = render(<Vestaboard label="SIGNATURES PLACED" />)
    expect(getByLabelText(/signatures placed/i)).toBeTruthy()
  })

  it('makes ZERO network requests on render (T-10-04)', () => {
    const fetchSpy = vi.fn()
    // Install a spy regardless of whether fetch exists in the test env.
    vi.stubGlobal('fetch', fetchSpy)
    render(<Vestaboard value="100" />)
    expect(fetchSpy).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
