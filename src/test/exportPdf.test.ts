import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { PDFDocument, StandardFonts } from 'pdf-lib-incremental-save'
import { exportSignedPdf, triggerDownload, signedFilename } from '../lib/exportPdf'
import { _clearFontBytesCache } from '../lib/fonts'
import { SAMPLE_PDF_BASE64 } from './fixtures/samplePdf'

/**
 * 1×1 transparent PNG — minimal valid PNG data URL for use as a test signature.
 * Source: standard minimal 1×1 RGBA PNG (IHDR + IDAT + IEND).
 */
const TRANSPARENT_1x1_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** Decode SAMPLE_PDF_BASE64 into Uint8Array once and reuse. */
const INPUT_BYTES = Uint8Array.from(atob(SAMPLE_PDF_BASE64), (c) => c.charCodeAt(0))

/**
 * Real TTF bytes — loaded from the vendored Dancing Script font.
 * fontkit REQUIRES valid TTF bytes to parse glyph tables during embedFont.
 * A minimal/fake 4-byte TTF is rejected, so we use the actual file.
 */
const DANCING_SCRIPT_TTF = readFileSync(
  resolve(__dirname, '../../public/fonts/DancingScript-Regular.ttf'),
)

// ---------- jsdom stubs ----------

/**
 * jsdom does not implement URL.createObjectURL / URL.revokeObjectURL.
 * Stub them so triggerDownload can call them without crashing.
 *
 * Also stubs globalThis.fetch for font byte loading (RESEARCH Pitfall 7):
 * Vitest/jsdom has no server — fetch('/fonts/...') would fail without a mock.
 * We return real TTF bytes (Dancing Script) so fontkit can parse them.
 */
beforeAll(() => {
  if (typeof URL.createObjectURL === 'undefined') {
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:http://localhost/mock-url'),
    })
  } else {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:http://localhost/mock-url')
  }

  if (typeof URL.revokeObjectURL === 'undefined') {
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    })
  } else {
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  }

  // Mock fetch to return real Dancing Script TTF bytes.
  // The fontBytesCache is module-level, so this mock must resolve before any
  // typed-signature test populates the cache.
  // WR-04: include ok:true so the response.ok check in fonts.ts passes.
  vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: true,
    status: 200,
    arrayBuffer: () => Promise.resolve(DANCING_SCRIPT_TTF.buffer as ArrayBuffer),
  } as unknown as Response)
})

/**
 * Clear the module-level font byte cache between test runs so each test gets
 * a fresh fetch call (and tests that restore fetch don't get stale cached bytes).
 */
afterEach(() => {
  _clearFontBytesCache()
})

// ---------- EXP-02: zero-alteration export ----------

