/**
 * undoRedo.test.ts — FLD-09 redo-tail truncation + initials-history tests
 *
 * Focused store-level tests for the undo/redo history system.
 * Owned solely by Plan 04 (no cross-plan ownership conflict).
 *
 * Covers:
 *   - FLD-09: new action after undo truncates the redo tail
 *   - FLD-09 / FLD-02: initials field undo/redo integration
 *   - FLD-09: undo/redo clears selectedFieldId
 *
 * Uses getState() directly — no DOM, no component rendering.
 * resetFields() in beforeEach ensures test isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { useFieldStore, type PlacedField } from '../store/fieldStore'

/** Minimal field fixture factory — mirrors fieldStore.test.ts helper */
function makeField(overrides: Partial<PlacedField> = {}): PlacedField {
  return {
    id: crypto.randomUUID(),
    type: 'signature',
    pageNumber: 1,
    pdfX: 10,
    pdfY: 20,
    pdfWidth: 100,
    pdfHeight: 30,
    dataUrl: 'data:image/png;base64,abc',
    ...overrides,
  }
}

describe('undoRedo — CR-01 exactly N undos for N adds (no phantom steps)', () => {
  beforeEach(() => {
    useFieldStore.getState().resetFields()
  })

  it('1 add → 1 undo returns to empty; 2nd undo is a no-op', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.undo()
    expect(useFieldStore.getState().fields).toHaveLength(0)
    store.undo() // no-op
    expect(useFieldStore.getState().fields).toHaveLength(0)
  })

  it('2 adds → exactly 2 undos return to empty (no phantom middle step)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.addField(makeField({ id: 'f2' }))
    // undo #1: back to [f1]
    store.undo()
    expect(useFieldStore.getState().fields).toHaveLength(1)
    expect(useFieldStore.getState().fields[0].id).toBe('f1')
    // undo #2: back to []
    store.undo()
    expect(useFieldStore.getState().fields).toHaveLength(0)
    // undo #3: no-op
    store.undo()
    expect(useFieldStore.getState().fields).toHaveLength(0)
  })

  it('5 adds → exactly 5 undos return to empty', () => {
    const store = useFieldStore.getState()
    for (let i = 1; i <= 5; i++) {
      store.addField(makeField({ id: `f${i}` }))
    }
    // Should have 5 fields
    expect(useFieldStore.getState().fields).toHaveLength(5)
    // Each undo removes exactly one field
    for (let remaining = 4; remaining >= 0; remaining--) {
      store.undo()
      expect(useFieldStore.getState().fields).toHaveLength(remaining)
    }
    // Further undo is a no-op
    store.undo()
    expect(useFieldStore.getState().fields).toHaveLength(0)
  })
})

describe('undoRedo — FLD-09 redo-tail truncation', () => {
  beforeEach(() => {
    useFieldStore.getState().resetFields()
  })

  it('new action after undo truncates the redo tail — redo is a no-op after re-branch', () => {
    const store = useFieldStore.getState()

    // Build history: add f1, add f2
    store.addField(makeField({ id: 'f1' }))
    store.addField(makeField({ id: 'f2' }))

    // Undo once — back to [f1]
    store.undo()
    expect(useFieldStore.getState().fields).toHaveLength(1)
    expect(useFieldStore.getState().fields[0].id).toBe('f1')

    // New action — add f3 — truncates the f2 redo tail
    store.addField(makeField({ id: 'f3' }))

    // Redo should be a no-op (historyIndex is at the end of the new branch)
    store.redo()

    // Fields must be [f1, f3] — the old f2 redo path is discarded
    const state = useFieldStore.getState()
    expect(state.fields).toHaveLength(2)
    const ids = state.fields.map((f) => f.id)
    expect(ids).toContain('f1')
    expect(ids).toContain('f3')
    expect(ids).not.toContain('f2')
  })

  it('redo is a no-op at the end of history (no crash)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    // Already at the end; redo should not throw or change state
    const fieldsBefore = useFieldStore.getState().fields.length
    store.redo()
    expect(useFieldStore.getState().fields).toHaveLength(fieldsBefore)
  })

  it('undo at baseline (historyIndex <= 0) is a no-op', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.undo() // fields = []
    store.undo() // no-op — must not throw
    expect(useFieldStore.getState().fields).toHaveLength(0)
  })
})

describe('undoRedo — FLD-02/FLD-09 initials field history integration', () => {
  beforeEach(() => {
    useFieldStore.getState().resetFields()
  })

  it('initials field undo removes it; redo restores it', () => {
    const store = useFieldStore.getState()

    // Add an initials field (type 'initials', dataUrl set, no textValue)
    store.addField(
      makeField({
        id: 'init-1',
        type: 'initials',
        dataUrl: 'data:image/png;base64,initialsdata123',
      }),
    )

    expect(useFieldStore.getState().fields).toHaveLength(1)
    expect(useFieldStore.getState().fields[0].type).toBe('initials')

    // Undo — removes the initials field
    store.undo()
    expect(useFieldStore.getState().fields).toHaveLength(0)

    // Redo — restores the initials field
    store.redo()
    const state = useFieldStore.getState()
    expect(state.fields).toHaveLength(1)
    expect(state.fields[0].id).toBe('init-1')
    expect(state.fields[0].type).toBe('initials')
    expect(state.fields[0].dataUrl).toBe('data:image/png;base64,initialsdata123')
  })

  it('initials field after undo truncates redo tail — redo branch diverges', () => {
    const store = useFieldStore.getState()

    // Add a signature, then an initials field
    store.addField(makeField({ id: 'sig-1', type: 'signature' }))
    store.addField(
      makeField({
        id: 'init-1',
        type: 'initials',
        dataUrl: 'data:image/png;base64,initials',
      }),
    )

    // Undo the initials field addition → back to [sig-1]
    store.undo()
    expect(useFieldStore.getState().fields).toHaveLength(1)

    // Add a different initials field — truncates the old init-1 redo tail
    store.addField(
      makeField({
        id: 'init-2',
        type: 'initials',
        dataUrl: 'data:image/png;base64,newInitials',
      }),
    )

    // Redo is a no-op — we are at the end of the new branch
    store.redo()

    const ids = useFieldStore.getState().fields.map((f) => f.id)
    expect(ids).toContain('sig-1')
    expect(ids).toContain('init-2')
    expect(ids).not.toContain('init-1')
  })
})

describe('undoRedo — FLD-09 selection cleared on undo/redo', () => {
  beforeEach(() => {
    useFieldStore.getState().resetFields()
  })

  it('undo clears selectedFieldId (avoids dangling reference)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.setSelectedFieldId('f1')

    expect(useFieldStore.getState().selectedFieldId).toBe('f1')

    store.undo()
    expect(useFieldStore.getState().selectedFieldId).toBeNull()
  })

  it('redo clears selectedFieldId', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.undo()
    store.redo()
    expect(useFieldStore.getState().selectedFieldId).toBeNull()
  })

  it('selection cleared on undo even when selectedFieldId is not in the restored fields', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.addField(makeField({ id: 'f2' }))
    store.setSelectedFieldId('f2')

    // Undo removes f2 — selectedFieldId 'f2' would be a dangling ref
    store.undo()
    expect(useFieldStore.getState().selectedFieldId).toBeNull()

    // Undo again — removes f1
    store.undo()
    expect(useFieldStore.getState().selectedFieldId).toBeNull()
  })
})
