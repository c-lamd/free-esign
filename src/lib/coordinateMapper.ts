/**
 * Coordinate Mapper — pure TypeScript module (no React, no DOM, no network)
 *
 * Converts between CSS pixel space (top-left origin, as rendered by react-pdf)
 * and PDF user space (bottom-left origin, points at 72 DPI) at any zoom scale
 * and page rotation.
 *
 * This is a thin, typed wrapper over pdfjs-dist's PageViewport methods:
 *   viewport.convertToPdfPoint(x, y)      — CSS px → PDF user space
 *   viewport.convertToViewportPoint(x, y) — PDF user space → CSS px
 *
 * The viewport is passed by the caller (obtained from pdfPage.getViewport({
 * scale, rotation }) in Phase 2). Both parameters are typed structurally so
 * callers can pass either a real pdfjs PageViewport or a compatible object.
 *
 * RESEARCH reference: "The pdfjs-dist PageViewport IS the implementation — the
 * Coordinate Mapper is just a typed, testable wrapper." (01-RESEARCH.md Pattern 5)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * A point in PDF user space.
 * Origin: bottom-left of the page.
 * Units: PDF points (72 points = 1 inch at scale 1).
 */
export interface PageSpace {
  /** Horizontal position from the left edge of the PDF page, in points. */
  x: number
  /** Vertical position from the bottom edge of the PDF page, in points. */
  y: number
}

/**
 * A point in CSS pixel space, as reported by react-pdf's rendered canvas.
 * Origin: top-left of the rendered page canvas.
 * Units: CSS pixels at the current scale.
 */
export interface CssSpace {
  /** Horizontal position from the left edge of the rendered canvas, in CSS px. */
  x: number
  /** Vertical position from the top edge of the rendered canvas, in CSS px. */
  y: number
}

// ---------------------------------------------------------------------------
// Structural viewport types (duck-typed — accept real pdfjs PageViewport or mock)
// ---------------------------------------------------------------------------

/** Minimal interface required for CSS pixel → PDF space conversion. */
interface ViewportWithToPdf {
  convertToPdfPoint(x: number, y: number): number[]
}

/** Minimal interface required for PDF space → CSS pixel conversion. */
interface ViewportWithToViewport {
  convertToViewportPoint(x: number, y: number): number[]
}

// ---------------------------------------------------------------------------
// Conversion functions
// ---------------------------------------------------------------------------

/**
 * Convert a CSS-pixel coordinate (top-left origin) to PDF user space
 * (bottom-left origin, points).
 *
 * @param css      The point in CSS pixel space (x, y from top-left of canvas).
 * @param viewport A pdfjs PageViewport (or compatible object) obtained from
 *                 `pdfPage.getViewport({ scale, rotation })`.
 * @returns        The corresponding point in PDF user space.
 */
export function cssPixelToPageSpace(
  css: CssSpace,
  viewport: ViewportWithToPdf
): PageSpace {
  const [pdfX, pdfY] = viewport.convertToPdfPoint(css.x, css.y)
  return { x: pdfX, y: pdfY }
}

/**
 * Convert a PDF user-space coordinate (bottom-left origin, points) to CSS
 * pixel space (top-left origin) at the current scale and rotation.
 *
 * @param pdf      The point in PDF user space (x, y from bottom-left of page).
 * @param viewport A pdfjs PageViewport (or compatible object) obtained from
 *                 `pdfPage.getViewport({ scale, rotation })`.
 * @returns        The corresponding point in CSS pixel space.
 */
export function pageSpaceToCssPixel(
  pdf: PageSpace,
  viewport: ViewportWithToViewport
): CssSpace {
  const [cssX, cssY] = viewport.convertToViewportPoint(pdf.x, pdf.y)
  return { x: cssX, y: cssY }
}
