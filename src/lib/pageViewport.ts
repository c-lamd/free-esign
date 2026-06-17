/**
 * pageViewport.ts — Simple viewport builder for rotation=0 PDF pages.
 *
 * Provides a Coordinate-Mapper-compatible viewport object (duck-typed — matches
 * the structural interfaces in coordinateMapper.ts) built from the page's
 * originalWidth, originalHeight, and render scale.
 *
 * The affine math for rotation=0 only:
 *   PDF space:  origin bottom-left, y increases upward (points)
 *   CSS space:  origin top-left,    y increases downward (pixels)
 *
 *   pdfX  = cssX / scale
 *   pdfY  = originalHeight - cssY / scale          (Y-axis flip)
 *   cssX  = pdfX * scale
 *   cssY  = (originalHeight - pdfY) * scale         (Y-axis flip)
 *
 * NOTE: rotation=0 only. Rotated pages (90°/180°/270°) are deferred to Phase 3
 * (RESEARCH A4). For rotated pages the full pdfjs PageViewport affine matrix is
 * required — makeSimpleViewport will produce incorrect coordinates for those pages.
 *
 * @see 02-RESEARCH.md Pattern 2 (makeSimpleViewport)
 * @see src/lib/coordinateMapper.ts (consumer)
 */

/**
 * Build a Coordinate-Mapper-compatible viewport for a rotation=0 PDF page.
 *
 * @param originalWidth  PDF page width in PDF points at scale 1 (from react-pdf
 *                       Page onLoadSuccess: `page.originalWidth`).
 * @param originalHeight PDF page height in PDF points at scale 1 (from react-pdf
 *                       Page onLoadSuccess: `page.originalHeight`).
 * @param scale          Render scale = containerWidth / originalWidth.
 * @returns              Viewport with convertToPdfPoint and convertToViewportPoint
 *                       compatible with coordinateMapper.ts.
 */
export function makeSimpleViewport(
  // originalWidth is part of the positional API (callers pass page.originalWidth)
  // but the rotation=0 affine only needs height + scale; prefix to satisfy noUnusedParameters.
  _originalWidth: number,
  originalHeight: number,
  scale: number,
) {
  return {
    /** Render scale — exposed so callers can compute CSS dimensions from PDF widths. */
    scale,

    /**
     * CSS pixel → PDF user space (rotation=0).
     * Maps CSS top-left origin to PDF bottom-left origin.
     * Returns [pdfX, pdfY] matching pdfjs PageViewport.convertToPdfPoint.
     */
    convertToPdfPoint(cssX: number, cssY: number): number[] {
      return [cssX / scale, originalHeight - cssY / scale]
    },

    /**
     * PDF user space → CSS pixel (rotation=0).
     * Maps PDF bottom-left origin to CSS top-left origin.
     * Returns [cssX, cssY] matching pdfjs PageViewport.convertToViewportPoint.
     */
    convertToViewportPoint(pdfX: number, pdfY: number): number[] {
      return [pdfX * scale, (originalHeight - pdfY) * scale]
    },
  }
}

/** Type of the viewport returned by makeSimpleViewport. */
export type SimpleViewport = ReturnType<typeof makeSimpleViewport>