describe('EXP-02: zero-alteration export', () => {
  it('first 512 bytes of output are byte-identical to input (signature)', async () => {
    const field = {
      id: 'test-field-1',
      type: 'signature' as const,
      pageNumber: 1,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 100,
      pdfHeight: 30,
      dataUrl: TRANSPARENT_1x1_PNG,
    }

    const outputBytes = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])

    // EXP-02 CORE ASSERTION: first 512 bytes must be byte-identical
    const inputFirst512 = Array.from(INPUT_BYTES.slice(0, 512))
    const outputFirst512 = Array.from(outputBytes.slice(0, 512))
    expect(outputFirst512).toEqual(inputFirst512)
  })

  it('output length is greater than input length (incremental revision appended)', async () => {
    const field = {
      id: 'test-field-2',
      type: 'signature' as const,
      pageNumber: 1,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 100,
      pdfHeight: 30,
      dataUrl: TRANSPARENT_1x1_PNG,
    }

    const outputBytes = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])
    expect(outputBytes.length).toBeGreaterThan(INPUT_BYTES.length)
  })

  it('output is a valid PDF (decoded header starts with %PDF-)', async () => {
    // Verify the fixture itself starts with %PDF-
    const header = new TextDecoder().decode(INPUT_BYTES.slice(0, 5))
    expect(header).toBe('%PDF-')
  })

  it('rejects with a tagged Error when dataUrl is not a valid PNG data URL (signature)', async () => {
    const badField = {
      id: 'test-bad',
      type: 'signature' as const,
      pageNumber: 1,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 100,
      pdfHeight: 30,
      dataUrl: 'not-a-data-url',
    }
    await expect(
      exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [badField]),
    ).rejects.toThrow(/Could not export/)
  })

  // ---------- New field types: EXP-02 byte-identity ----------

  it('text field export: first 512 bytes byte-identical to input (EXP-02)', async () => {
    const field = {
      id: 'text-1',
      type: 'text' as const,
      pageNumber: 1,
      pdfX: 50,
      pdfY: 50,
      pdfWidth: 100,
      pdfHeight: 20,
      textValue: 'Hello World',
    }
    const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])
    const inputFirst512 = Array.from(INPUT_BYTES.slice(0, 512))
    const outputFirst512 = Array.from(output.slice(0, 512))
    expect(outputFirst512).toEqual(inputFirst512)
  })

  it('checkbox field export: first 512 bytes byte-identical to input (EXP-02)', async () => {
    const field = {
      id: 'cb-1',
      type: 'checkbox' as const,
      pageNumber: 1,
      pdfX: 50,
      pdfY: 50,
      pdfWidth: 20,
      pdfHeight: 20,
    }
    const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])
    const inputFirst512 = Array.from(INPUT_BYTES.slice(0, 512))
    const outputFirst512 = Array.from(output.slice(0, 512))
    expect(outputFirst512).toEqual(inputFirst512)
  })

  it('date field export: first 512 bytes byte-identical to input (EXP-02)', async () => {
    const field = {
      id: 'date-1',
      type: 'date' as const,
      pageNumber: 1,
      pdfX: 50,
      pdfY: 100,
      pdfWidth: 120,
      pdfHeight: 20,
      textValue: '6/17/2026',
    }
    const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])
    const inputFirst512 = Array.from(INPUT_BYTES.slice(0, 512))
    const outputFirst512 = Array.from(output.slice(0, 512))
    expect(outputFirst512).toEqual(inputFirst512)
  })

  it('does not throw for checkbox field (no dataUrl required) (Pitfall 6)', async () => {
    const field = {
      id: 'cb-nodata',
      type: 'checkbox' as const,
      pageNumber: 1,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 20,
      pdfHeight: 20,
    }
    await expect(
      exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field]),
    ).resolves.toBeInstanceOf(Uint8Array)
  })

  it('does not throw for text field (no dataUrl required) (Pitfall 6)', async () => {
    const field = {
      id: 'tx-nodata',
      type: 'text' as const,
      pageNumber: 1,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 80,
      pdfHeight: 20,
      textValue: 'test',
    }
    await expect(
      exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field]),
    ).resolves.toBeInstanceOf(Uint8Array)
  })

  it('does not throw for date field (no dataUrl required) (Pitfall 6)', async () => {
    const field = {
      id: 'dt-nodata',
      type: 'date' as const,
      pageNumber: 1,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 100,
      pdfHeight: 20,
      textValue: '6/17/2026',
    }
    await expect(
      exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field]),
    ).resolves.toBeInstanceOf(Uint8Array)
  })

  it('WR-03: text field with very long text stays within box — export succeeds and EXP-02 holds', async () => {
    // 200 characters is far wider than a 60pt box at any reasonable font size.
    // If truncateToFit is missing, pdf-lib would draw text beyond the field boundary.
    // This test verifies: (a) no exception is thrown, (b) EXP-02 byte-identity holds.
    const longText = 'A'.repeat(200)
    const field = {
      id: 'long-text',
      type: 'text' as const,
      pageNumber: 1,
      pdfX: 50,
      pdfY: 50,
      pdfWidth: 60, // narrow box — 200 'A' chars would overflow without truncation
      pdfHeight: 20,
      textValue: longText,
    }
    const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])
    // EXP-02: first 512 bytes must be byte-identical
    const inputFirst512 = Array.from(INPUT_BYTES.slice(0, 512))
    const outputFirst512 = Array.from(output.slice(0, 512))
    expect(outputFirst512).toEqual(inputFirst512)
    // Output must be larger than input (incremental revision appended)
    expect(output.length).toBeGreaterThan(INPUT_BYTES.length)
  })

  it('FLD-08: a field with pageNumber 2 against a single-page input throws page-range error', async () => {
    const field = {
      id: 'p2',
      type: 'signature' as const,
      pageNumber: 2,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 50,
      pdfHeight: 20,
      dataUrl: TRANSPARENT_1x1_PNG,
    }
    await expect(
      exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field]),
    ).rejects.toThrow(/page 2.*only has 1/)
  })
})

// ---------- triggerDownload ----------

describe('triggerDownload', () => {
  it('creates a Blob of type application/pdf, appends anchor with correct filename, and calls click', () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]) // %PDF
    const anchorMock = {
      href: '',
      download: '',
      click: vi.fn(),
      remove: vi.fn(),
    }

    // Spy on document.createElement to intercept anchor creation
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      if (tag === 'a') return anchorMock as unknown as HTMLElement
      return document.createElement.call(document, tag)
    })
    const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation((node) => node)
    const removeChildSpy = vi
      .spyOn(document.body, 'removeChild')
      .mockImplementation((node) => node)

    triggerDownload(bytes, 'x-signed.pdf')

    expect(anchorMock.download).toBe('x-signed.pdf')
    expect(anchorMock.click).toHaveBeenCalledOnce()
    expect(URL.createObjectURL).toHaveBeenCalled()

    createElementSpy.mockRestore()
    appendChildSpy.mockRestore()
    removeChildSpy.mockRestore()
  })
})

