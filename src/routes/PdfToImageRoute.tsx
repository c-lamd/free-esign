import { useState, useCallback } from 'react'
import { ToolFrame } from '../components/ToolFrame'
import { SingleFileUploadZone } from '../components/SingleFileUploadZone'
import { HardwareKey } from '../components/ui/HardwareKey'
import { pdfToImages, type ImageFormat } from '../lib/pdfConvert'
import { zipFiles, triggerBlobDownload } from '../lib/toolDownload'

/**
 * PdfToImageRoute — the PDF → image tool, mounted at `/pdf-to-image` (CNV-01).
 *
 * Flow:
 *   1. Pick one PDF via <SingleFileUploadZone> (PDF-only).
 *   2. Choose a format (JPG / PNG) via two armed HardwareKeys.
 *   3. CONVERT → DOWNLOAD calls pdfToImages(bytes, {format, scale: 2.0, baseName})
 *      exactly once, then funnels through exactly ONE triggerBlobDownload call:
 *        - one entry  → triggerBlobDownload(entry.bytes, "<base>.<ext>", image mime)
 *        - N entries  → zipFiles(entries) → triggerBlobDownload(zip, "<base>-pages.zip",
 *                       'application/zip')
 *      This single download call-site per branch is Phase-13-ready (one counter
 *      increment there).
 *
 * Everything is client-side: no fetch, no network, no document upload (PAR-05).
 * Rendering happens in pdfConvert (pdfjs → canvas → toBlob), SEQUENTIALLY and
 * memory-bounded. Local component state only (mirrors SplitRoute's minimalism).
 *
 * Does NOT touch documentStore / fieldStore / coordinateMapper / exportPdf — the
 * signing path is untouched (PAR-04), and this tool legitimately produces NEW image
 * bytes (EXP-02 byte-identity does not apply — see 12-CONTEXT).
 */

/**
 * Render scale passed to pdfjs. 2.0 ≈ 144 DPI — legible page images without
 * exhausting memory (per 12-CONTEXT: render sequentially + release canvases).
 */
const SCALE = 2.0

const CONVERT_FAILED_COPY =
  'Could not convert this PDF — it may be corrupt. Try another file.'

/** Strips the final extension from a filename ("report.pdf" → "report"). */
function baseName(name: string): string {
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.slice(0, lastDot) : name
}

export function PdfToImageRoute() {
  const [file, setFile] = useState<File | null>(null)
  const [format, setFormat] = useState<ImageFormat | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)

  const handleFileSelected = useCallback((selected: File) => {
    setError(null)
    setFormat(null)
    setFile(selected)
  }, [])

  const canConvert = file !== null && format !== null && !converting

  const handleConvert = useCallback(async () => {
    if (!file || format === null || converting) return
    setError(null)
    setConverting(true)
    try {
      const bytes = await file.arrayBuffer()
      const base = baseName(file.name)
      const entries = await pdfToImages(bytes, { format, scale: SCALE, baseName: base })

      if (entries.length === 1) {
        const ext = format === 'jpeg' ? 'jpg' : 'png'
        const mime = format === 'jpeg' ? 'image/jpeg' : 'image/png'
        // SINGLE download call-site (single-page branch) — Phase-13-ready.
        triggerBlobDownload(entries[0].bytes, `${base}.${ext}`, mime)
      } else {
        const zip = zipFiles(entries)
        // SINGLE download call-site (multi-page branch) — Phase-13-ready.
        triggerBlobDownload(zip, `${base}-pages.zip`, 'application/zip')
      }
    } catch {
      // pdfToImages re-throws a tagged Error; map it to friendly copy. Never download.
      setError(CONVERT_FAILED_COPY)
    } finally {
      setConverting(false)
    }
  }, [file, format, converting])

  return (
    <ToolFrame>
      <div
        style={{
          maxWidth: '640px',
          margin: '0 auto',
          padding: '24px 16px 48px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
        }}
      >
        <header style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '18px',
              fontWeight: 600,
              letterSpacing: '0.04em',
              color: 'var(--color-text-primary)',
              margin: '0 0 4px',
            }}
          >
            PDF → IMAGE
          </h1>
          <p
            style={{
              fontFamily: 'system-ui',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            Turn each PDF page into a JPG or PNG — entirely in your browser.
          </p>
        </header>

        {file === null ? (
          <SingleFileUploadZone
            onFileSelected={handleFileSelected}
            error={error ?? undefined}
          />
        ) : (
          <>
            {/* Format selector */}
            <div
              role="group"
              aria-label="Image format"
              style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}
            >
              <HardwareKey
                armed={format === 'jpeg'}
                aria-pressed={format === 'jpeg'}
                onClick={() => {
                  setFormat('jpeg')
                  setError(null)
                }}
                aria-label="JPG format"
              >
                JPG
              </HardwareKey>
              <HardwareKey
                armed={format === 'png'}
                aria-pressed={format === 'png'}
                onClick={() => {
                  setFormat('png')
                  setError(null)
                }}
                aria-label="PNG format"
              >
                PNG
              </HardwareKey>
            </div>

            {error !== null && (
              <p
                role="alert"
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: 'var(--color-accent)',
                  margin: 0,
                  textAlign: 'center',
                }}
              >
                {error}
              </p>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <HardwareKey
                armed={canConvert}
                disabled={!canConvert}
                onClick={() => void handleConvert()}
                aria-label={
                  format === null
                    ? 'Convert — choose a format first'
                    : 'Convert PDF to images and download'
                }
              >
                {converting ? '⏳ CONVERTING…' : 'CONVERT → DOWNLOAD'}
              </HardwareKey>
              <HardwareKey
                onClick={() => {
                  setFile(null)
                  setFormat(null)
                  setError(null)
                }}
                aria-label="Choose a different PDF"
              >
                ✕ CHANGE FILE
              </HardwareKey>
            </div>
          </>
        )}
      </div>
    </ToolFrame>
  )
}
