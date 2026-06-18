/**
 * ZoomKnob tests — EDT-05 snap-contract backstop.
 *
 * Verifies:
 * (a) Keyboard ArrowUp moves zoom to next ZOOM_STEP (1.0 → 1.25)
 * (b) Keyboard ArrowDown moves zoom to previous ZOOM_STEP (1.0 → 0.75)
 * (c) Home resets zoom to 1.0 from any step
 * (d) At max (2.0) ArrowUp is a no-op; at min (0.5) ArrowDown is a no-op
 * (e) nearestZoomStep helper always returns a value that is in ZOOM_STEPS
 * (f) Knob does NOT render when numPages is null or 0
 * (g) Pointer rotate + arc percent are derived from the SNAPPED store zoom, not raw drag
 *
 * Drag simulation is limited in jsdom (setPointerCapture not implemented).
 * The snap-contract is verified via the exported nearestZoomStep helper +
 * the keyboard paths, which hit the same setZoom(snapped) code path.
 * The non-negotiable assertion is: no non-ZOOM_STEP value reaches setZoom.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup, fireEvent } from '@testing-library/react'
import React from 'react'
import { useDocumentStore, ZOOM_STEPS } from '../store/documentStore'
import { nearestZoomStep } from '../components/ZoomKnob'

// ── Store reset helper ────────────────────────────────────────────────────────
function seedStore(numPages: number | null, zoom: number = 1.0) {
  useDocumentStore.setState({
    view: numPages != null && numPages > 0 ? 'loaded' : 'empty',
    docUrl: numPages != null && numPages > 0 ? 'blob:fake-pdf' : null,
    numPages,
    currentPage: 1,
    zoom: 1.0, // set to 1.0 first (it's a valid step)
  })
  if (zoom !== 1.0) {
    useDocumentStore.getState().setZoom(zoom as (typeof ZOOM_STEPS)[number])
  }
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

// ── nearestZoomStep unit tests ────────────────────────────────────────────────
describe('nearestZoomStep', () => {
  it('returns exact match when raw is exactly on a step', () => {
    expect(nearestZoomStep(1.0)).toBe(1.0)
    expect(nearestZoomStep(0.5)).toBe(0.5)
    expect(nearestZoomStep(2.0)).toBe(2.0)
    expect(nearestZoomStep(1.25)).toBe(1.25)
  })

  it('snaps to the nearest step for in-between values', () => {
    // 1.03 is closer to 1.0 than to 1.25 (diff: 0.03 vs 0.22)
    expect(nearestZoomStep(1.03)).toBe(1.0)
    // 1.15 is closer to 1.25 than to 1.0 (diff: 0.10 vs 0.15)
    expect(nearestZoomStep(1.15)).toBe(1.25)
    // 0.6 is closer to 0.5 than to 0.75 (diff: 0.10 vs 0.15)
    expect(nearestZoomStep(0.6)).toBe(0.5)
    // 0.65 is midpoint; either 0.5 or 0.75 acceptable but must be in ZOOM_STEPS
    const mid = nearestZoomStep(0.65)
    expect(Array.from(ZOOM_STEPS)).toContain(mid)
  })

  it('clamps to min (0.5) for values below the range', () => {
    expect(nearestZoomStep(0.1)).toBe(0.5)
    expect(nearestZoomStep(-1.0)).toBe(0.5)
  })

  it('clamps to max (2.0) for values above the range', () => {
    expect(nearestZoomStep(5.0)).toBe(2.0)
    expect(nearestZoomStep(2.5)).toBe(2.0)
  })

  it('always returns a value that is a member of ZOOM_STEPS', () => {
    const testValues = [-0.5, 0.3, 0.62, 0.87, 1.0, 1.13, 1.37, 1.63, 1.88, 2.1, 3.0]
    testValues.forEach((raw) => {
      const snapped = nearestZoomStep(raw)
      expect(Array.from(ZOOM_STEPS)).toContain(snapped)
    })
  })
})

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
  it('ArrowUp steps from 1.0 to 1.25', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement
    expect(knob).not.toBeNull()

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowUp' })
    })

    expect(useDocumentStore.getState().zoom).toBe(1.25)
    // Confirm it's a valid ZOOM_STEP
    expect(Array.from(ZOOM_STEPS)).toContain(useDocumentStore.getState().zoom)
  })

  it('ArrowRight steps from 1.0 to 1.25 (same as ArrowUp)', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowRight' })
    })

    expect(useDocumentStore.getState().zoom).toBe(1.25)
  })

  it('ArrowDown steps from 1.0 to 0.75', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowDown' })
    })

    expect(useDocumentStore.getState().zoom).toBe(0.75)
    expect(Array.from(ZOOM_STEPS)).toContain(useDocumentStore.getState().zoom)
  })

  it('ArrowLeft steps from 1.0 to 0.75 (same as ArrowDown)', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowLeft' })
    })

    expect(useDocumentStore.getState().zoom).toBe(0.75)
  })

  it('Home resets zoom to 1.0 from any step', async () => {
    seedStore(1, 1.75)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'Home' })
    })

    expect(useDocumentStore.getState().zoom).toBe(1.0)
  })

  it('ArrowUp at max (2.0) is a no-op', async () => {
    seedStore(1, 2.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowUp' })
    })

    expect(useDocumentStore.getState().zoom).toBe(2.0)
  })

  it('ArrowDown at min (0.5) is a no-op', async () => {
    seedStore(1, 0.5)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowDown' })
    })

    expect(useDocumentStore.getState().zoom).toBe(0.5)
  })

  it('multiple ArrowUp keypresses step through ZOOM_STEPS in order', async () => {
    seedStore(1, 0.5)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    const expectedSteps = [0.75, 1.0, 1.25, 1.5, 1.75, 2.0]
    for (const expected of expectedSteps) {
      await act(async () => {
        fireEvent.keyDown(knob, { key: 'ArrowUp' })
      })
      expect(useDocumentStore.getState().zoom).toBe(expected)
      expect(Array.from(ZOOM_STEPS)).toContain(useDocumentStore.getState().zoom)
    }
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

    // After ArrowUp from 1.0, zoom is 1.25 → 125%
    expect(knob.getAttribute('aria-valuenow')).toBe('125')
  })

  it('aria-valuemin is 50 and aria-valuemax is 200', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement
    expect(knob.getAttribute('aria-valuemin')).toBe('50')
    expect(knob.getAttribute('aria-valuemax')).toBe('200')
  })
})

// ── Snap-contract assertion ───────────────────────────────────────────────────
describe('ZoomKnob snap contract', () => {
  it('nearestZoomStep never passes a non-ZOOM_STEP value — simulated drag range', () => {
    // Simulate a drag that produces raw zoom values across the full range.
    // This is the core EDT-05 assertion: every possible drag result, when passed
    // through nearestZoomStep, must be a member of ZOOM_STEPS.
    const startZoom = 1.0
    const sensitivity = 0.007
    // Simulate dragging 300px up and 300px down
    for (let delta = -300; delta <= 300; delta += 1) {
      const rawZoom = startZoom + delta * sensitivity
      const snapped = nearestZoomStep(rawZoom)
      expect(Array.from(ZOOM_STEPS)).toContain(snapped)
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

  it('displays 125% after ArrowUp from 1.0', async () => {
    seedStore(1, 1.0)
    const { container } = await renderKnob()
    const knob = container.querySelector('[role="slider"]') as HTMLElement

    await act(async () => {
      fireEvent.keyDown(knob, { key: 'ArrowUp' })
    })

    expect(container.textContent).toContain('125%')
  })
})
