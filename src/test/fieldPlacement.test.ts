/**
 * fieldPlacement.test.ts — coordinate round-trip tests for click → PDF-space → CSS.
 *
 * Uses makeSimpleViewport (rotation=0) with cssPixelToPageSpace / pageSpaceToCssPixel
 * from the Coordinate Mapper to verify that a CSS click point round-trips through
 * PDF space and back within 0.001 across multiple scales.
 *
 * Mirrors the structure of coordinateMapper.test.ts (which tests all rotations);
 * this file focuses on the makeSimpleViewport path used by the placement handler.
 *
 * @see src/lib/pageViewport.ts (makeSimpleViewport)
 * @see src/lib/coordinateMapper.ts (cssPixelToPageSpace / pageSpaceToCssPixel)
 * @see 02-03-PLAN.md Task 1
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { makeSimpleViewport } from '../lib/pageViewport'
import { cssPixelToPageSpace, pageSpaceToCssPixel } from '../lib/coordinateMapper'
import { useFieldStore } from '../store/fieldStore'
import type { PlacedField } from '../store/fieldStore'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOLERANCE = 0.001

// Sample page dimensions (A4 in PDF points: 595 × 842; US Letter: 612 × 792)
const ORIGINAL_WIDTH = 612   // PDF points
const ORIGINAL_HEIGHT = 792  // PDF points

// Sample scales to test: 1× (100%), 1.5× (150%), 0.75× (75%)
const SCALES = [1, 1.5, 0.75] as const

// Sample CSS pixel points — in CSS space (top-left origin)
// Points must be within the rendered page bounds at scale=1.
// At other scales the coordinate system shifts, but the math still holds.
const SAMPLE_CSS_POINTS = [
  { x: 0,   y: 0   },   // CSS top-left corner → PDF top (y = originalHeight)
  { x: 612, y: 792 },   // CSS bottom-right corner → PDF bottom-left
  { x: 150, y: 200 },   // Interior point
  { x: 306, y: 396 },   // Page centre (at scale=1)
  { x: 1,   y: 1   },   // Near origin
  { x: 300, y: 100 },   // Upper-right region
  { x: 50,  y: 700 },   // Lower-left region
]

// ---------------------------------------------------------------------------
// Round-trip property tests
// ---------------------------------------------------------------------------

describe('makeSimpleViewport round-trip property tests', () => {
  for (const scale of SCALES) {
    describe(`scale=${scale}`, () => {
      const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, scale)

      for (const original of SAMPLE_CSS_POINTS) {
        it(`round-trips CSS (${original.x}, ${original.y}) within ${TOLERANCE}`, () => {
          const pdfSpace = cssPixelToPageSpace(original, viewport)
          const recovered = pageSpaceToCssPixel(pdfSpace, viewport)

          expect(Math.abs(recovered.x - original.x)).toBeLessThan(TOLERANCE)
          expect(Math.abs(recovered.y - original.y)).toBeLessThan(TOLERANCE)
        })
      }
    })
  }
})

// ---------------------------------------------------------------------------
// Concrete mapping assertions
// ---------------------------------------------------------------------------

describe('makeSimpleViewport concrete coordinate mapping', () => {
  it('CSS (0, 0) → PDF (0, originalHeight) at scale=1 (top-left CSS = top of page in PDF space)', () => {
    const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, 1)
    const pdf = cssPixelToPageSpace({ x: 0, y: 0 }, viewport)

    // CSS top-left is PDF space top (y = originalHeight because PDF y-axis is inverted)
    expect(pdf.x).toBeCloseTo(0, 3)
    expect(pdf.y).toBeCloseTo(ORIGINAL_HEIGHT, 3) // = 792
  })

  it('CSS bottom-left (0, originalHeight) → PDF (0, 0) at scale=1 (bottom of page in PDF space)', () => {
    const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, 1)
    const pdf = cssPixelToPageSpace({ x: 0, y: ORIGINAL_HEIGHT }, viewport)

    // CSS bottom-left = PDF origin (0, 0)
    expect(pdf.x).toBeCloseTo(0, 3)
    expect(pdf.y).toBeCloseTo(0, 3)
  })

  it('PDF (0, 0) → CSS (0, originalHeight) at scale=1 (PDF bottom-left = CSS bottom-left)', () => {
    const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, 1)
    const css = pageSpaceToCssPixel({ x: 0, y: 0 }, viewport)

    expect(css.x).toBeCloseTo(0, 3)
    expect(css.y).toBeCloseTo(ORIGINAL_HEIGHT, 3) // = 792
  })

  it('scale=1.5: CSS (0, 0) → PDF (0, originalHeight) regardless of scale', () => {
    // The Y-flip maps CSS top-left to PDF top regardless of scale
    const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, 1.5)
    const pdf = cssPixelToPageSpace({ x: 0, y: 0 }, viewport)

    expect(pdf.x).toBeCloseTo(0, 3)
    expect(pdf.y).toBeCloseTo(ORIGINAL_HEIGHT, 3)
  })

  it('scale=1.5: CSS dimensions are 1.5× PDF dimensions', () => {
    const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, 1.5)
    // A PDF-space width of 100pt should render as 150 CSS px at scale=1.5
    const topLeft  = pageSpaceToCssPixel({ x: 0,   y: 100 }, viewport)
    const topRight = pageSpaceToCssPixel({ x: 100, y: 100 }, viewport)

    expect(topRight.x - topLeft.x).toBeCloseTo(150, 3)
  })

  it('viewport.scale property equals the scale argument', () => {
    const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, 1.5)
    expect(viewport.scale).toBe(1.5)
  })

  it('convertToPdfPoint returns a 2-element array', () => {
    const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, 1)
    const result = viewport.convertToPdfPoint(100, 200)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
  })

  it('convertToViewportPoint returns a 2-element array', () => {
    const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, 1)
    const result = viewport.convertToViewportPoint(100, 200)
    expect(Array.isArray(result)).toBe(true)
    expect(result).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Placement handler simulation: click → field top-left → PDF space
// ---------------------------------------------------------------------------

describe('field placement coordinate simulation', () => {
  it('a 180px field centered on a CSS click maps to a stable PDF-space rect', () => {
    const scale = 1.5
    const viewport = makeSimpleViewport(ORIGINAL_WIDTH, ORIGINAL_HEIGHT, scale)

    // Simulate click at the center of the rendered page
    const clickCssX = (ORIGINAL_WIDTH * scale) / 2    // 459
    const clickCssY = (ORIGINAL_HEIGHT * scale) / 2   // 594

    const defaultWidthPx = 180
    const aspectRatio = 3 // 3:1 width:height (from signature draw pad canvas)
    const defaultHeightPx = defaultWidthPx / aspectRatio  // 60

    // Center the field on the click point (top-left CSS corner)
    const fieldTopLeftCss = {
      x: clickCssX - defaultWidthPx / 2,
      y: clickCssY - defaultHeightPx / 2,
    }

    // Convert top-left CSS corner to PDF space via Coordinate Mapper
    const pdfOrigin = cssPixelToPageSpace(fieldTopLeftCss, viewport)

    // PDF dimensions: divide CSS dimensions by scale
    const pdfWidth  = defaultWidthPx  / scale
    const pdfHeight = defaultHeightPx / scale

    // pdfOrigin.x/y must be the BOTTOM-left of the field in PDF space.
    // Sanity: x must be positive and within page width
    expect(pdfOrigin.x).toBeGreaterThanOrEqual(0)
    expect(pdfOrigin.x).toBeLessThanOrEqual(ORIGINAL_WIDTH)

    // pdfWidth/pdfHeight must be positive
    expect(pdfWidth).toBeGreaterThan(0)
    expect(pdfHeight).toBeGreaterThan(0)

    // Round-trip: recover CSS top-left from stored PDF origin
    const recoveredCss = pageSpaceToCssPixel(pdfOrigin, viewport)
    expect(Math.abs(recoveredCss.x - fieldTopLeftCss.x)).toBeLessThan(TOLERANCE)
    expect(Math.abs(recoveredCss.y - fieldTopLeftCss.y)).toBeLessThan(TOLERANCE)
  })
})

// ---------------------------------------------------------------------------
// Store-level field placement tests — new types and multi-page keying
// Tests exercise the placement contract at the store level (no DOM / drag simulation).
// @see 03-02-PLAN.md Task 3 (FLD-02, FLD-03, FLD-04, FLD-08)
// ---------------------------------------------------------------------------

/** Helper to build a minimal PlacedField fixture */
function makePlacedField(overrides: Partial<PlacedField> = {}): PlacedField {
  return {
    id: crypto.randomUUID(),
    type: 'signature',
    pageNumber: 1,
    pdfX: 10,
    pdfY: 20,
    pdfWidth: 100,
    pdfHeight: 30,
    ...overrides,
  }
}

