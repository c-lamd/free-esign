/**
 * ZoomKnob tests — continuous zoom contract (10%–200%).
 *
 * Verifies:
 * (a) Keyboard ArrowUp steps zoom by +0.05 (ZOOM_KEY_STEP), clamped at ZOOM_MAX (2.0)
 * (b) Keyboard ArrowDown steps zoom by -0.05 (ZOOM_KEY_STEP), clamped at ZOOM_MIN (0.1)
 * (c) Home resets zoom to 1.0
 * (d) At max (2.0) ArrowUp stays at 2.0; at min (0.1) ArrowDown stays at 0.1
 * (e) Knob does NOT render when numPages is null or 0
 * (f) ARIA role/label/valuemin(10)/valuemax(200)/valuenow attributes are correct
 * (g) % readout reflects Math.round(zoom*100)
 *
 * Drag simulation is limited in jsdom (setPointerCapture not implemented).
 * Keyboard paths exercise the same setZoom code path as drag.
 * The non-negotiable assertion is: zoom stays within [ZOOM_MIN, ZOOM_MAX].
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import { useDocumentStore, ZOOM_MIN, ZOOM_MAX } from '../store/documentStore'

// ── Store reset helper ────────────────────────────────────────────────────────
function seedStore(numPages: number | null, zoom: number = 1.0) {
  useDocumentStore.setState({
    view: numPages != null && numPages > 0 ? 'loaded' : 'empty',
    docUrl: numPages != null && numPages > 0 ? 'blob:fake-pdf' : null,
    numPages,
    currentPage: 1,
    zoom,
  })
}

beforeEach(() => {
  useDocumentStore.getState().reset()
})

afterEach(() => {
  cleanup()
})

// ── Import helper ─────────────────────────────────────────────────────────────
async function renderKnob() {
  const { ZoomKnob } = await import('../components/ZoomKnob')
  const result = render(React.createElement(ZoomKnob))
  return result
}

// ── Mount guard tests ─────────────────────────────────────────────────────────
describe('ZoomKnob mount guard', () => {
  it('renders nothing when numPages is null', async () => {
    seedStore(null)
    const { container } = await renderKnob()
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when numPages is 0', async () => {
    seedStore(0)
    const { container } = await renderKnob()
    expect(container.firstChild).toBeNull()
  })

  it('renders the knob when numPages is 1', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    expect(container.firstChild).not.toBeNull()
  })
})

// ── Keyboard stepping tests ───────────────────────────────────────────────────
describe('ZoomKnob keyboard navigation', () => {
  it('ArrowUp steps from 1.0 by +0.05', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement
    expect(knob).not.toBeNull()

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowUp' })
    })

    const zoom = useDocumentStore.getState().zoom
    expect(zoom).toBeCloseTo(1.05, 10)
    expect(zoom).toBeGreaterThanOrEqual(ZOOM_MIN)
    expect(zoom).toBeLessThanOrEqual(ZOOM_MAX)
  })

  it('ArrowRight steps from 1.0 by +0.05 (same as ArrowUp)', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowRight' })
    })

    expect(useDocumentStore.getState().zoom).toBeCloseTo(1.05, 10)
  })

  it('ArrowDown steps from 1.0 by -0.05', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowDown' })
    })

    const zoom = useDocumentStore.getState().zoom
    expect(zoom).toBeCloseTo(0.95, 10)
    expect(zoom).toBeGreaterThanOrEqual(ZOOM_MIN)
    expect(zoom).toBeLessThanOrEqual(ZOOM_MAX)
  })

  it('ArrowLeft steps from 1.0 by -0.05 (same as ArrowDown)', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowLeft' })
    })

    expect(useDocumentStore.getState().zoom).toBeCloseTo(0.95, 10)
  })

  it('Home resets zoom to 1.0 from any value', async () => {
    seedStore(1, 1.75)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'Home' })
    })

    expect(useDocumentStore.getState().zoom).toBe(1.0)
  })

  it('ArrowUp at max (2.0) is clamped — stays at 2.0', async () => {
    seedStore(1, 2.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowUp' })
    })

    expect(useDocumentStore.getState().zoom).toBe(ZOOM_MAX)
  })

  it('ArrowDown at min (0.1) is clamped — stays at 0.1', async () => {
    seedStore(1, 0.1)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowDown' })
    })

    expect(useDocumentStore.getState().zoom).toBe(ZOOM_MIN)
  })

  it('multiple ArrowUp keypresses step continuously within [ZOOM_MIN, ZOOM_MAX]', async () => {
    seedStore(1, 0.1)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    // Step up 19 times: 0.1 + 19×0.05 = 1.05
    for (let i = 0; i < 19; i++) {
      await act(async () => {
        fireEvent.keyDown(knob, { key: 'ArrowUp' })
      })
      const z = useDocumentStore.getState().zoom
      expect(z).toBeGreaterThanOrEqual(ZOOM_MIN)
      expect(z).toBeLessThanOrEqual(ZOOM_MAX)
    }
    expect(useDocumentStore.getState().zoom).toBeCloseTo(1.05, 5)
  })
})

// ── ARIA attributes tests ─────────────────────────────────────────────────────
describe('ZoomKnob ARIA', () => {
  it('has role=slider', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]')
    expect(knob).not.toBeNull()
  })

  it('aria-valuenow reflects zoom as percentage (100 at zoom 1.0)', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement
    expect(knob.getAttribute('aria-valuenow')).toBe('100')
  })

  it('aria-valuenow updates when zoom changes via keyboard', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowUp' })
    })

    // After ArrowUp from 1.0, zoom is 1.05 → 105%
    expect(knob.getAttribute('aria-valuenow')).toBe('105')
  })

  it('aria-valuemin is 10 and aria-valuemax is 200', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement
    expect(knob.getAttribute('aria-valuemin')).toBe('10')
    expect(knob.getAttribute('aria-valuemax')).toBe('200')
  })
})

// ── Continuous-range contract assertion ───────────────────────────────────────
describe('ZoomKnob continuous range contract', () => {
  it('setZoom clamps any raw drag value to [ZOOM_MIN, ZOOM_MAX]', () => {
    // Simulate a drag that produces raw zoom values across the full range.
    // This is the core continuous-zoom assertion: the store must clamp all values.
    const startZoom = 1.0
    const sensitivity = 0.007
    // Simulate dragging 300px up and 300px down
    for (let delta = -300; delta <= 300; delta += 1) {
      const rawZoom = startZoom + delta * sensitivity
      useDocumentStore.getState().setZoom(rawZoom)
      const stored = useDocumentStore.getState().zoom
      expect(stored).toBeGreaterThanOrEqual(ZOOM_MIN)
      expect(stored).toBeLessThanOrEqual(ZOOM_MAX)
    }
  })
})

// ── Percentage readout ────────────────────────────────────────────────────────
describe('ZoomKnob readout', () => {
  it('displays the zoom percentage as text (100% at zoom 1.0)', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    expect(container.textContent).toContain('100%')
  })

  it('displays 105% after ArrowUp from 1.0', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowUp' })
    })

    expect(container.textContent).toContain('105%')
  })
})
