import { describe, it, expect, beforeEach } from 'vitest'
import { useDocumentStore, ZOOM_STEPS } from '../store/documentStore'

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
    expect(state.zoom).toBe(1.0)
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
    store.setZoom(1.5)
    store.reset()
    const state = useDocumentStore.getState()
    expect(state.view).toBe('empty')
    expect(state.docUrl).toBeNull()
    expect(state.numPages).toBeNull()
    expect(state.currentPage).toBe(1)
    expect(state.originalPdfBytes).toBeNull()
    expect(state.fileName).toBeNull()
    expect(state.exportError).toBeNull()
    expect(state.zoom).toBe(1.0)
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

  it('setZoom updates zoom to 1.5', () => {
    const store = useDocumentStore.getState()
    store.setZoom(1.5)
    expect(useDocumentStore.getState().zoom).toBe(1.5)
  })

  it('ZOOM_STEPS equals [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0]', () => {
    expect(Array.from(ZOOM_STEPS)).toEqual([0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0])
  })

  it('stepping up from 1.0 via ZOOM_STEPS yields 1.25', () => {
    const idx = ZOOM_STEPS.indexOf(1.0)
    const next = idx >= 0 && idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : 1.0
    expect(next).toBe(1.25)
  })

  it('stepping up from 2.0 (max) stays 2.0', () => {
    const idx = ZOOM_STEPS.indexOf(2.0)
    const next = idx >= 0 && idx < ZOOM_STEPS.length - 1 ? ZOOM_STEPS[idx + 1] : 2.0
    expect(next).toBe(2.0)
  })

  it('stepping down from 1.0 yields 0.75', () => {
    const idx = ZOOM_STEPS.indexOf(1.0)
    const prev = idx > 0 ? ZOOM_STEPS[idx - 1] : 1.0
    expect(prev).toBe(0.75)
  })

  it('stepping down from 0.5 (min) stays 0.5', () => {
    const idx = ZOOM_STEPS.indexOf(0.5)
    const prev = idx > 0 ? ZOOM_STEPS[idx - 1] : 0.5
    expect(prev).toBe(0.5)
  })
})