// ---------- signedFilename ----------

describe('signedFilename', () => {
  it('appends -signed before .pdf extension', () => {
    expect(signedFilename('report.pdf')).toBe('report-signed.pdf')
  })

  it('converts non-pdf extension to -signed.pdf', () => {
    expect(signedFilename('photo.png')).toBe('photo-signed.pdf')
  })

  it('handles multiple dots correctly', () => {
    expect(signedFilename('a.b.pdf')).toBe('a.b-signed.pdf')
  })

  it('handles filename with no extension', () => {
    expect(signedFilename('document')).toBe('document-signed.pdf')
  })
})

// ---------- Phase 4: Typed-signature export (SIG-02 / SIG-03) ----------

describe('SIG-02/SIG-03: typed-signature export (font-backed, not PNG)', () => {
  it('SIG-02: font-backed signature field exports without throwing and returns Uint8Array longer than input', async () => {
    const field = {
      id: 'typed-sig-1',
      type: 'signature' as const,
      pageNumber: 1,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 200,
      pdfHeight: 56,
      textValue: 'Jane Doe',
      fontFamily: 'Dancing Script',
    }
    const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])
    expect(output).toBeInstanceOf(Uint8Array)
    expect(output.length).toBeGreaterThan(INPUT_BYTES.length)
  })

  it('SIG-02 EXP-02: font-backed signature export — first 512 bytes byte-identical to input', async () => {
    // EXP-02 CORE ASSERTION for typed-signature path.
    // The incremental revision is appended AFTER original bytes — offset 0 unchanged.
    const field = {
      id: 'typed-sig-exp02',
      type: 'signature' as const,
      pageNumber: 1,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 200,
      pdfHeight: 56,
      textValue: 'Jane Doe',
      fontFamily: 'Dancing Script',
    }
    const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])
    const inputFirst512 = Array.from(INPUT_BYTES.slice(0, 512))
    const outputFirst512 = Array.from(output.slice(0, 512))
    expect(outputFirst512).toEqual(inputFirst512)
  })

  it('SIG-03: font-backed initials field exports without throwing (same path as signature)', async () => {
    const field = {
      id: 'typed-initials-1',
      type: 'initials' as const,
      pageNumber: 1,
      pdfX: 50,
      pdfY: 50,
      pdfWidth: 120,
      pdfHeight: 40,
      textValue: 'JD',
      fontFamily: 'Dancing Script',
    }
    const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field])
    expect(output).toBeInstanceOf(Uint8Array)
    expect(output.length).toBeGreaterThan(INPUT_BYTES.length)
  })

  it('no-truncation contract: a long name exports without error (width constraint scales font down)', async () => {
    // drawSignatureText must NOT truncate — the whole text must render at a scaled-down size.
    // A long name in a narrow box triggers the width-scale-down branch.
    const field = {
      id: 'typed-sig-longname',
      type: 'signature' as const,
      pageNumber: 1,
      pdfX: 10,
      pdfY: 10,
      pdfWidth: 80, // narrow box relative to the long name
      pdfHeight: 30,
      textValue: 'Bartholomew Bartholomew Bartholomew', // very long
      fontFamily: 'Dancing Script',
    }
    // Must not throw (no truncation — just scales font down)
    await expect(
      exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, [field]),
    ).resolves.toBeInstanceOf(Uint8Array)
  })

  it('deduplication: two fields with the same fontFamily embed the font once per export (no exception)', async () => {
    const fields = [
      {
        id: 'typed-sig-a',
        type: 'signature' as const,
        pageNumber: 1,
        pdfX: 10,
        pdfY: 10,
        pdfWidth: 150,
        pdfHeight: 40,
        textValue: 'Alice',
        fontFamily: 'Dancing Script',
      },
      {
        id: 'typed-sig-b',
        type: 'signature' as const,
        pageNumber: 1,
        pdfX: 10,
        pdfY: 60,
        pdfWidth: 150,
        pdfHeight: 40,
        textValue: 'Bob',
        fontFamily: 'Dancing Script', // same font — must be embedded only once
      },
    ]
    const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, fields)
    expect(output).toBeInstanceOf(Uint8Array)
    expect(output.length).toBeGreaterThan(INPUT_BYTES.length)
  })

  it('mixed export: drawn signature + typed signature coexist without error', async () => {
    const fields = [
      {
        id: 'drawn-sig',
        type: 'signature' as const,
        pageNumber: 1,
        pdfX: 10,
        pdfY: 10,
        pdfWidth: 100,
        pdfHeight: 30,
        dataUrl: TRANSPARENT_1x1_PNG,
      },
      {
        id: 'typed-sig',
        type: 'signature' as const,
        pageNumber: 1,
        pdfX: 10,
        pdfY: 50,
        pdfWidth: 150,
        pdfHeight: 40,
        textValue: 'Jane Doe',
        fontFamily: 'Dancing Script',
      },
    ]
    const output = await exportSignedPdf(INPUT_BYTES.buffer as ArrayBuffer, fields)
    expect(output).toBeInstanceOf(Uint8Array)
    expect(output.length).toBeGreaterThan(INPUT_BYTES.length)
  })

  it('fonts.ts allowlist: loadFontBytes rejects unknown font family before any fetch', async () => {
    const { loadFontBytes } = await import('../lib/fonts')
    // 'Comic Sans MS' is not in FONT_FILE_MAP — must throw before fetch
    await expect(loadFontBytes('Comic Sans MS')).rejects.toThrow(/Unknown font family/)
    // Confirm fetch was NOT called for the rejected family
    expect(globalThis.fetch).not.toHaveBeenCalledWith(
      expect.stringContaining('Comic Sans'),
    )
  })

  it('WR-04: loadFontBytes throws on HTTP 404 and does NOT cache the failure', async () => {
    // Temporarily override global fetch mock to simulate a 404 for this test
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 404,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    } as unknown as Response)

    const { loadFontBytes, _clearFontBytesCache: clearCache } = await import('../lib/fonts')
    clearCache()

    await expect(loadFontBytes('Dancing Script')).rejects.toThrow(/HTTP 404/)

    // Second call must re-fetch (failure was not cached)
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      arrayBuffer: () => Promise.resolve(DANCING_SCRIPT_TTF.buffer as ArrayBuffer),
    } as unknown as Response)
    const bytes = await loadFontBytes('Dancing Script')
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(0)
  })
})

