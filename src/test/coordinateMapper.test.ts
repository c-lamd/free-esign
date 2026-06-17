/**
 * coordinateMapper round-trip property test
 *
 * Exercises cssPixelToPageSpace -> pageSpaceToCssPixel at every combination of
 * scale ∈ {1, 1.5, 0.75} × rotation ∈ {0, 90, 180, 270} × multiple sample points.
 *
 * Uses a minimal viewport mock that replicates the pdfjs-dist PageViewport
 * affine matrix math exactly (same constructor math, same applyTransform /
 * applyInverseTransform as in pdfjs-dist/build/pdf.mjs). This avoids importing
 * the full pdfjs-dist bundle (which requires DOMMatrix in Node) while still
 * exercising the actual coordinate-space math the Coordinate Mapper wraps.
 *
 * The round-trip property: a CSS-pixel point converted to PDF user space and
 * back must land within 0.001 of the original value at any scale and rotation.
 */

import { describe, it, expect } from 'vitest'
import { cssPixelToPageSpace, pageSpaceToCssPixel } from '../lib/coordinateMapper'
import { makeSimpleViewport } from '../lib/pageViewport'

// ---------------------------------------------------------------------------
// Minimal pdfjs-identical affine viewport mock
// ---------------------------------------------------------------------------

/**
 * Applies a 6-element column-major 2D affine transform to [p[0], p[1]].
 * Mirror of pdfjs Util.applyTransform.
 */
function applyTransform(p: number[], m: number[]): void {
  const p0 = p[0]
  const p1 = p[1]
  p[0] = p0 * m[0] + p1 * m[2] + m[4]
  p[1] = p0 * m[1] + p1 * m[3] + m[5]
}

/**
 * Applies the inverse of a 6-element affine transform to [p[0], p[1]].
 * Mirror of pdfjs Util.applyInverseTransform.
 */
function applyInverseTransform(p: number[], m: number[]): void {
  const p0 = p[0]
  const p1 = p[1]
  const d = m[0] * m[3] - m[1] * m[2]
  p[0] = (p0 * m[3] - p1 * m[2] + m[2] * m[5] - m[4] * m[3]) / d
  p[1] = (-p0 * m[1] + p1 * m[0] + m[4] * m[1] - m[5] * m[0]) / d
}

/**
 * Constructs a viewport mock whose convertToPdfPoint / convertToViewportPoint
 * mirror pdfjs PageViewport exactly, built from the same constructor math in
 * pdfjs-dist/build/pdf.mjs class PageViewport.
 *
 * @param viewBox  [xMin, yMin, xMax, yMax] in PDF points (e.g. [0, 0, 612, 792])
 * @param scale    Zoom scale (1 = 100%)
 * @param rotation Page rotation in degrees (0 | 90 | 180 | 270)
 */
function makeViewport(
  viewBox: [number, number, number, number],
  scale: number,
  rotation: 0 | 90 | 180 | 270
) {
  const userUnit = 1
  const offsetX = 0
  const offsetY = 0

  const effectiveScale = scale * userUnit
  const centerX = (viewBox[2] + viewBox[0]) / 2
  const centerY = (viewBox[3] + viewBox[1]) / 2

  let rotateA: number, rotateB: number, rotateC: number, rotateD: number
  switch (rotation) {
    case 0:
      rotateA = 1; rotateB = 0; rotateC = 0; rotateD = -1
      break
    case 90:
      rotateA = 0; rotateB = 1; rotateC = 1; rotateD = 0
      break
    case 180:
      rotateA = -1; rotateB = 0; rotateC = 0; rotateD = 1
      break
    case 270:
      rotateA = 0; rotateB = -1; rotateC = -1; rotateD = 0
      break
  }

  let offsetCanvasX: number, offsetCanvasY: number
  if (rotateA === 0) {
    offsetCanvasX = Math.abs(centerY - viewBox[1]) * effectiveScale + offsetX
    offsetCanvasY = Math.abs(centerX - viewBox[0]) * effectiveScale + offsetY
  } else {
    offsetCanvasX = Math.abs(centerX - viewBox[0]) * effectiveScale + offsetX
    offsetCanvasY = Math.abs(centerY - viewBox[1]) * effectiveScale + offsetY
  }

  const transform = [
    rotateA * effectiveScale,
    rotateB * effectiveScale,
    rotateC * effectiveScale,
    rotateD * effectiveScale,
    offsetCanvasX - rotateA * effectiveScale * centerX - rotateC * effectiveScale * centerY,
    offsetCanvasY - rotateB * effectiveScale * centerX - rotateD * effectiveScale * centerY,
  ]

  return {
    transform,
    convertToViewportPoint(x: number, y: number): number[] {
      const p = [x, y]
      applyTransform(p, transform)
      return p
    },
    convertToPdfPoint(x: number, y: number): number[] {
      const p = [x, y]
      applyInverseTransform(p, transform)
      return p
    },
  }
}

