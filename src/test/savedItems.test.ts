/**
 * savedItems.test.ts
 *
 * Tests for the savedItems slice and armedTypedPayload seam in fieldStore.
 * Covers SIG-04 (load/persist) and SIG-05 (delete).
 *
 * MUST mock idb-keyval before any import that transitively imports it —
 * jsdom has no IndexedDB implementation (RESEARCH Pitfall 4).
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock idb-keyval at module level BEFORE importing fieldStore
// Vitest hoists vi.mock calls so this intercepts the import correctly.
vi.mock('idb-keyval', () => ({
  get: vi.fn().mockResolvedValue(undefined),
  set: vi.fn().mockResolvedValue(undefined),
  del: vi.fn().mockResolvedValue(undefined),
}))

import * as idbKeyval from 'idb-keyval'
import { useFieldStore, type SavedItem } from '../store/fieldStore'

/** Build a minimal SavedItem for tests */
function makeItem(overrides: Partial<SavedItem> = {}): SavedItem {
  return {
    id: crypto.randomUUID(),
    kind: 'signature',
    source: 'typed',
    text: 'John Smith',
    fontFamily: 'Dancing Script',
    createdAt: Date.now(),
    ...overrides,
  }
}

describe('savedItems slice', () => {
  beforeEach(() => {
    useFieldStore.getState().resetFields()
    vi.clearAllMocks()
    // Restore default mock resolved values after clearAllMocks
    vi.mocked(idbKeyval.get).mockResolvedValue(undefined)
    vi.mocked(idbKeyval.set).mockResolvedValue(undefined)
  })

  // ---------- addSavedItem (SIG-04 persist) ----------

  it('addSavedItem increases savedItems.length by 1 and calls idb-keyval set', async () => {
    const store = useFieldStore.getState()
    const item = makeItem({ id: 'i1' })
    await store.addSavedItem(item)
    expect(useFieldStore.getState().savedItems).toHaveLength(1)
    expect(useFieldStore.getState().savedItems[0].id).toBe('i1')
    expect(idbKeyval.set).toHaveBeenCalledOnce()
  })

  it('addSavedItem prepends item — newest-first order', async () => {
    const store = useFieldStore.getState()
    await store.addSavedItem(makeItem({ id: 'old' }))
    await store.addSavedItem(makeItem({ id: 'new' }))
    const ids = useFieldStore.getState().savedItems.map((i) => i.id)
    expect(ids[0]).toBe('new')
    expect(ids[1]).toBe('old')
  })

  it('addSavedItem calls idb-keyval set with savedSignatureItems key', async () => {
    const store = useFieldStore.getState()
    const item = makeItem({ id: 'i2' })
    await store.addSavedItem(item)
    expect(idbKeyval.set).toHaveBeenCalledWith('savedSignatureItems', expect.any(Array))
  })

  // ---------- loadSavedItems (SIG-04 hydrate) ----------

  it('loadSavedItems hydrates savedItems from idb-keyval get result', async () => {
    const stored = [makeItem({ id: 'stored1' }), makeItem({ id: 'stored2' })]
    vi.mocked(idbKeyval.get).mockResolvedValueOnce(stored)

    await useFieldStore.getState().loadSavedItems()

    expect(useFieldStore.getState().savedItems).toHaveLength(2)
    expect(useFieldStore.getState().savedItems[0].id).toBe('stored1')
    expect(useFieldStore.getState().savedItems[1].id).toBe('stored2')
  })

  it('loadSavedItems sets savedItems to empty array when get resolves undefined', async () => {
    vi.mocked(idbKeyval.get).mockResolvedValueOnce(undefined)

    await useFieldStore.getState().loadSavedItems()

    expect(useFieldStore.getState().savedItems).toEqual([])
  })

  it('loadSavedItems calls idb-keyval get with savedSignatureItems key', async () => {
    await useFieldStore.getState().loadSavedItems()
    expect(idbKeyval.get).toHaveBeenCalledWith('savedSignatureItems')
  })

  // ---------- deleteSavedItem (SIG-05) ----------

  it('deleteSavedItem removes item from savedItems state and calls idb-keyval set', async () => {
    const store = useFieldStore.getState()
    const item = makeItem({ id: 'del1' })
    await store.addSavedItem(item)
    vi.clearAllMocks()
    vi.mocked(idbKeyval.set).mockResolvedValue(undefined)

    await store.deleteSavedItem('del1')

    expect(useFieldStore.getState().savedItems).toHaveLength(0)
    expect(idbKeyval.set).toHaveBeenCalledOnce()
  })

  it('deleteSavedItem only removes the targeted item', async () => {
    const store = useFieldStore.getState()
    await store.addSavedItem(makeItem({ id: 'keep' }))
    await store.addSavedItem(makeItem({ id: 'remove' }))
    vi.clearAllMocks()
    vi.mocked(idbKeyval.set).mockResolvedValue(undefined)

    await store.deleteSavedItem('remove')

    expect(useFieldStore.getState().savedItems).toHaveLength(1)
    expect(useFieldStore.getState().savedItems[0].id).toBe('keep')
  })

  // ---------- setArmedTypedPayload ----------

  it('setArmedTypedPayload sets armedTypedPayload', () => {
    const payload = { text: 'Alice', fontFamily: 'Great Vibes', kind: 'signature' as const }
    useFieldStore.getState().setArmedTypedPayload(payload)
    expect(useFieldStore.getState().armedTypedPayload).toEqual(payload)
  })

  it('setArmedTypedPayload(null) clears armedTypedPayload', () => {
    const payload = { text: 'Alice', fontFamily: 'Great Vibes', kind: 'signature' as const }
    useFieldStore.getState().setArmedTypedPayload(payload)
    useFieldStore.getState().setArmedTypedPayload(null)
    expect(useFieldStore.getState().armedTypedPayload).toBeNull()
  })

  it('setArmedTypedPayload works with kind "initials"', () => {
    const payload = { text: 'AB', fontFamily: 'Pacifico', kind: 'initials' as const }
    useFieldStore.getState().setArmedTypedPayload(payload)
    expect(useFieldStore.getState().armedTypedPayload?.kind).toBe('initials')
  })

  // ---------- resetFields does NOT clear savedItems ----------

  it('resetFields leaves savedItems untouched (persistence is document-independent)', async () => {
    await useFieldStore.getState().addSavedItem(makeItem({ id: 'persisted' }))
    expect(useFieldStore.getState().savedItems).toHaveLength(1)

    useFieldStore.getState().resetFields()

    // savedItems should NOT be cleared by resetFields
    expect(useFieldStore.getState().savedItems).toHaveLength(1)
    expect(useFieldStore.getState().savedItems[0].id).toBe('persisted')
  })

  it('resetFields clears armedTypedPayload', () => {
    useFieldStore.getState().setArmedTypedPayload({
      text: 'test',
      fontFamily: 'Pacifico',
      kind: 'signature',
    })
    useFieldStore.getState().resetFields()
    expect(useFieldStore.getState().armedTypedPayload).toBeNull()
  })
})
