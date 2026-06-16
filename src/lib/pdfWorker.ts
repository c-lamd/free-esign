import { pdfjs } from 'react-pdf'

// Set the worker source to the self-hosted copy in public/
// Avoids CDN fallback (PRV-02). Must be imported before any react-pdf Document/Page usage.
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export const pdfOptions = {
  cMapUrl: '/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/standard_fonts/',
} as const