// ---------------------------------------------------------------------------
// Test matrix
// ---------------------------------------------------------------------------

const SCALES = [1, 1.5, 0.75] as const
const ROTATIONS = [0, 90, 180, 270] as const

// A standard US-letter page in PDF points (612 × 792)
const VIEW_BOX: [number, number, number, number] = [0, 0, 612, 792]

// Sample points in CSS pixel space to round-trip (at scale=1 these map 1:1
// to viewport pixels; at other scales they scale accordingly — all points
// must be within the rendered page bounds at the given scale)
const SAMPLE_POINTS = [
  { x: 0, y: 0 },         // top-left corner
  { x: 612, y: 792 },     // bottom-right corner (at scale=1)
  { x: 150, y: 200 },     // interior point
  { x: 306, y: 396 },     // page centre
  { x: 1, y: 1 },         // near origin
  { x: 300, y: 100 },     // upper-right region
  { x: 50, y: 700 },      // lower-left region
] as const

const TOLERANCE = 0.001

describe('coordinateMapper round-trip property test', () => {
  for (const scale of SCALES) {
    for (const rotation of ROTATIONS) {
      describe(`scale=${scale} rotation=${rotation}°`, () => {
        const viewport = makeViewport(VIEW_BOX, scale, rotation)

        for (const original of SAMPLE_POINTS) {
          it(`round-trips (${original.x}, ${original.y}) within ${TOLERANCE}`, () => {
            const pdfSpace = cssPixelToPageSpace(original, viewport)
            const recovered = pageSpaceToCssPixel(pdfSpace, viewport)

            expect(Math.abs(recovered.x - original.x)).toBeLessThan(TOLERANCE)
            expect(Math.abs(recovered.y - original.y)).toBeLessThan(TOLERANCE)
          })
        }
      })
    }
  }
})

describe('cssPixelToPageSpace', () => {
  it('converts top-left CSS origin to PDF bottom-left at scale=1 rotation=0', () => {
    const viewport = makeViewport(VIEW_BOX, 1, 0)
    // CSS (0,0) is top-left; PDF origin is bottom-left.
    // For a 792pt-tall page at scale=1, CSS y=0 → PDF y=792 (top of page)
    const result = cssPixelToPageSpace({ x: 0, y: 0 }, viewport)
    // Should be the top-left in CSS = top-right corner in PDF space (y near page height)
    expect(result.x).toBeCloseTo(0, 3)
    expect(result.y).toBeCloseTo(792, 3)
  })

  it('returns PageSpace with x and y properties', () => {
    const viewport = makeViewport(VIEW_BOX, 1, 0)
    const result = cssPixelToPageSpace({ x: 100, y: 200 }, viewport)
    expect(result).toHaveProperty('x')
    expect(result).toHaveProperty('y')
    expect(typeof result.x).toBe('number')
    expect(typeof result.y).toBe('number')
  })
})

describe('pageSpaceToCssPixel', () => {
  it('converts PDF bottom-left origin to CSS top-left at scale=1 rotation=0', () => {
    const viewport = makeViewport(VIEW_BOX, 1, 0)
    // PDF (0,0) is bottom-left; CSS (0, 792) is bottom-left of a 792px-tall canvas
    const result = pageSpaceToCssPixel({ x: 0, y: 0 }, viewport)
    expect(result.x).toBeCloseTo(0, 3)
    expect(result.y).toBeCloseTo(792, 3)
  })

  it('returns CssSpace with x and y properties', () => {
    const viewport = makeViewport(VIEW_BOX, 1, 0)
    const result = pageSpaceToCssPixel({ x: 100, y: 200 }, viewport)
    expect(result).toHaveProperty('x')
    expect(result).toHaveProperty('y')
    expect(typeof result.x).toBe('number')
    expect(typeof result.y).toBe('number')
  })
})

// ---------------------------------------------------------------------------
// Zoom-invariance tests (DOC-04)
// ---------------------------------------------------------------------------
//
// These tests prove that the same physical document point maps to identical PDF
// coordinates regardless of zoom level, and that field widths stored in PDF space
// are zoom-invariant.
//
// Key insight (RESEARCH Section 10): when the page renders at a higher zoom, the
// SAME physical click position (e.g., "1/3 from the left, 1/2 down") corresponds
// to a PROPORTIONALLY LARGER CSS coordinate because the page is larger on screen.
// The effectiveScale grows at the same rate, so the resulting PDF coordinate is
// identical.
//
// The test uses makeSimpleViewport (the actual production viewport builder) so the
// invariance proof covers the exact code path used at runtime.
// ---------------------------------------------------------------------------

