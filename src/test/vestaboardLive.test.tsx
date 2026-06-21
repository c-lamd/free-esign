/**
 * vestaboardLive.test.tsx — Phase 13 live wiring of the Vestaboard hero (CNT-02/CNT-04).
 *
 * Phase 10 shipped a static shell; this phase makes the number real. The board now
 * calls fetchCount() once on mount and:
 *   - renders the resolved number's digits (one flap cell per digit) with a flip
 *     animation when a number comes back (CNT-02), and
 *   - keeps the neutral em-dash placeholder on null / unreachable — never an error,
 *     the page stays fully usable (CNT-04).
 *
 * The optional `value` prop still wins as a static override (preserves the Phase 10
 * value-prop + zero-network contract).
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

// Mock the counter module so we control fetchCount without touching the network.
const mockFetchCount = vi.fn()
vi.mock('../lib/counter', () => ({
  fetchCount: () => mockFetchCount(),
  recordExport: vi.fn(),
}))

import { Vestaboard } from '../components/Vestaboard'

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('Vestaboard live wiring (CNT-02 / CNT-04)', () => {
  beforeEach(() => {
    mockFetchCount.mockReset()
  })

  it('calls fetchCount() exactly once on mount', async () => {
    mockFetchCount.mockResolvedValue(7)
    render(<Vestaboard />)
    await waitFor(() => expect(mockFetchCount).toHaveBeenCalledTimes(1))
  })

  it('renders the resolved number — one flap cell per digit', async () => {
    mockFetchCount.mockResolvedValue(1234)
    const { container } = render(<Vestaboard />)
    await waitFor(() => {
      const cells = container.querySelectorAll('[data-flap-cell]')
      expect(Array.from(cells).map((c) => c.textContent).join('')).toBe('1234')
    })
  })

  it('reflects the real number in the accessible name once resolved', async () => {
    mockFetchCount.mockResolvedValue(42)
    const { getByLabelText } = render(<Vestaboard />)
    await waitFor(() => expect(getByLabelText(/documents processed: 42/i)).toBeTruthy())
  })

  it('shows the em-dash placeholder when fetchCount resolves null (CNT-04)', async () => {
    mockFetchCount.mockResolvedValue(null)
    const { container } = render(<Vestaboard />)
    // Give the effect a chance to settle, then assert the placeholder persists.
    await waitFor(() => expect(mockFetchCount).toHaveBeenCalled())
    const cells = container.querySelectorAll('[data-flap-cell]')
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of Array.from(cells)) {
      expect(cell.textContent).toBe('—')
    }
  })

  it('shows the placeholder while the fetch is still pending (never an error)', async () => {
    // A never-resolving fetch — the placeholder must hold.
    mockFetchCount.mockReturnValue(new Promise<number | null>(() => {}))
    const { container } = render(<Vestaboard />)
    const cells = container.querySelectorAll('[data-flap-cell]')
    expect(cells.length).toBeGreaterThan(0)
    for (const cell of Array.from(cells)) {
      expect(cell.textContent).toBe('—')
    }
  })

  it('applies a digit-flip animation to the flap cells when a number renders', async () => {
    mockFetchCount.mockResolvedValue(9)
    const { container } = render(<Vestaboard />)
    await waitFor(() => {
      const cell = container.querySelector('[data-flap-cell]') as HTMLElement
      expect(cell.textContent).toBe('9')
      // The cell carries an animation/transition hook so a changed digit visibly flips.
      const style = cell.getAttribute('style') ?? ''
      expect(/animation|transition/i.test(style)).toBe(true)
    })
  })

  it('does NOT fetch when an explicit value prop is supplied (static override)', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const { container } = render(<Vestaboard value="100" />)
    // value wins; fetchCount must not be invoked at all.
    expect(mockFetchCount).not.toHaveBeenCalled()
    expect(fetchSpy).not.toHaveBeenCalled()
    const cells = container.querySelectorAll('[data-flap-cell]')
    expect(Array.from(cells).map((c) => c.textContent).join('')).toBe('100')
    vi.unstubAllGlobals()
  })
})
