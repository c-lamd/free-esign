import { create } from 'zustand'

export type ViewState = 'landing' | 'empty' | 'loading' | 'error' | 'loaded'

/**
 * Discrete zoom steps for document zoom (50–200%).
 * Shared between documentStore and ZoomControl — import from this module.
 */
export const ZOOM_STEPS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0] as const
export type ZoomStep = (typeof ZOOM_STEPS)[number]

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
  /**
   * Original filename (e.g. 'report.pdf', 'photo.png').
   * Used by the download handler to produce the signed filename via signedFilename().
   */
  fileName: string | null
  /**
   * Inline export error message shown by ExportErrorBanner.
   * Null when no export error is present.
   * Set on exportSignedPdf failure; cleared at the start of each download attempt.
   */
  exportError: string | null

  /**
   * Document zoom multiplier.
   * Default 1.0 (fit-to-width). Range 0.5–2.0 using ZOOM_STEPS.
   * Used to compute effectiveScale in LazyPage; stored PDF coords are never mutated on zoom.
   */
  zoom: number

  goToLanding: () => void
  startSigning: () => void
  setView: (v: ViewState) => void
  loadDocument: (url: string) => void
  setNumPages: (n: number) => void
  setCurrentPage: (n: number) => void
  setError: (msg: string) => void
  setOriginalPdfBytes: (bytes: ArrayBuffer | null) => void
  setFileName: (name: string | null) => void
  setExportError: (msg: string | null) => void
  setZoom: (z: number) => void
  reset: () => void
}

export const useDocumentStore = create<DocumentStore>()((set) => ({
  view: 'landing',
  docUrl: null,
  numPages: null,
  currentPage: 1,
  errorMessage: null,
  originalPdfBytes: null,
  fileName: null,
  exportError: null,
  zoom: 1.0,

  goToLanding: () => set({ view: 'landing' }),
  startSigning: () => set({ view: 'empty' }),
  setView: (view) => set({ view }),
  loadDocument: (url) => set({ docUrl: url, view: 'loading', errorMessage: null }),
  setNumPages: (numPages) => set({ numPages, view: 'loaded' }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setError: (errorMessage) => set({ errorMessage, view: 'error' }),
  setOriginalPdfBytes: (originalPdfBytes) => set({ originalPdfBytes }),
  setFileName: (fileName) => set({ fileName }),
  setExportError: (exportError) => set({ exportError }),
  setZoom: (zoom) => {
    // Guard: ignore values not in ZOOM_STEPS to prevent stuck zoom buttons
    // when zoom holds an out-of-range value (indexOf returns -1 in ZoomControl).
    if (!ZOOM_STEPS.includes(zoom as ZoomStep)) return
    set({ zoom })
  },
  reset: () =>
    set({
      view: 'empty',
      docUrl: null,
      numPages: null,
      currentPage: 1,
      errorMessage: null,
      originalPdfBytes: null,
      fileName: null,
      exportError: null,
      zoom: 1.0,
    }),
}))
