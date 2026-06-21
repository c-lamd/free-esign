/**
 * pdfOrganize.test.ts — Unit coverage for the pure pdf-lib page-operation library.
 *
 * Covers (per 11-01 PLAN <behavior>):
 *   - parsePageRange: "N" / "A-B" parsing, 1-based bounds, whitespace, tagged-Error throws
 *   - mergePdfs: combined page count = sum of inputs, input-order preservation
 *   - splitPdf range mode: { kind:'single' } with exactly the requested span
 *   - splitPdf each mode: { kind:'multi' } with one single-page PDF per source page
 *   - organizePages: reorder / delete / rotate ops on a rebuilt document
 *   - Zero-network: a fetch spy asserts fetch is NEVER called across all ops (PAR-05).
 *
 * Fixtures are generated in-test with PDFDocument.create()+addPage() so the suite is
 * self-contained (does not rely on the gitignored sample PDF).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib-incremental-save'
import {
  parsePageRange,
  mergePdfs,
  splitPdf,
  organizePages,
} from '../lib/pdfOrganize'

// ── Fixture helpers ─────────────────────────────────────────────────────────────

/**
 * Builds an n-page PDF as raw bytes. Each page is a distinct size so reorder/delete
 * assertions can verify identity by page width (US-letter-ish but unique per index).
 */
async function makePdfBytes(pageCount: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pageCount; i++) {
    // Unique width per page index so reordering is observable via getWidth().
    doc.addPage([100 + i * 10, 200])
  }
  return doc.save()
}

/** Loads bytes and returns the embedded PDFDocument for assertions. */
async function loadDoc(bytes: Uint8Array): Promise<PDFDocument> {
  return PDFDocument.load(bytes)
}

// ── Zero-network fetch spy ──────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn(() => {
    throw new Error('Network call attempted — pdfOrganize must be fully offline (PAR-05)')
  })
  // Stub global fetch so any accidental network use fails loudly + is asserted below.
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

// ── parsePageRange ──────────────────────────────────────────────────────────────

