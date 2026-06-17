import { describe, it, expect, beforeEach } from 'vitest'
import { useFieldStore, type PlacedField, type PageDimensions } from '../store/fieldStore'

/** Helpers to build test fixtures */
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

function makeDims(overrides: Partial<PageDimensions> = {}): PageDimensions {
  return {
    originalWidth: 612,
    originalHeight: 792,
    scale: 1,
    ...overrides,
  }
}

describe('useFieldStore', () => {
  beforeEach(() => {
    // Reset store before each test so state doesn't leak between tests
    useFieldStore.getState().resetFields()
  })

  // ---------- addField ----------

  it('addField pushes a new field; fields.length increases to 1', () => {
    const store = useFieldStore.getState()
    const field = makeField({ id: 'f1' })
    store.addField(field)
    expect(useFieldStore.getState().fields).toHaveLength(1)
    expect(useFieldStore.getState().fields[0].id).toBe('f1')
  })

  it('addField is immutable — does not mutate the previous array', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    const arrayAfterFirst = useFieldStore.getState().fields
    store.addField(makeField({ id: 'f2' }))
    // The reference after the first add must be a different array
    expect(useFieldStore.getState().fields).not.toBe(arrayAfterFirst)
    expect(useFieldStore.getState().fields).toHaveLength(2)
  })

  // ---------- updateField ----------

  it('updateField patches a field by id', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1', pdfX: 10 }))
    store.updateField('f1', { pdfX: 99 })
    const updated = useFieldStore.getState().fields.find((f) => f.id === 'f1')
    expect(updated?.pdfX).toBe(99)
  })

  it('updateField does not modify other fields', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1', pdfX: 10 }))
    store.addField(makeField({ id: 'f2', pdfX: 20 }))
    store.updateField('f1', { pdfX: 99 })
    const other = useFieldStore.getState().fields.find((f) => f.id === 'f2')
    expect(other?.pdfX).toBe(20)
  })

  // ---------- deleteField ----------

  it('deleteField removes the field with the given id', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.addField(makeField({ id: 'f2' }))
    store.deleteField('f1')
    const ids = useFieldStore.getState().fields.map((f) => f.id)
    expect(ids).toEqual(['f2'])
  })

  it('deleteField of the selected field clears selectedFieldId (FLD-07)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'sel' }))
    store.setSelectedFieldId('sel')
    expect(useFieldStore.getState().selectedFieldId).toBe('sel')
    store.deleteField('sel')
    expect(useFieldStore.getState().fields).toHaveLength(0)
    expect(useFieldStore.getState().selectedFieldId).toBeNull()
  })

  it('deleteField of a non-selected field leaves selectedFieldId intact', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.addField(makeField({ id: 'f2' }))
    store.setSelectedFieldId('f1')
    store.deleteField('f2')
    // f2 deleted but f1 is still selected
    expect(useFieldStore.getState().fields).toHaveLength(1)
    expect(useFieldStore.getState().selectedFieldId).toBe('f1')
  })

  // ---------- setSelectedFieldId ----------

  it('setSelectedFieldId sets and clears the selection', () => {
    const store = useFieldStore.getState()
    store.setSelectedFieldId('abc')
    expect(useFieldStore.getState().selectedFieldId).toBe('abc')
    store.setSelectedFieldId(null)
    expect(useFieldStore.getState().selectedFieldId).toBeNull()
  })

  // ---------- setPageDimensions ----------

  it('setPageDimensions stores dimensions for a page', () => {
    const store = useFieldStore.getState()
    const dims = makeDims({ scale: 1.5 })
    store.setPageDimensions(1, dims)
    expect(useFieldStore.getState().pageDimensions.get(1)).toEqual(dims)
  })

  it('setPageDimensions replaces the Map identity on each call', () => {
    const store = useFieldStore.getState()
    store.setPageDimensions(1, makeDims({ scale: 1 }))
    const mapAfterFirst = useFieldStore.getState().pageDimensions
    store.setPageDimensions(2, makeDims({ scale: 2 }))
    // A new Map instance must be returned to trigger Zustand re-renders
    expect(useFieldStore.getState().pageDimensions).not.toBe(mapAfterFirst)
    expect(useFieldStore.getState().pageDimensions.get(1)?.scale).toBe(1)
    expect(useFieldStore.getState().pageDimensions.get(2)?.scale).toBe(2)
  })

  // ---------- resetFields ----------

  it('resetFields clears all field-related state to initial values', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.setSelectedFieldId('f1')
    store.setPageDimensions(1, makeDims())
    store.setSignatureDataUrl('data:image/png;base64,abc')
    store.setArmedFieldType('text')
    store.openModal()

    store.resetFields()
    const state = useFieldStore.getState()
    expect(state.fields).toHaveLength(0)
    expect(state.selectedFieldId).toBeNull()
    expect(state.pageDimensions.size).toBe(0)
    expect(state.signatureDataUrl).toBeNull()
    expect(state.armedFieldType).toBeNull()
    expect(state.modalOpen).toBe(false)
    expect(state.initialsDataUrl).toBeNull()
    expect(state.initialsModalOpen).toBe(false)
    expect(state.history).toEqual([])
    expect(state.historyIndex).toBe(-1)
  })

  // ---------- openModal / closeModal ----------

  it('openModal sets modalOpen to true', () => {
    useFieldStore.getState().openModal()
    expect(useFieldStore.getState().modalOpen).toBe(true)
  })

  it('closeModal sets modalOpen to false', () => {
    useFieldStore.getState().openModal()
    useFieldStore.getState().closeModal()
    expect(useFieldStore.getState().modalOpen).toBe(false)
  })

  // ---------- setArmedFieldType (replaces setPlacementMode) ----------

  it('setArmedFieldType sets armedFieldType to a FieldType', () => {
    useFieldStore.getState().setArmedFieldType('text')
    expect(useFieldStore.getState().armedFieldType).toBe('text')
  })

  it('setArmedFieldType(null) clears armedFieldType', () => {
    useFieldStore.getState().setArmedFieldType('signature')
    useFieldStore.getState().setArmedFieldType(null)
    expect(useFieldStore.getState().armedFieldType).toBeNull()
  })

  // ---------- setSignatureDataUrl ----------

  it('setSignatureDataUrl stores the data URL', () => {
    const url = 'data:image/png;base64,abc123'
    useFieldStore.getState().setSignatureDataUrl(url)
    expect(useFieldStore.getState().signatureDataUrl).toBe(url)
  })

  it('setSignatureDataUrl(null) clears the data URL', () => {
    useFieldStore.getState().setSignatureDataUrl('data:image/png;base64,abc')
    useFieldStore.getState().setSignatureDataUrl(null)
    expect(useFieldStore.getState().signatureDataUrl).toBeNull()
  })

  // ---------- new field types (FLD-02) ----------

  it('addField accepts type "initials" with dataUrl (FLD-02)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'i1', type: 'initials', dataUrl: 'data:image/png;base64,xyz' }))
    expect(useFieldStore.getState().fields[0].type).toBe('initials')
  })

  it('addField accepts type "date" with textValue and no dataUrl (FLD-02, FLD-03)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'd1', type: 'date', dataUrl: undefined, textValue: '6/17/2026' }))
    const f = useFieldStore.getState().fields[0]
    expect(f.type).toBe('date')
    expect(f.textValue).toBe('6/17/2026')
    expect(f.dataUrl).toBeUndefined()
  })

  it('addField accepts type "text" with empty textValue and no dataUrl (FLD-02, FLD-04)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 't1', type: 'text', dataUrl: undefined, textValue: '' }))
    const f = useFieldStore.getState().fields[0]
    expect(f.type).toBe('text')
    expect(f.textValue).toBe('')
    expect(f.dataUrl).toBeUndefined()
  })

  it('addField accepts type "checkbox" with no dataUrl and no textValue (FLD-02)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'c1', type: 'checkbox', dataUrl: undefined }))
    const f = useFieldStore.getState().fields[0]
    expect(f.type).toBe('checkbox')
    expect(f.dataUrl).toBeUndefined()
    expect(f.textValue).toBeUndefined()
  })

  it('updateField patching textValue persists (FLD-04)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'tx1', type: 'text', dataUrl: undefined, textValue: '' }))
    store.updateField('tx1', { textValue: 'hello' })
    const f = useFieldStore.getState().fields.find((x) => x.id === 'tx1')
    expect(f?.textValue).toBe('hello')
  })

  // ---------- initials state seam ----------

  it('setInitialsDataUrl stores and clears the initials data URL', () => {
    const store = useFieldStore.getState()
    store.setInitialsDataUrl('data:image/png;base64,initials123')
    expect(useFieldStore.getState().initialsDataUrl).toBe('data:image/png;base64,initials123')
    store.setInitialsDataUrl(null)
    expect(useFieldStore.getState().initialsDataUrl).toBeNull()
  })

  it('openInitialsModal sets initialsModalOpen to true', () => {
    useFieldStore.getState().openInitialsModal()
    expect(useFieldStore.getState().initialsModalOpen).toBe(true)
  })

  it('closeInitialsModal sets initialsModalOpen to false', () => {
    useFieldStore.getState().openInitialsModal()
    useFieldStore.getState().closeInitialsModal()
    expect(useFieldStore.getState().initialsModalOpen).toBe(false)
  })

  // ---------- undo/redo history (FLD-09) ----------

  it('addField pushes history; after one addField then undo, fields.length === 0 (FLD-09)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.undo()
    expect(useFieldStore.getState().fields).toHaveLength(0)
  })

  it('addField then undo then redo restores fields.length === 1 (FLD-09)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.undo()
    store.redo()
    expect(useFieldStore.getState().fields).toHaveLength(1)
  })

  it('deleteField is undoable — add a field, delete it, undo, the field is restored (FLD-09)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    // After addField: fields=[f1], history has 2 snapshots (empty + [f1])
    store.deleteField('f1')
    // After deleteField: fields=[], history has 3 snapshots
    store.undo()
    // After undo: fields=[f1]
    expect(useFieldStore.getState().fields).toHaveLength(1)
    expect(useFieldStore.getState().fields[0].id).toBe('f1')
  })

  it('history cap: 51 pushHistory calls yield history.length <= 50 (FLD-09, MAX_HISTORY)', () => {
    const store = useFieldStore.getState()
    for (let i = 0; i < 51; i++) {
      store.pushHistory()
    }
    expect(useFieldStore.getState().history.length).toBeLessThanOrEqual(50)
  })

  it('new action after undo truncates the redo tail (FLD-09)', () => {
    const store = useFieldStore.getState()
    // Add f1, f2, undo (back to [f1]), add f3
    store.addField(makeField({ id: 'f1' }))
    store.addField(makeField({ id: 'f2' }))
    store.undo() // back to [f1]
    expect(useFieldStore.getState().fields).toHaveLength(1)
    // Adding f3 should truncate the redo tail (f2 state is gone)
    store.addField(makeField({ id: 'f3' }))
    // Now redo should be a no-op (historyIndex is at the end)
    store.redo()
    // After redo no-op, we should still have [f1, f3]
    expect(useFieldStore.getState().fields).toHaveLength(2)
    const ids = useFieldStore.getState().fields.map((f) => f.id)
    expect(ids).toContain('f1')
    expect(ids).toContain('f3')
    expect(ids).not.toContain('f2')
  })

  it('undo at historyIndex <= 0 is a no-op (does not throw, fields unchanged) (FLD-09)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    // Undo twice — second should be a no-op (fields stays as per first undo result)
    store.undo() // fields = []
    store.undo() // no-op
    expect(useFieldStore.getState().fields).toHaveLength(0)
  })

  it('undo/redo clears selectedFieldId (avoids dangling selection) (FLD-09)', () => {
    const store = useFieldStore.getState()
    store.addField(makeField({ id: 'f1' }))
    store.setSelectedFieldId('f1')
    store.undo()
    expect(useFieldStore.getState().selectedFieldId).toBeNull()
    store.redo()
    expect(useFieldStore.getState().selectedFieldId).toBeNull()
  })
})
