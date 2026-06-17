/**
 * signatureDraw.test.ts — Unit tests for SignatureDrawModal (SIG-01/SIG-02) and
 * SavedItemCard isolated render.
 *
 * Tests focus on:
 *   1. isEmpty / hasStrokes tracking driving aria-disabled state
 *   2. Store-state transitions on confirm / discard
 *   3. aria/role contract (role="dialog", aria-modal, labelled title)
 *   4. Escape closes without saving; Use signature saves + arms placement
 *   5. Type-tab CTA aria-disabled behavior
 *   6. SavedItemCard isolated render (drawn + typed branches, delete)
 *
 * signature_pad is mocked so tests don't need a real canvas.
 * Canvas 2d context is stubbed globally in src/test/setup.ts.
 *
 * vi.mock('idb-keyval') MUST be at module level — fieldStore transitively imports it.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { render, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'

// ── Mock idb-keyval (fieldStore transitively imports it) ──────────────────────
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

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
    // Phase 4: title is "Create signature" (was "Draw your signature" in Phase 2)
    expect(title?.textContent).toBe('Create signature')
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

  // ── Tab bar ───────────────────────────────────────────────────────────────

  it('renders a role="tablist" with Saved, Draw, Type tabs', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    const tablist = container.querySelector('[role="tablist"]')
    expect(tablist).not.toBeNull()
    const tabs = container.querySelectorAll('[role="tab"]')
    expect(tabs).toHaveLength(3)
    const labels = Array.from(tabs).map((t) => t.textContent)
    expect(labels).toContain('Saved')
    expect(labels).toContain('Draw')
    expect(labels).toContain('Type')
  })

  it('Draw tab is selected by default', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    const drawTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
      (t) => t.textContent === 'Draw',
    )
    expect(drawTab?.getAttribute('aria-selected')).toBe('true')
  })

  // ── Draw tab: "Use signature" disabled state ──────────────────────────────

  it('"Use signature" (Draw tab) starts with aria-disabled="true" when canvas is empty', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Find the Use signature button by its aria-label (disabled state)
    const btn = container.querySelector(
      'button[aria-label="Use signature — draw a signature first"]',
    )
    expect(btn).not.toBeNull()
    expect(btn?.getAttribute('aria-disabled')).toBe('true')
  })

  it('"Use signature" (Draw tab) becomes enabled (no aria-disabled) after a stroke is drawn', async () => {
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

    // After stroke, the draw-panel CTA should be enabled
    const addBtn = container.querySelector('button[aria-label="Use signature"]')
    expect(addBtn).not.toBeNull()
    expect(addBtn?.getAttribute('aria-disabled')).toBeNull()
  })

  // ── Confirm behavior (Draw tab) ───────────────────────────────────────────

  it('clicking "Use signature" (Draw tab) after a stroke stores dataUrl, arms placement, closes modal', async () => {
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

    // Click Use signature (Draw tab)
    await act(async () => {
      const btn = container.querySelector('button[aria-label="Use signature"]')
      expect(btn).not.toBeNull()
      fireEvent.click(btn!)
    })

    const state = useFieldStore.getState()
    expect(state.signatureDataUrl).toMatch(/^data:image\/png/)
    expect(state.armedFieldType).toBe('signature')
    expect(state.modalOpen).toBe(false)
  })

  it('clicking "Use signature" (Draw tab) when disabled (empty canvas) does not change store', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Click the disabled button (no stroke drawn)
    await act(async () => {
      const btn = container.querySelector(
        'button[aria-label="Use signature — draw a signature first"]',
      )
      if (btn) fireEvent.click(btn)
    })

    const state = useFieldStore.getState()
    expect(state.signatureDataUrl).toBeNull()
    expect(state.armedFieldType).toBeNull()
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

    // Click Discard (first one in the Draw panel)
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
    expect(state.armedFieldType).toBeNull()
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
    expect(state.armedFieldType).toBeNull()
  })

  // ── Clear canvas ─────────────────────────────────────────────────────────

  it('"Clear canvas" resets hasStrokes so "Use signature" (Draw tab) becomes disabled again', async () => {
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
      container.querySelector('button[aria-label="Use signature"]'),
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

    // "Use signature" should be disabled again
    const disabledBtn = container.querySelector(
      'button[aria-label="Use signature — draw a signature first"]',
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

// ── Type tab tests ────────────────────────────────────────────────────────────

describe('Type tab', () => {
  let useFieldStore: Awaited<ReturnType<typeof getStore>>

  beforeEach(async () => {
    useFieldStore = await getStore()
    useFieldStore.getState().resetFields()
    useFieldStore.setState({ savedItems: [] })
    useFieldStore.getState().openModal()
    _mockIsEmpty = true
  })

  afterEach(() => {
    useFieldStore.getState().closeModal()
  })

  it('CTA is aria-disabled when input is empty', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Click the Type tab
    await act(async () => {
      const typeTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (t) => t.textContent === 'Type',
      )
      expect(typeTab).not.toBeNull()
      fireEvent.click(typeTab!)
    })

    // CTA should be aria-disabled (input is empty)
    const cta = container.querySelector(
      'button[aria-label="Use signature — type your name first"]',
    )
    expect(cta).not.toBeNull()
    expect(cta?.getAttribute('aria-disabled')).toBe('true')
  })

  it('CTA is enabled when text is present in the input', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Click the Type tab
    await act(async () => {
      const typeTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (t) => t.textContent === 'Type',
      )
      fireEvent.click(typeTab!)
    })

    // Type into the name input
    await act(async () => {
      const input = container.querySelector('input[aria-label="Your name for signature"]')
      expect(input).not.toBeNull()
      fireEvent.change(input!, { target: { value: 'John Doe' } })
    })

    // CTA should now be enabled (no aria-disabled)
    const enabledCta = container.querySelector('button[aria-label="Use signature"]')
    expect(enabledCta).not.toBeNull()
    expect(enabledCta?.getAttribute('aria-disabled')).toBeNull()
  })

  it('clicking a font option card updates its aria-checked state', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Click the Type tab
    await act(async () => {
      const typeTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (t) => t.textContent === 'Type',
      )
      fireEvent.click(typeTab!)
    })

    // Get all font radio cards (inside the radiogroup)
    const fontCards = Array.from(
      container.querySelectorAll('[role="radiogroup"] [role="radio"]'),
    )
    expect(fontCards.length).toBe(3)

    // Initially first card (Dancing Script) is selected
    expect(fontCards[0].getAttribute('aria-checked')).toBe('true')
    expect(fontCards[1].getAttribute('aria-checked')).toBe('false')

    // Click the second font (Great Vibes)
    await act(async () => {
      fireEvent.click(fontCards[1])
    })

    // Now second card should be selected
    const updatedCards = Array.from(
      container.querySelectorAll('[role="radiogroup"] [role="radio"]'),
    )
    expect(updatedCards[0].getAttribute('aria-checked')).toBe('false')
    expect(updatedCards[1].getAttribute('aria-checked')).toBe('true')
  })

  it('confirming typed signature arms armedTypedPayload and closes modal', async () => {
    const { SignatureDrawModal } = await import('../components/SignatureDrawModal')
    let container!: Element
    await act(async () => {
      const result = render(React.createElement(SignatureDrawModal))
      container = result.container
    })

    // Click the Type tab
    await act(async () => {
      const typeTab = Array.from(container.querySelectorAll('[role="tab"]')).find(
        (t) => t.textContent === 'Type',
      )
      fireEvent.click(typeTab!)
    })

    // Type a name
    await act(async () => {
      const input = container.querySelector('input[aria-label="Your name for signature"]')
      fireEvent.change(input!, { target: { value: 'Jane Smith' } })
    })

    // Uncheck save-for-reuse to avoid async addSavedItem.
    // WR-02 fix: checkbox id is now panel-specific (sig-save-for-reuse-type on Type panel)
    await act(async () => {
      const checkbox = container.querySelector('#sig-save-for-reuse-type')
      if (checkbox) fireEvent.click(checkbox)
    })

    // Click CTA
    await act(async () => {
      const cta = container.querySelector('button[aria-label="Use signature"]')
      expect(cta).not.toBeNull()
      fireEvent.click(cta!)
    })

    const state = useFieldStore.getState()
    expect(state.armedTypedPayload).not.toBeNull()
    expect(state.armedTypedPayload?.text).toBe('Jane Smith')
    expect(state.armedTypedPayload?.kind).toBe('signature')
    expect(state.armedFieldType).toBe('signature')
    expect(state.modalOpen).toBe(false)
  })
})

// ── SavedItemCard isolated render tests ───────────────────────────────────────

describe('SavedItemCard', () => {
  it('renders drawn thumbnail with img element and "Drawn" caption', async () => {
    const { SavedItemCard } = await import('../components/SavedItemCard')
    const item = {
      id: 'item-1',
      kind: 'signature' as const,
      source: 'drawn' as const,
      dataUrl: 'data:image/png;base64,AAAA',
      createdAt: Date.now(),
    }
    const onSelect = vi.fn()
    const onDelete = vi.fn()

    let container!: Element
    await act(async () => {
      const result = render(
        React.createElement(SavedItemCard, {
          item,
          isSelected: false,
          onSelect,
          onDelete,
          deleteAriaLabel: 'Delete saved signature',
        }),
      )
      container = result.container
    })

    // Drawn item shows img element
    const img = container.querySelector('img')
    expect(img).not.toBeNull()
    expect(img?.getAttribute('src')).toBe('data:image/png;base64,AAAA')

    // Caption says "Drawn"
    expect(container.textContent).toContain('Drawn')

    // role=radio with aria-checked=false
    const card = container.querySelector('[role="radio"]')
    expect(card).not.toBeNull()
    expect(card?.getAttribute('aria-checked')).toBe('false')
  })

  it('renders typed thumbnail with text-in-font div and "Typed" caption', async () => {
    const { SavedItemCard } = await import('../components/SavedItemCard')
    const item = {
      id: 'item-2',
      kind: 'signature' as const,
      source: 'typed' as const,
      text: 'Jane Doe',
      fontFamily: 'Dancing Script',
      createdAt: Date.now(),
    }
    const onSelect = vi.fn()
    const onDelete = vi.fn()

    let container!: Element
    await act(async () => {
      const result = render(
        React.createElement(SavedItemCard, {
          item,
          isSelected: false,
          onSelect,
          onDelete,
          deleteAriaLabel: 'Delete saved signature',
        }),
      )
      container = result.container
    })

    // No img element for typed item
    expect(container.querySelector('img')).toBeNull()

    // Text node renders the name (T-04-09: text node, not dangerouslySetInnerHTML)
    expect(container.textContent).toContain('Jane Doe')

    // Caption says "Typed"
    expect(container.textContent).toContain('Typed')
  })

  it('delete button has correct aria-label for signature kind', async () => {
    const { SavedItemCard } = await import('../components/SavedItemCard')
    const item = {
      id: 'item-3',
      kind: 'signature' as const,
      source: 'drawn' as const,
      dataUrl: 'data:image/png;base64,AAAA',
      createdAt: Date.now(),
    }
    const onSelect = vi.fn()
    const onDelete = vi.fn()

    let container!: Element
    await act(async () => {
      const result = render(
        React.createElement(SavedItemCard, {
          item,
          isSelected: false,
          onSelect,
          onDelete,
          deleteAriaLabel: 'Delete saved signature',
        }),
      )
      container = result.container
    })

    const deleteBtn = container.querySelector('button[aria-label="Delete saved signature"]')
    expect(deleteBtn).not.toBeNull()
  })

  it('delete button aria-label works for initials kind too', async () => {
    const { SavedItemCard } = await import('../components/SavedItemCard')
    const item = {
      id: 'item-4',
      kind: 'initials' as const,
      source: 'drawn' as const,
      dataUrl: 'data:image/png;base64,BBBB',
      createdAt: Date.now(),
    }
    const onSelect = vi.fn()
    const onDelete = vi.fn()

    let container!: Element
    await act(async () => {
      const result = render(
        React.createElement(SavedItemCard, {
          item,
          isSelected: false,
          onSelect,
          onDelete,
          deleteAriaLabel: 'Delete saved initials',
        }),
      )
      container = result.container
    })

    const deleteBtn = container.querySelector('button[aria-label="Delete saved initials"]')
    expect(deleteBtn).not.toBeNull()
  })

  it('delete button click calls onDelete with stopPropagation (does NOT call onSelect)', async () => {
    const { SavedItemCard } = await import('../components/SavedItemCard')
    const item = {
      id: 'item-5',
      kind: 'signature' as const,
      source: 'drawn' as const,
      dataUrl: 'data:image/png;base64,CCCC',
      createdAt: Date.now(),
    }
    const onSelect = vi.fn()
    const onDelete = vi.fn()

    let container!: Element
    await act(async () => {
      const result = render(
        React.createElement(SavedItemCard, {
          item,
          isSelected: false,
          onSelect,
          onDelete,
          deleteAriaLabel: 'Delete saved signature',
        }),
      )
      container = result.container
    })

    const deleteBtn = container.querySelector('button[aria-label="Delete saved signature"]')
    expect(deleteBtn).not.toBeNull()

    await act(async () => {
      fireEvent.click(deleteBtn!)
    })

    // onDelete called with item id
    expect(onDelete).toHaveBeenCalledWith('item-5')
    // onSelect NOT called (stopPropagation prevents bubbling to card onClick)
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('card body click calls onSelect', async () => {
    const { SavedItemCard } = await import('../components/SavedItemCard')
    const item = {
      id: 'item-6',
      kind: 'signature' as const,
      source: 'typed' as const,
      text: 'A',
      fontFamily: 'Pacifico',
      createdAt: Date.now(),
    }
    const onSelect = vi.fn()
    const onDelete = vi.fn()

    let container!: Element
    await act(async () => {
      const result = render(
        React.createElement(SavedItemCard, {
          item,
          isSelected: true,
          onSelect,
          onDelete,
          deleteAriaLabel: 'Delete saved signature',
        }),
      )
      container = result.container
    })

    // isSelected=true → aria-checked=true and tabIndex=0
    const card = container.querySelector('[role="radio"]')
    expect(card?.getAttribute('aria-checked')).toBe('true')
    expect(card?.getAttribute('tabindex')).toBe('0')

    await act(async () => {
      fireEvent.click(card!)
    })

    expect(onSelect).toHaveBeenCalledWith('item-6')
  })
})