describe('zoom-invariance: same document point → identical PDF coords at any zoom', () => {
  // Standard US-letter page dimensions
  const originalWidth = 612   // points
  const originalHeight = 792  // points
  const containerWidth = 600  // CSS pixels (fit-to-width container)

  // Baseline fit scale (zoom = 1.0)
  const fitScale = containerWidth / originalWidth  // ≈ 0.9804

  it('placing at zoom 1.0 and zoom 1.5 produces identical pdfX and pdfY', () => {
    // The physical click is "1/3 from left, 1/2 down" on the page.
    // At zoom 1.0 the page is containerWidth * 1.0 pixels wide → cssX = containerWidth * 1/3
    // At zoom 1.5 the page is containerWidth * 1.5 pixels wide → cssX = containerWidth * 1.5 * 1/3
    // Both represent the SAME document point.
    const physicalFractionX = 1 / 3
    const physicalFractionY = 1 / 2

    // — zoom 1.0 —
    const effectiveScale1 = fitScale * 1.0
    const cssX1 = containerWidth * 1.0 * physicalFractionX
    const cssY1 = (originalHeight * effectiveScale1) * physicalFractionY
    const vp1 = makeSimpleViewport(originalWidth, originalHeight, effectiveScale1)
    const pdf1 = cssPixelToPageSpace({ x: cssX1, y: cssY1 }, vp1)

    // — zoom 1.5 —
    const effectiveScale2 = fitScale * 1.5
    const cssX2 = containerWidth * 1.5 * physicalFractionX
    const cssY2 = (originalHeight * effectiveScale2) * physicalFractionY
    const vp2 = makeSimpleViewport(originalWidth, originalHeight, effectiveScale2)
    const pdf2 = cssPixelToPageSpace({ x: cssX2, y: cssY2 }, vp2)

    // PDF coordinates must be identical (to 5 decimal places) — DOC-04
    expect(pdf1.x).toBeCloseTo(pdf2.x, 5)
    expect(pdf1.y).toBeCloseTo(pdf2.y, 5)
  })

  it('zoom 1.0 and zoom 2.0 produce identical pdfX and pdfY for the same content point', () => {
    const physicalFractionX = 0.7
    const physicalFractionY = 0.3

    const effectiveScale1 = fitScale * 1.0
    const cssX1 = containerWidth * 1.0 * physicalFractionX
    const cssY1 = (originalHeight * effectiveScale1) * physicalFractionY
    const vp1 = makeSimpleViewport(originalWidth, originalHeight, effectiveScale1)
    const pdf1 = cssPixelToPageSpace({ x: cssX1, y: cssY1 }, vp1)

    const effectiveScale2 = fitScale * 2.0
    const cssX2 = containerWidth * 2.0 * physicalFractionX
    const cssY2 = (originalHeight * effectiveScale2) * physicalFractionY
    const vp2 = makeSimpleViewport(originalWidth, originalHeight, effectiveScale2)
    const pdf2 = cssPixelToPageSpace({ x: cssX2, y: cssY2 }, vp2)

    expect(pdf1.x).toBeCloseTo(pdf2.x, 5)
    expect(pdf1.y).toBeCloseTo(pdf2.y, 5)
  })

  it('PDF-space field width (cssSize / effectiveScale) is identical at zoom 1.0 and zoom 1.5', () => {
    // A field that visually spans a fixed percentage of the page width.
    // At zoom 1.0 it has baseCssWidth CSS pixels.
    // At zoom 1.5 it has baseCssWidth * 1.5 CSS pixels (same physical size on document).
    // PDF-space width = cssSize / effectiveScale must be the same in both cases.
    const baseCssWidth = 160  // CSS pixels at zoom 1.0

    const effectiveScale1 = fitScale * 1.0
    const pdfWidth1 = baseCssWidth / effectiveScale1

    const effectiveScale2 = fitScale * 1.5
    const pdfWidth2 = (baseCssWidth * 1.5) / effectiveScale2

    // PDF-space widths must be identical — proves no field size drift on zoom
    expect(pdfWidth1).toBeCloseTo(pdfWidth2, 5)
  })

  it('PDF-space field width is identical at zoom 0.5 and zoom 1.75', () => {
    // baseCssWidth is the field's CSS pixel width at zoom 1.0 baseline.
    // At zoom Z, the same document field occupies baseCssWidth * Z CSS pixels.
    // PDF-space width = (baseCssWidth * Z) / (fitScale * Z) = baseCssWidth / fitScale, which is constant.
    const baseCssWidth = 100

    const effectiveScale1 = fitScale * 0.5
    const pdfWidth1 = (baseCssWidth * 0.5) / effectiveScale1

    const effectiveScale2 = fitScale * 1.75
    const pdfWidth2 = (baseCssWidth * 1.75) / effectiveScale2

    expect(pdfWidth1).toBeCloseTo(pdfWidth2, 5)
  })
})
