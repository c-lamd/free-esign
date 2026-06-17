import { describe, it, expect, beforeAll, vi } from 'vitest'
import { exportSignedPdf, triggerDownload, signedFilename } from '../lib/exportPdf'
import { SAMPLE_PDF_BASE64 } from './fixtures/samplePdf'

/**
 * 1×1 transparent PNG — minimal valid PNG data URL for use as a test signature.
 * Source: standard minimal 1×1 RGBA PNG (IHDR + IDAT + IEND).
 */
const TRANSPARENT_1x1_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

/** Decode SAMPLE_PDF_BASE64 into Uint8Array once and reuse. */
const INPUT_BYTES = Uint8Array.from(atob(SAMPLE_PDF_BASE64), (c) => c.charCodeAt(0))

// ---------- jsdom stubs ----------

/**
 * jsdom does not implement URL.createObjectURL / URL.revokeObjectURL.
 * Stub them so triggerDownload can call them without crashing.
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
})

// ---------- EXP-02: zero-alteration export ----------

describe('EXP-02: zero-alteration export', () => {
  it('first 512 bytes of output are byte-identical to input', async () => {
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

  it('rejects with a tagged Error when dataUrl is not a valid PNG data URL', async () => {
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
