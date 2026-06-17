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
    store.setPlacementMode(true)
    store.openModal()

    store.resetFields()
    const state = useFieldStore.getState()
    expect(state.fields).toHaveLength(0)
    expect(state.selectedFieldId).toBeNull()
    expect(state.pageDimensions.size).toBe(0)
    expect(state.signatureDataUrl).toBeNull()
    expect(state.placementMode).toBe(false)
    expect(state.modalOpen).toBe(false)
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

  // ---------- setPlacementMode ----------

  it('setPlacementMode toggles placementMode', () => {
    useFieldStore.getState().setPlacementMode(true)
    expect(useFieldStore.getState().placementMode).toBe(true)
    useFieldStore.getState().setPlacementMode(false)
    expect(useFieldStore.getState().placementMode).toBe(false)
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
})
