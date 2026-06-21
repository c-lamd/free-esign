/**
 * toolDownload.test.ts — Unit coverage for the shared output layer of the Phase 11 tools.
 *
 * Covers (per 11-01 PLAN <behavior>):
 *   - zipFiles: round-trips through fflate's unzipSync to the exact named entries + bytes
 *   - zipFiles: empty input throws a tagged Error (nothing to zip)
 *   - zipFiles: makes no network call (fetch spy)
 *   - triggerBlobDownload: creates an object URL, appends + clicks + removes an
 *     <a download={filename}>, and revokes the URL — the SINGLE download call-site
 *     shape each tool reuses (P13 hooks one increment here later)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { unzipSync, strToU8 } from 'fflate'
import { zipFiles, triggerBlobDownload } from '../lib/toolDownload'

// ── Zero-network fetch spy ──────────────────────────────────────────────────────

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  fetchSpy = vi.fn(() => {
    throw new Error('Network call attempted — toolDownload must be fully offline (PAR-05/PAR-07)')
  })
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── zipFiles ────────────────────────────────────────────────────────────────────

describe('zipFiles', () => {
  it('round-trips two named entries with identical bytes via unzipSync', () => {
    const a = strToU8('alpha contents')
    const b = strToU8('bravo contents')
    const zipped = zipFiles([
      { name: 'a.pdf', bytes: a },
      { name: 'b.pdf', bytes: b },
    ])
    expect(zipped).toBeInstanceOf(Uint8Array)

    const unzipped = unzipSync(zipped)
    expect(Object.keys(unzipped).sort()).toEqual(['a.pdf', 'b.pdf'])
    expect(Array.from(unzipped['a.pdf'])).toEqual(Array.from(a))
    expect(Array.from(unzipped['b.pdf'])).toEqual(Array.from(b))
  })

  it('throws a tagged Error on empty input (nothing to zip)', () => {
    expect(() => zipFiles([])).toThrow(/nothing to zip/i)
  })

  it('does not call fetch', () => {
    zipFiles([{ name: 'x.pdf', bytes: strToU8('x') }])
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

// ── triggerBlobDownload ─────────────────────────────────────────────────────────

describe('triggerBlobDownload', () => {
  let createSpy: ReturnType<typeof vi.spyOn>
  let revokeSpy: ReturnType<typeof vi.spyOn>
  let clickSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    createSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:mock-url')
    revokeSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('creates an object URL, clicks an <a download={filename}>, and revokes the URL', () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46])
    let downloadAttr: string | null = null
    let hrefAttr: string | null = null

    // Capture the anchor's download/href at click time, before removal.
    clickSpy.mockImplementation(function (this: HTMLAnchorElement) {
      downloadAttr = this.getAttribute('download')
      hrefAttr = this.getAttribute('href')
    })

    triggerBlobDownload(bytes, 'merged.pdf', 'application/pdf')

    expect(createSpy).toHaveBeenCalledTimes(1)
    expect(clickSpy).toHaveBeenCalledTimes(1)
    expect(downloadAttr).toBe('merged.pdf')
    expect(hrefAttr).toBe('blob:mock-url')

    // Anchor is removed from the DOM synchronously after click.
    expect(document.querySelector('a[download="merged.pdf"]')).toBeNull()

    // URL is revoked after the brief delay.
    vi.runAllTimers()
    expect(revokeSpy).toHaveBeenCalledWith('blob:mock-url')
  })

  it('passes the parameterized mime through to the Blob (application/zip)', () => {
    let capturedType: string | undefined
    createSpy.mockImplementation((blob: Blob) => {
      capturedType = blob.type
      return 'blob:mock-url'
    })

    triggerBlobDownload(new Uint8Array([1, 2, 3]), 'pages.zip', 'application/zip')
    expect(capturedType).toBe('application/zip')
  })
})
