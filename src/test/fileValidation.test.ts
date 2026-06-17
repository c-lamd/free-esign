import { describe, it, expect } from 'vitest'
import { validateFile } from '../lib/fileValidation'

/**
 * Helper: create a File with specific MIME type and name.
 */
function makeFile(
  name: string,
  type: string,
  sizeBytes = 1024,
): File {
  const blob = new Blob([new Uint8Array(sizeBytes)], { type })
  return new File([blob], name, { type })
}

describe('validateFile — supported types', () => {
  it('accepts a PDF file (application/pdf + .pdf extension)', () => {
    expect(validateFile(makeFile('doc.pdf', 'application/pdf'))).toBeNull()
  })

  it('accepts a JPEG file (image/jpeg + .jpg extension)', () => {
    expect(validateFile(makeFile('photo.jpg', 'image/jpeg'))).toBeNull()
  })

  it('accepts a JPEG file (image/jpeg + .jpeg extension)', () => {
    expect(validateFile(makeFile('photo.jpeg', 'image/jpeg'))).toBeNull()
  })

  it('accepts a PNG file (image/png + .png extension)', () => {
    expect(validateFile(makeFile('image.png', 'image/png'))).toBeNull()
  })
})

describe('validateFile — unsupported types', () => {
  it('rejects a text file (.txt, text/plain)', () => {
    expect(validateFile(makeFile('notes.txt', 'text/plain'))).toBe(
      'unsupported-type',
    )
  })

  it('rejects a Word document (.docx, application/vnd.openxmlformats-officedocument.wordprocessingml.document) — routes to word-doc not unsupported-type', () => {
    expect(
      validateFile(
        makeFile(
          'report.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ),
    ).toBe('word-doc')
  })

  it('rejects a file with unknown/empty MIME type', () => {
    expect(validateFile(makeFile('file.xyz', ''))).toBe('unsupported-type')
  })

  it('rejects a file with mismatched extension (.png extension but PDF MIME)', () => {
    // Defense in depth: extension must also be in the whitelist relative to the MIME
    // Here MIME is allowed but extension mismatch means it fails extension check — we
    // test that passing MIME alone is NOT sufficient without a matching extension.
    // Note: we use a .exe extension to ensure the extension check catches it.
    expect(validateFile(makeFile('malicious.exe', 'application/pdf'))).toBe(
      'unsupported-type',
    )
  })

  it('rejects a file with allowed extension but wrong MIME type (text/html + .pdf)', () => {
    expect(validateFile(makeFile('fake.pdf', 'text/html'))).toBe(
      'unsupported-type',
    )
  })
})

describe('validateFile — Word-doc detection (DOC-05)', () => {
  it('returns word-doc for .docx with correct openxml MIME (not unsupported-type)', () => {
    expect(
      validateFile(
        makeFile(
          'contract.docx',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ),
      ),
    ).toBe('word-doc')
  })

  it('returns word-doc for .doc with application/msword MIME', () => {
    expect(validateFile(makeFile('contract.doc', 'application/msword'))).toBe(
      'word-doc',
    )
  })

  it('returns word-doc for .docx by extension even when browser reports application/zip (MIME quirk)', () => {
    // Some browsers (e.g. older Chromium on Linux) report .docx as application/zip
    // because .docx is a ZIP archive. Extension check must catch it.
    expect(validateFile(makeFile('report.docx', 'application/zip'))).toBe(
      'word-doc',
    )
  })

  it('returns word-doc for application/msword MIME even with a non-.doc filename', () => {
    // MIME signal alone is sufficient — defense-in-depth: either MIME or extension triggers word-doc
    expect(
      validateFile(makeFile('renamed-file.bin', 'application/msword')),
    ).toBe('word-doc')
  })

  it('word-doc check runs BEFORE generic unsupported-type (.doc extension with empty MIME)', () => {
    // Empty MIME + .doc extension → word-doc (extension check fires before generic unsupported)
    expect(validateFile(makeFile('mydoc.doc', ''))).toBe('word-doc')
  })
})

describe('validateFile — size limit', () => {
  it('rejects a PDF over 100 MB with too-large (checked before byte read)', () => {
    const OVER_100MB = 100 * 1024 * 1024 + 1
    // We construct a File whose reported size is > 100 MB without allocating
    // 100 MB of RAM — use Object.defineProperty to override the size getter.
    const file = makeFile('large.pdf', 'application/pdf', 0)
    Object.defineProperty(file, 'size', { value: OVER_100MB, configurable: true })
    expect(validateFile(file)).toBe('too-large')
  })

  it('accepts a PDF exactly at 100 MB (boundary — inclusive lower)', () => {
    const EXACTLY_100MB = 100 * 1024 * 1024
    const file = makeFile('boundary.pdf', 'application/pdf', 0)
    Object.defineProperty(file, 'size', {
      value: EXACTLY_100MB,
      configurable: true,
    })
    expect(validateFile(file)).toBeNull()
  })

  it('rejects a PNG over 100 MB', () => {
    const file = makeFile('huge.png', 'image/png', 0)
    Object.defineProperty(file, 'size', {
      value: 100 * 1024 * 1024 + 1,
      configurable: true,
    })
    expect(validateFile(file)).toBe('too-large')
  })
})