describe('parsePageRange', () => {
  it('parses "2-4" on a 10-page doc to [2,3,4]', () => {
    expect(parsePageRange('2-4', 10)).toEqual([2, 3, 4])
  })

  it('parses a single page "3" to [3]', () => {
    expect(parsePageRange('3', 10)).toEqual([3])
  })

  it('tolerates surrounding whitespace ("2 - 4")', () => {
    expect(parsePageRange('2 - 4', 10)).toEqual([2, 3, 4])
  })

  it('throws a tagged Error on lower out-of-bounds ("0")', () => {
    expect(() => parsePageRange('0', 10)).toThrow(/Invalid page range/)
  })

  it('throws a tagged Error on upper out-of-bounds ("11" on a 10-page doc)', () => {
    expect(() => parsePageRange('11', 10)).toThrow(/Invalid page range/)
  })

  it('throws a tagged Error on a reversed range ("4-2")', () => {
    expect(() => parsePageRange('4-2', 10)).toThrow(/Invalid page range/)
  })

  it('throws a tagged Error on empty input', () => {
    expect(() => parsePageRange('', 10)).toThrow(/Invalid page range/)
  })

  it('throws a tagged Error on non-numeric input', () => {
    expect(() => parsePageRange('abc', 10)).toThrow(/Invalid page range/)
  })

  it('does not call fetch', () => {
    parsePageRange('1-3', 10)
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── mergePdfs ───────────────────────────────────────────────────────────────────

describe('mergePdfs', () => {
  it('combines a 2-page + 3-page PDF into a single 5-page PDF', async () => {
    const a = await makePdfBytes(2)
    const b = await makePdfBytes(3)
    const merged = await mergePdfs([
      { name: 'a.pdf', bytes: a },
      { name: 'b.pdf', bytes: b },
    ])
    const doc = await loadDoc(merged)
    expect(doc.getPageCount()).toBe(5)
  })

  it('preserves input array order then page order within each file', async () => {
    // Doc A pages: widths 100,110 ; Doc B pages: widths 100,110,120
    const a = await makePdfBytes(2)
    const b = await makePdfBytes(3)
    const merged = await mergePdfs([
      { name: 'a.pdf', bytes: a },
      { name: 'b.pdf', bytes: b },
    ])
    const doc = await loadDoc(merged)
    const widths = doc.getPages().map((p) => Math.round(p.getWidth()))
    expect(widths).toEqual([100, 110, 100, 110, 120])
  })

  it('accepts ArrayBuffer inputs as well as Uint8Array', async () => {
    const a = await makePdfBytes(1)
    // Pass a copied ArrayBuffer slice
    const ab = a.buffer.slice(a.byteOffset, a.byteOffset + a.byteLength)
    const merged = await mergePdfs([{ name: 'a.pdf', bytes: ab }])
    const doc = await loadDoc(merged)
    expect(doc.getPageCount()).toBe(1)
  })

  it('re-throws a tagged Error on corrupt input', async () => {
    const garbage = new Uint8Array([1, 2, 3, 4, 5])
    await expect(mergePdfs([{ name: 'bad.pdf', bytes: garbage }])).rejects.toThrow(
      /Could not merge/,
    )
  })

  it('does not call fetch', async () => {
    const a = await makePdfBytes(1)
    const b = await makePdfBytes(1)
    await mergePdfs([
      { name: 'a.pdf', bytes: a },
      { name: 'b.pdf', bytes: b },
    ])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── splitPdf ────────────────────────────────────────────────────────────────────

describe('splitPdf — range mode', () => {
  it('returns { kind:"single" } with exactly pages 2..3 (2 pages)', async () => {
    const src = await makePdfBytes(5)
    const result = await splitPdf({ name: 'doc.pdf', bytes: src }, {
      mode: 'range',
      range: '2-3',
    })
    expect(result.kind).toBe('single')
    if (result.kind !== 'single') throw new Error('expected single')
    const doc = await loadDoc(result.bytes)
    expect(doc.getPageCount()).toBe(2)
    // pages 2,3 are widths 110,120 (index 1,2)
    const widths = doc.getPages().map((p) => Math.round(p.getWidth()))
    expect(widths).toEqual([110, 120])
  })

  it('propagates an Invalid page range error for an out-of-bounds span', async () => {
    const src = await makePdfBytes(3)
    await expect(
      splitPdf({ name: 'doc.pdf', bytes: src }, { mode: 'range', range: '2-9' }),
    ).rejects.toThrow(/Invalid page range|Could not split/)
  })

  it('does not call fetch', async () => {
    const src = await makePdfBytes(4)
    await splitPdf({ name: 'doc.pdf', bytes: src }, { mode: 'range', range: '1-2' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('splitPdf — each mode', () => {
  it('returns { kind:"multi" } with one single-page PDF per source page', async () => {
    const src = await makePdfBytes(3)
    const result = await splitPdf({ name: 'report.pdf', bytes: src }, { mode: 'each' })
    expect(result.kind).toBe('multi')
    if (result.kind !== 'multi') throw new Error('expected multi')
    expect(result.files).toHaveLength(3)
    for (const f of result.files) {
      const doc = await loadDoc(f.bytes)
      expect(doc.getPageCount()).toBe(1)
    }
  })

  it('names per-page files <base>-page-<n>.pdf, zero-padded to page-count width', async () => {
    const src = await makePdfBytes(12)
    const result = await splitPdf({ name: 'report.pdf', bytes: src }, { mode: 'each' })
    if (result.kind !== 'multi') throw new Error('expected multi')
    // 12 pages → width 2 → page-01 .. page-12
    expect(result.files[0].name).toBe('report-page-01.pdf')
    expect(result.files[11].name).toBe('report-page-12.pdf')
  })

  it('does not call fetch', async () => {
    const src = await makePdfBytes(2)
    await splitPdf({ name: 'doc.pdf', bytes: src }, { mode: 'each' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── organizePages ───────────────────────────────────────────────────────────────

describe('organizePages', () => {
  it('reorders pages: ops [{1},{0}] on a 2-page doc swaps page order', async () => {
    // src widths: [100,110]
    const src = await makePdfBytes(2)
    const out = await organizePages({ name: 'doc.pdf', bytes: src }, [
      { srcIndex: 1 },
      { srcIndex: 0 },
    ])
    const doc = await loadDoc(out)
    const widths = doc.getPages().map((p) => Math.round(p.getWidth()))
    expect(widths).toEqual([110, 100])
  })

  it('deletes a page: ops for indices [0,2] on a 3-page doc yields 2 pages', async () => {
    // src widths: [100,110,120]
    const src = await makePdfBytes(3)
    const out = await organizePages({ name: 'doc.pdf', bytes: src }, [
      { srcIndex: 0 },
      { srcIndex: 2 },
    ])
    const doc = await loadDoc(out)
    expect(doc.getPageCount()).toBe(2)
    const widths = doc.getPages().map((p) => Math.round(p.getWidth()))
    expect(widths).toEqual([100, 120])
  })

  it('rotates a page: { srcIndex:0, rotate:90 } sets rotation to 90°', async () => {
    const src = await makePdfBytes(1)
    const out = await organizePages({ name: 'doc.pdf', bytes: src }, [
      { srcIndex: 0, rotate: 90 },
    ])
    const doc = await loadDoc(out)
    expect(doc.getPage(0).getRotation().angle).toBe(90)
  })

  it('rotation is additive and normalized into {0,90,180,270} (270+180 → 90)', async () => {
    // Build a source whose page already has 270° rotation, then add 180.
    const seed = await PDFDocument.create()
    const p = seed.addPage([100, 200])
    p.setRotation({ type: 'degrees', angle: 270 } as never)
    const src = await seed.save()
    const out = await organizePages({ name: 'doc.pdf', bytes: src }, [
      { srcIndex: 0, rotate: 180 },
    ])
    const doc = await loadDoc(out)
    expect(doc.getPage(0).getRotation().angle).toBe(90)
  })

  it('re-throws a tagged Error on corrupt input', async () => {
    const garbage = new Uint8Array([9, 8, 7])
    await expect(
      organizePages({ name: 'bad.pdf', bytes: garbage }, [{ srcIndex: 0 }]),
    ).rejects.toThrow(/Could not organize/)
  })

  it('does not call fetch', async () => {
    const src = await makePdfBytes(2)
    await organizePages({ name: 'doc.pdf', bytes: src }, [{ srcIndex: 0 }])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
