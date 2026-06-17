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
    expect(state.originalPdfBytes).toBeNull()
    expect(state.fileName).toBeNull()
    expect(state.exportError).toBeNull()
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
    store.setFileName('report.pdf')
    store.setOriginalPdfBytes(new ArrayBuffer(8))
    store.setExportError('something went wrong')
    store.reset()
    const state = useDocumentStore.getState()
    expect(state.view).toBe('empty')
    expect(state.docUrl).toBeNull()
    expect(state.numPages).toBeNull()
    expect(state.currentPage).toBe(1)
    expect(state.originalPdfBytes).toBeNull()
    expect(state.fileName).toBeNull()
    expect(state.exportError).toBeNull()
  })

  it('setCurrentPage updates currentPage', () => {
    const store = useDocumentStore.getState()
    store.setCurrentPage(3)
    expect(useDocumentStore.getState().currentPage).toBe(3)
  })

  it('setFileName stores the filename', () => {
    const store = useDocumentStore.getState()
    store.setFileName('document.pdf')
    expect(useDocumentStore.getState().fileName).toBe('document.pdf')
  })

  it('setExportError stores and clears the export error', () => {
    const store = useDocumentStore.getState()
    store.setExportError('Could not export the signed PDF. Try downloading again.')
    expect(useDocumentStore.getState().exportError).toBe(
      'Could not export the signed PDF. Try downloading again.',
    )
    store.setExportError(null)
    expect(useDocumentStore.getState().exportError).toBeNull()
  })

  it('setOriginalPdfBytes stores the pdf bytes', () => {
    const store = useDocumentStore.getState()
    const buf = new ArrayBuffer(16)
    store.setOriginalPdfBytes(buf)
    expect(useDocumentStore.getState().originalPdfBytes).toBe(buf)
  })
})
