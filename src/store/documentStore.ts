import { create } from 'zustand'

export type ViewState = 'landing' | 'empty' | 'loading' | 'error' | 'loaded'

/** Continuous zoom range (10%–200%). Clamped in setZoom. */
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 2.0
export const ZOOM_KEY_STEP = 0.05

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
   * Default 1.0 (fit-to-width). Continuous range 0.1–2.0 (clamped).
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
  // Go straight to 'loaded' so <DocumentViewer> mounts immediately. DocumentViewer
  // owns the react-pdf <Document>, and <Document>'s onLoadSuccess is the ONLY thing
  // that transitions into 'loaded' (via setNumPages). Routing through a standalone
  // top-level 'loading' view here gates DocumentViewer OUT of the tree, so <Document>
  // never mounts, onLoadSuccess never fires, and the spinner hangs forever (the
  // perpetual-loading deadlock). Parse-time spinner is handled internally by
  // <Document loading={<LoadingSpinner/>}>. The top-level 'loading' view is used
  // ONLY for the async image-wrap gap (UploadZone sets it via setView before docUrl exists).
  loadDocument: (url) => set((s) => { if (s.docUrl && s.docUrl !== url) URL.revokeObjectURL(s.docUrl); return { docUrl: url, view: 'loaded', errorMessage: null } }),
  setNumPages: (numPages) => set({ numPages, view: 'loaded' }),
  setCurrentPage: (currentPage) => set({ currentPage }),
  setError: (errorMessage) => set({ errorMessage, view: 'error' }),
  setOriginalPdfBytes: (originalPdfBytes) => set({ originalPdfBytes }),
  setFileName: (fileName) => set({ fileName }),
  setExportError: (exportError) => set({ exportError }),
  setZoom: (zoom) => set({ zoom: Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom)) }),
  reset: () =>
    set((s) => {
      if (s.docUrl) URL.revokeObjectURL(s.docUrl)
      return {
        view: 'empty',
        docUrl: null,
        numPages: null,
        currentPage: 1,
        errorMessage: null,
        originalPdfBytes: null,
        fileName: null,
        exportError: null,
        zoom: 1.0,
      }
    }),
}))
