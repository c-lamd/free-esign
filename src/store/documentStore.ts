import { create } from 'zustand'

export type ViewState = 'empty' | 'loading' | 'error' | 'loaded'

export interface DocumentStore {
  view: ViewState
  docUrl: string | null
  numPages: number | null
  currentPage: number
  errorMessage: string | null
  /**
   * Raw bytes of the currently opened PDF (or the PDF wrapping an image).
   * Stored when a file is opened so exportSignedPdf() can read the original
   * bytes without needing to re-read from a Blob URL (Pitfall 5 — Blob URLs
   * cannot recover the underlying bytes after creation).
   */
  originalPdfBytes: ArrayBuffer | null

  setView: (v: ViewState) => void
  loadDocument: (url: string) => void
  setNumPages: (n: number) => void
  setCurrentPage: (n: number) => void
  setError: (msg: string) => void
  setOriginalPdfBytes: (bytes: ArrayBuffer | null) => void
  reset: () => void
}

export const useDocumentStore = create<DocumentStore>()((set) => ({
  view: 'empty',
  docUrl: null,
  numPages: null,
  currentPage: 1,
  errorMessage: null,
  originalPdfBytes: null,

  setView: (view) => set({ view }),
  loadDocument: (url) => set({ docUrl: url, view: 'loading', errorMessage: null }),
  setNumPages: (numPages) => set({ numPages, view: 'loaded' }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setError: (errorMessage) => set({ errorMessage, view: 'error' }),
  setOriginalPdfBytes: (originalPdfBytes) => set({ originalPdfBytes }),
  reset: () =>
    set({
      view: 'empty',
      docUrl: null,
      numPages: null,
      currentPage: 1,
      errorMessage: null,
      originalPdfBytes: null,
    }),
}))
