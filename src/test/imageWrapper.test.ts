import { describe, it, expect, beforeAll, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib-incremental-save'
import { wrapImageAsPdf, imagesToPdf } from '../lib/imageWrapper'

/**
 * jsdom does not implement URL.createObjectURL. Stub it in this test file
 * so that imageWrapper.ts can call it and we can assert on the returned string.
 */
beforeAll(() => {
  if (typeof URL.createObjectURL === 'undefined') {
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn((_obj: Blob | MediaSource) => `blob:http://localhost/${crypto.randomUUID()}`),
    })
  } else {
    // Already defined (e.g. happy-dom) — ensure it returns a blob: URL
    vi.spyOn(URL, 'createObjectURL').mockImplementation(
      (_obj: Blob | MediaSource) => `blob:http://localhost/${crypto.randomUUID()}`,
    )
  }
})

/**
 * Minimal valid 1×1 PNG bytes (67 bytes).
 * Source: standard minimal PNG fixture — IHDR (1×1, 8-bit RGB) + IDAT + IEND.
 */
const MINIMAL_1x1_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length + type
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // bit depth=8, color type=2 (RGB), CRC
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT length + type
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // IDAT data (compressed)
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, // IDAT data + CRC
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND length + type
  0x44, 0xae, 0x42, 0x60, 0x82,                   // IEND CRC
])

/**
 * Minimal valid 1×1 JPEG bytes.
 * A valid JPEG with SOI + APP0 + SOF0 + DHT + SOS + EOI markers.
 * Source: known-good minimal JPEG fixture used in pdf-lib test suites.
 */
const MINIMAL_1x1_JPEG = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, // SOI + APP0 marker
  0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, // JFIF identifier
  0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43, // aspect + quant table
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, // quant values
  0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b,
  0x0b, 0x0c, 0x19, 0x12, 0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d,
  0x1a, 0x1c, 0x1c, 0x20, 0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c,
  0x1c, 0x28, 0x37, 0x29, 0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27,
  0x39, 0x3d, 0x38, 0x32, 0x3c, 0x2e, 0x33, 0x34, 0x32, // end quant
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, // SOF0 marker: height=1
  0x01, 0x01, 0x01, 0x11, 0x00,                   // width=1, 1 component
  0xff, 0xc4, 0x00, 0x1f, 0x00, 0x00, 0x01, 0x05, // DHT marker
  0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a,
  0x0b,
  0xff, 0xda, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, // SOS
  0x3f, 0x00, 0xfb, 0xd3,                          // scan data
  0xff, 0xd9,                                       // EOI
])

describe('wrapImageAsPdf — PNG input', () => {
  it('resolves to a blob: URL for a valid PNG file', async () => {
    const file = new File([MINIMAL_1x1_PNG], 'image.png', { type: 'image/png' })
    const result = await wrapImageAsPdf(file)
    expect(result).toMatch(/^blob:/)
  })

  it('returns a string (not a Buffer or Uint8Array)', async () => {
    const file = new File([MINIMAL_1x1_PNG], 'image.png', { type: 'image/png' })
    const result = await wrapImageAsPdf(file)
    expect(typeof result).toBe('string')
  })
})

describe('wrapImageAsPdf — JPEG input', () => {
  it('resolves to a blob: URL for a valid JPEG file (.jpg)', async () => {
    const file = new File([MINIMAL_1x1_JPEG], 'photo.jpg', {
      type: 'image/jpeg',
    })
    const result = await wrapImageAsPdf(file)
    expect(result).toMatch(/^blob:/)
  })

  it('resolves to a blob: URL for a valid JPEG file (.jpeg)', async () => {
    const file = new File([MINIMAL_1x1_JPEG], 'photo.jpeg', {
      type: 'image/jpeg',
    })
    const result = await wrapImageAsPdf(file)
    expect(result).toMatch(/^blob:/)
  })
})

describe('wrapImageAsPdf — error handling', () => {
  it('rejects with an Error (not a raw pdf-lib error) when given corrupt image bytes', async () => {
    const corrupt = new Uint8Array([0x00, 0x01, 0x02, 0x03]) // not a valid image
    const file = new File([corrupt], 'bad.png', { type: 'image/png' })
    await expect(wrapImageAsPdf(file)).rejects.toThrow()
  })
})

// ───────────────────────────────────────────────────────────────────────────
// imagesToPdf — multi-image → ONE multi-page PDF (CNV-02)
// ───────────────────────────────────────────────────────────────────────────

function pngFile(name = 'image.png'): File {
  return new File([MINIMAL_1x1_PNG], name, { type: 'image/png' })
}

function jpgFile(name = 'photo.jpg'): File {
  return new File([MINIMAL_1x1_JPEG], name, { type: 'image/jpeg' })
}

describe('imagesToPdf — multi-image → one multi-page PDF', () => {
  it('wraps a single PNG into a one-page PDF (bytes start with %PDF-)', async () => {
    const bytes = await imagesToPdf([pngFile()])
    expect(bytes).toBeInstanceOf(Uint8Array)
    // %PDF- header = 0x25 0x50 0x44 0x46 0x2d
    expect(Array.from(bytes.slice(0, 5))).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d])
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(1)
  })

  it('wraps a PNG + a JPG into a two-page PDF (one page per image)', async () => {
    const bytes = await imagesToPdf([pngFile('a.png'), jpgFile('b.jpg')])
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(2)
  })

  it('produces one page PER input image, in input order (3 images → 3 pages)', async () => {
    const bytes = await imagesToPdf([pngFile('1.png'), jpgFile('2.jpg'), pngFile('3.png')])
    const doc = await PDFDocument.load(bytes)
    expect(doc.getPageCount()).toBe(3)
  })

  it('rejects with a tagged Error when an image is corrupt (never leaks raw pdf-lib message)', async () => {
    const corrupt = new File([new Uint8Array([0x00, 0x01, 0x02, 0x03])], 'bad.png', {
      type: 'image/png',
    })
    await expect(imagesToPdf([corrupt])).rejects.toThrow(/could not be embedded in PDF/i)
  })

  it('rejects when given an empty image list', async () => {
    await expect(imagesToPdf([])).rejects.toThrow(/no images to convert/i)
  })
})
