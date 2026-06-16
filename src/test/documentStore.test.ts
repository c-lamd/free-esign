import { describe, it, expect, beforeEach } from 'vitest'
import { useDocumentStore } from '../store/documentStore'

describe('documentStore', () => {
  beforeEach(() => {
    // Reset store to initial state before each test
    useDocumentStore.getState().reset()
  })

  it('has initial state of empty view', () => {
    const state = useDocumentStore.getState()
    expect(state.view).toBe('empty')
    expect(state.docUrl).toBeNull()
    expect(state.numPages).toBeNull()
    expect(state.currentPage).toBe(1)
    expect(state.errorMessage).toBeNull()
  })

  it('loadDocument sets docUrl and transitions to loading', () => {
    const store = useDocumentStore.getState()
    store.loadDocument('blob:test-url')
    const state = useDocumentStore.getState()
    expect(state.docUrl).toBe('blob:test-url')
    expect(state.view).toBe('loading')
    expect(state.errorMessage).toBeNull()
  })

  it('setNumPages transitions to loaded', () => {
    const store = useDocumentStore.getState()
    store.loadDocument('blob:test-url')
    store.setNumPages(5)
    const state = useDocumentStore.getState()
    expect(state.numPages).toBe(5)
    expect(state.view).toBe('loaded')
  })

  it('setError transitions to error', () => {
    const store = useDocumentStore.getState()
    store.setError('file corrupt')
    const state = useDocumentStore.getState()
    expect(state.errorMessage).toBe('file corrupt')
    expect(state.view).toBe('error')
  })

  it('reset returns to empty state', () => {
    const store = useDocumentStore.getState()
    store.loadDocument('blob:test-url')
    store.setNumPages(3)
    store.reset()
    const state = useDocumentStore.getState()
    expect(state.view).toBe('empty')
    expect(state.docUrl).toBeNull()
    expect(state.numPages).toBeNull()
    expect(state.currentPage).toBe(1)
  })

  it('setCurrentPage updates currentPage', () => {
    const store = useDocumentStore.getState()
    store.setCurrentPage(3)
    expect(useDocumentStore.getState().currentPage).toBe(3)
  })
})
