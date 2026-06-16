import { create } from 'zustand'

export type ViewState = 'empty' | 'loading' | 'error' | 'loaded'

export interface DocumentStore {
  view: ViewState
  docUrl: string | null
  numPages: number | null
  currentPage: number
  errorMessage: string | null

  setView: (v: ViewState) => void
  loadDocument: (url: string) => void
  setNumPages: (n: number) => void
  setCurrentPage: (n: number) => void
  setError: (msg: string) => void
  reset: () => void
}

export const useDocumentStore = create<DocumentStore>()((set) => ({
  view: 'empty',
  docUrl: null,
  numPages: null,
  currentPage: 1,
  errorMessage: null,

  setView: (view) => set({ view }),
  loadDocument: (url) => set({ docUrl: url, view: 'loading', errorMessage: null }),
  setNumPages: (numPages) => set({ numPages, view: 'loaded' }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setError: (errorMessage) => set({ errorMessage, view: 'error' }),
  reset: () =>
    set({
      view: 'empty',
      docUrl: null,
      numPages: null,
      currentPage: 1,
      errorMessage: null,
    }),
}))