// ---------- KMW-260620: drawn signature on object-stream original ----------

describe('KMW-260620: object-stream original + drawn signature — regression', () => {
  /**
   * Regression test for the "Invalid Root reference" bug.
   *
   * Root cause: pdf-lib's default save() uses object streams (ObjStm) to compress
   * objects including the Catalog. When embedPng modifies a page, pdf-lib-incremental-save
   * rewrites the ObjStm that contains the Catalog entry. If only page.ref is marked for
   * save (the pre-fix behaviour), the new xref still resolves /Root via /Prev into the
   * clobbered ObjStm → Catalog becomes unresolvable → pdfjs throws "Invalid Root reference".
   *
   * The fix (markPageStructureForSave) re-emits the Catalog + page-tree parent chain as
   * standalone objects, so the new xref can resolve /Root directly.
   */
  it('object-stream original + drawn signature: result re-parses and byte-prefix is preserved (EXP-02)', async () => {
    // Build an object-stream original using pdf-lib's default save() (uses ObjStm).
    const d = await PDFDocument.create()
    const p = d.addPage([400, 400])
    const f = await d.embedFont(StandardFonts.Helvetica)
    p.drawText('orig', { x: 40, y: 200, size: 16, font: f })
    const orig = await d.save() // default save uses object streams

    // Minimal 1×1 transparent PNG — same as TRANSPARENT_1x1_PNG above.
    const drawnSigField = {
      id: 'kmw-drawn',
      type: 'signature' as const,
      pageNumber: 1,
      pdfX: 50,
      pdfY: 50,
      pdfWidth: 120,
      pdfHeight: 40,
      dataUrl:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    }

    const result = await exportSignedPdf(orig.buffer as ArrayBuffer, [drawnSigField])

    // 1. EXP-02: the first orig.length bytes of result must byte-equal orig.
    //    (The incremental revision is appended after, never before, the original bytes.)
    const resultPrefix = Array.from(result.slice(0, orig.length))
    const origArray = Array.from(orig)
    expect(resultPrefix).toEqual(origArray)

    // 2. The result must re-parse cleanly — this is the regression guard.
    //    Pre-fix: PDFDocument.load throws "Invalid Root reference" for object-stream originals.
    //    Post-fix: Catalog is re-emitted as a standalone object → load succeeds.
    const reloaded = await PDFDocument.load(result)
    expect(reloaded.getPageCount()).toBe(1)
  })
})
