/**
 * signatureDraw.test.ts — Unit tests for SignatureDrawModal (SIG-01).
 *
 * Tests focus on:
 *   1. isEmpty / hasStrokes tracking driving aria-disabled state
 *   2. Store-state transitions on confirm / discard
 *   3. aria/role contract (role="dialog", aria-modal, labelled title)
 *   4. Escape closes without saving; Add signature saves + arms placement
 *
 * signature_pad is mocked so tests don't need a real canvas.
 * Canvas 2d context is stubbed globally in src/test/setup.ts.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// ── Mock signature_pad ────────────────────────────────────────────────────────
// We expose stub event listeners so tests can fire beginStroke/endStroke,
// and we expose isEmpty as a mutable flag for state control.

let _mockIsEmpty = true
const _mockListeners: Record<string, Array<() => void>> = {}
let _mockPadOff: ReturnType<typeof vi.fn>
let _mockClear: ReturnType<typeof vi.fn>
let _mockToDataURL: ReturnType<typeof vi.fn>

vi.mock('signature_pad', () => {
  const MockSignaturePad = vi.fn(function MockSignaturePad(
    this: {
      isEmpty: () => boolean
      clear: () => void
      off: () => void
      toDataURL: (type?: string) => string
      addEventListener: (event: string, cb: () => void) => void
      removeEventListener: (event: string, cb: () => void) => void
    },
  ) {
    _mockIsEmpty = true
    _mockListeners['beginStroke'] = []
    _mockListeners['endStroke'] = []
    _mockPadOff = vi.fn()
    _mockClear = vi.fn(() => {
      _mockIsEmpty = true
    })
    _mockToDataURL = vi.fn(() => 'data:image/png;base64,AAAA')

    this.isEmpty = () => _mockIsEmpty
    this.clear = _mockClear as unknown as () => void
    this.off = _mockPadOff as unknown as () => void
    this.toDataURL = _mockToDataURL as unknown as (type?: string) => string
    this.addEventListener = (event: string, cb: () => void) => {
      if (!_mockListeners[event]) _mockListeners[event] = []
      _mockListeners[event].push(cb)
    }
    this.removeEventListener = (event: string, cb: () => void) => {
      if (_mockListeners[event]) {
        _mockListeners[event] = _mockListeners[event].filter((l) => l !== cb)
      }
    }
  })
  return { default: MockSignaturePad }
})

// ── Helper: simulate a stroke ─────────────────────────────────────────────────
function simulateStroke() {
  _mockIsEmpty = false
  // Fire all beginStroke then endStroke listeners (signature_pad behavior)
  ;(_mockListeners['beginStroke'] ?? []).forEach((cb) => cb())
  ;(_mockListeners['endStroke'] ?? []).forEach((cb) => cb())
}

// ── Store import (dynamic to avoid stale module cache) ────────────────────────
async function getStore() {
  const { useFieldStore } = await import('../store/fieldStore')
  return useFieldStore
}

// ── Tests ─────────────────────────────────────────────────────────────────────

afterEach(() => {
  cleanup()
})

describe('SignatureDrawModal', () => {
  let useFieldStore: Awaited<ReturnType<typeof getStore>>

  beforeEach(async () => {
    useFieldStore = await getStore()
    // Reset field store state before each test
    useFieldStore.getState().resetFields()
    // Open the modal for each test
    useFieldStore.getState().openModal()
    _mockIsEmpty = true
  })

  afterEach(() => {
    useFieldStore.getState().closeModal()
  })

  // ── Role / accessibility contract ─────────────────────────────────────────

  it('renders role="dialog" with aria-modal and aria-labelledby', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).not.toBeNull()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')
    expect(dialog?.getAttribute('aria-labelledby')).toBe('modal-title')
  })

  it('renders the title with id="modal-title" matching the copy contract', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    const title = container.querySelector('#modal-title')
    expect(title).not.toBeNull()
    expect(title?.textContent).toBe('Draw your signature')
  })

  it('renders nothing when modalOpen is false', async () => {
    useFieldStore.getState().closeModal()
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  // ── "Add signature" disabled state ────────────────────────────────────────

  it('"Add signature" starts with aria-disabled="true" when canvas is empty', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Find the Add signature button by its aria-label (disabled state)
    const btn = container.querySelector(
      'button[aria-label="Add signature — draw a signature first"]',
    )
    expect(btn).not.toBeNull()
    expect(btn?.getAttribute('aria-disabled')).toBe('true')
  })

  it('"Add signature" becomes enabled (no aria-disabled) after a stroke is drawn', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Simulate a stroke via the signature_pad event listeners
    await act(async () => {
      simulateStroke()
    })

    // After stroke, aria-disabled should be gone / falsy
    const addBtn = container.querySelector('button[aria-label="Add signature"]')
    expect(addBtn).not.toBeNull()
    expect(addBtn?.getAttribute('aria-disabled')).toBeNull()
  })

  // ── Confirm behavior ─────────────────────────────────────────────────────

  it('clicking "Add signature" after a stroke stores dataUrl, arms placement, closes modal', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Draw a stroke
    await act(async () => {
      simulateStroke()
    })

    // Click Add signature
    await act(async () => {
      const btn = container.querySelector('button[aria-label="Add signature"]')
      expect(btn).not.toBeNull()
      fireEvent.click(btn!)
    })

    const state = useFieldStore.getState()
    expect(state.signatureDataUrl).toMatch(/^data:image\/png/)
    expect(state.placementMode).toBe(true)
    expect(state.modalOpen).toBe(false)
  })

  it('clicking "Add signature" when disabled (empty canvas) does not change store', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Click the disabled button (no stroke drawn)
    await act(async () => {
      const btn = container.querySelector(
        'button[aria-label="Add signature — draw a signature first"]',
      )
      if (btn) fireEvent.click(btn)
    })

    const state = useFieldStore.getState()
    expect(state.signatureDataUrl).toBeNull()
    expect(state.placementMode).toBe(false)
    // Modal should still be open
    expect(state.modalOpen).toBe(true)
  })

  // ── Discard behavior ─────────────────────────────────────────────────────

  it('clicking "Discard" closes the modal without saving the signature', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Draw something so we can verify it's NOT saved
    await act(async () => {
      simulateStroke()
    })

    // Click Discard
    await act(async () => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Discard',
      )
      expect(btn).not.toBeNull()
      fireEvent.click(btn!)
    })

    const state = useFieldStore.getState()
    expect(state.modalOpen).toBe(false)
    expect(state.signatureDataUrl).toBeNull()
    expect(state.placementMode).toBe(false)
  })

  // ── Escape key ───────────────────────────────────────────────────────────

  it('pressing Escape closes the modal without saving', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Draw something
    await act(async () => {
      simulateStroke()
    })

    // Press Escape on the dialog
    await act(async () => {
      const dialog = container.querySelector('[role="dialog"]')
      expect(dialog).not.toBeNull()
      fireEvent.keyDown(dialog!, { key: 'Escape' })
    })

    const state = useFieldStore.getState()
    expect(state.modalOpen).toBe(false)
    expect(state.signatureDataUrl).toBeNull()
    expect(state.placementMode).toBe(false)
  })

  // ── Clear canvas ─────────────────────────────────────────────────────────

  it('"Clear canvas" resets hasStrokes so "Add signature" becomes disabled again', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Draw a stroke
    await act(async () => {
      simulateStroke()
    })

    // Should now be enabled
    expect(
      container.querySelector('button[aria-label="Add signature"]'),
    ).not.toBeNull()

    // Click Clear canvas
    await act(async () => {
      const btn = Array.from(container.querySelectorAll('button')).find(
        (b) => b.textContent === 'Clear canvas',
      )
      expect(btn).not.toBeNull()
      fireEvent.click(btn!)
    })

    // pad.clear() was called
    expect(_mockClear).toHaveBeenCalled()

    // "Add signature" should be disabled again
    const disabledBtn = container.querySelector(
      'button[aria-label="Add signature — draw a signature first"]',
    )
    expect(disabledBtn).not.toBeNull()
    expect(disabledBtn?.getAttribute('aria-disabled')).toBe('true')
  })

  // ── "Sign here" hint ─────────────────────────────────────────────────────

  it('shows "Sign here" hint when canvas is empty and hides it after a stroke', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Hint visible initially
    expect(container.textContent).toContain('Sign here')

    // Draw a stroke
    await act(async () => {
      simulateStroke()
    })

    // Hint gone
    expect(container.textContent).not.toContain('Sign here')
  })

  // ── pad.off() cleanup ────────────────────────────────────────────────────

  it('calls pad.off() when modal closes (T-02-06 listener cleanup)', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    await act(async () => {
      render(React.createElement(SignatureDrawModal))
    })

    // Close the modal to trigger effect cleanup
    await act(async () => {
      useFieldStore.getState().closeModal()
    })

    expect(_mockPadOff).toHaveBeenCalled()
  })
})