describe('field store — new field type placement contracts', () => {
  beforeEach(() => {
    useFieldStore.getState().resetFields()
  })

  // FLD-02 / FLD-03: date field defaults to today (M/D/YYYY), is stored, and is selected
  it('FLD-02/FLD-03: adding a date field stores it with today-format textValue and selects it', () => {
    const store = useFieldStore.getState()
    const today = new Date()
    const expectedTextValue = `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`

    const dateField = makePlacedField({
      id: 'date-1',
      type: 'date',
      textValue: expectedTextValue,
    })

    // Simulate LazyPage drop: pushHistory → addField → setSelectedFieldId
    store.pushHistory()
    store.addField(dateField)
    store.setSelectedFieldId(dateField.id)

    const state = useFieldStore.getState()
    expect(state.fields).toHaveLength(1)
    expect(state.fields[0].type).toBe('date')
    expect(state.fields[0].textValue).toBe(expectedTextValue)
    // textValue must match M/D/YYYY shape
    expect(state.fields[0].textValue).toMatch(/^\d{1,2}\/\d{1,2}\/\d{4}$/)
    // Field is selected after drop
    expect(state.selectedFieldId).toBe('date-1')
  })

  // FLD-04: text field starts empty; updateField persists typed value
  it('FLD-04: adding a text field with empty textValue then updateField persists the typed value', () => {
    const store = useFieldStore.getState()

    const textField = makePlacedField({
      id: 'text-1',
      type: 'text',
      textValue: '',
    })

    store.addField(textField)
    expect(useFieldStore.getState().fields[0].textValue).toBe('')

    // Simulate inline blur commit
    store.pushHistory()
    store.updateField('text-1', { textValue: 'typed content' })
    expect(useFieldStore.getState().fields[0].textValue).toBe('typed content')
  })

  // FLD-02: checkbox field stored with geometry only (no dataUrl, no textValue)
  it('FLD-02: adding a checkbox field stores geometry only — no dataUrl, no textValue', () => {
    const store = useFieldStore.getState()

    const checkboxField = makePlacedField({
      id: 'cb-1',
      type: 'checkbox',
      // no dataUrl, no textValue
    })

    store.addField(checkboxField)

    const stored = useFieldStore.getState().fields[0]
    expect(stored.type).toBe('checkbox')
    expect(stored.dataUrl).toBeUndefined()
    expect(stored.textValue).toBeUndefined()
    // Geometry preserved
    expect(stored.pdfX).toBe(10)
    expect(stored.pdfY).toBe(20)
    expect(stored.pdfWidth).toBe(100)
    expect(stored.pdfHeight).toBe(30)
  })

  // FLD-08: fields are keyed by pageNumber — per-page filter works correctly
  it('FLD-08: fields are keyed per page; filter by pageNumber returns only the matching page fields', () => {
    const store = useFieldStore.getState()

    const fieldPage1 = makePlacedField({ id: 'p1-1', pageNumber: 1, type: 'signature' })
    const fieldPage2 = makePlacedField({ id: 'p2-1', pageNumber: 2, type: 'date', textValue: '1/1/2026' })
    const fieldPage2b = makePlacedField({ id: 'p2-2', pageNumber: 2, type: 'text', textValue: 'hello' })

    store.addField(fieldPage1)
    store.addField(fieldPage2)
    store.addField(fieldPage2b)

    const allFields = useFieldStore.getState().fields
    expect(allFields).toHaveLength(3)

    // Simulate LazyPage per-page filter
    const page1Fields = allFields.filter((f) => f.pageNumber === 1)
    const page2Fields = allFields.filter((f) => f.pageNumber === 2)

    expect(page1Fields).toHaveLength(1)
    expect(page1Fields[0].id).toBe('p1-1')

    expect(page2Fields).toHaveLength(2)
    expect(page2Fields.map((f) => f.id).sort()).toEqual(['p2-1', 'p2-2'].sort())
  })
})
