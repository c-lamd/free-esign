import { useState, useCallback } from 'react'
import { ToolFrame } from '../components/ToolFrame'
import { SingleFileUploadZone } from '../components/SingleFileUploadZone'
import { HardwareKey } from '../components/ui/HardwareKey'
import { splitPdf, getPageCount } from '../lib/pdfOrganize'
import { zipFiles, triggerBlobDownload } from '../lib/toolDownload'

/**
 * SplitRoute — the Split PDF tool, mounted at `/split` (SPL-01).
 *
 * Flow:
 *   1. Pick one PDF via <SingleFileUploadZone> (PDF-only). On select, read the page
 *      count once via getPageCount (11-01) and show "PAGES — N".
 *   2. Choose a mode:
 *        - EXTRACT RANGE → reveals a text input (e.g. "2-4" or "5"); produces ONE PDF.
 *        - EACH PAGE → ZIP → produces a client-side .zip of N single-page PDFs.
 *   3. SPLIT → DOWNLOAD funnels through exactly ONE triggerBlobDownload call:
 *        - range: splitPdf(file,{mode:'range',range}) → triggerBlobDownload(.pdf)
 *        - each:  splitPdf(file,{mode:'each'}) → zipFiles(files) → triggerBlobDownload(.zip)
 *      This single download call-site is Phase-13-ready (one counter increment there).
 *
 * Everything is client-side: no fetch, no network, no document upload (PAR-05).
 * The .zip is built in-browser via fflate inside zipFiles (PAR-07). Local component
 * state only (mirrors MergeRoute's minimalism) — no global store.
 *
 * Does NOT touch documentStore/fieldStore/coordinateMapper/exportPdf — the signing
 * path is untouched, and these tools legitimately produce NEW PDFs (EXP-02 byte-identity
 * does not apply here — see 11-CONTEXT).
 *
 * Invalid input is handled gracefully: parsePageRange / splitPdf tagged Errors
 * (propagated by 11-01) surface as friendly inline copy and never download.
 */

type Mode = 'range' | 'each'

const SPLIT_FAILED_COPY =
  'Could not split this PDF — it may be corrupt. Try another file.'
const RANGE_INVALID_COPY = "That page range isn't valid for this PDF."

/** Strips the final extension from a filename ("report.pdf" → "report"). */
function baseName(name: string): string {
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.slice(0, lastDot) : name
}

export function SplitRoute() {
  const [file, setFile] = useState<File | null>(null)
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [mode, setMode] = useState<Mode | null>(null)
  const [range, setRange] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [splitting, setSplitting] = useState(false)

  const handleFileSelected = useCallback(async (selected: File) => {
    setError(null)
    setMode(null)
    setRange('')
    setPageCount(null)
    setFile(selected)
    try {
      const count = await getPageCount(await selected.arrayBuffer())
      setPageCount(count)
    } catch {
      // Corrupt / unreadable PDF — drop it and show friendly copy.
      setFile(null)
      setError(SPLIT_FAILED_COPY)
    }
  }, [])

  // SPLIT is usable once a mode is chosen; range mode additionally needs a non-empty range.
  const canSplit =
    file !== null &&
    !splitting &&
    (mode === 'each' || (mode === 'range' && range.trim() !== ''))

  const handleSplit = useCallback(async () => {
    if (!file || splitting || mode === null) return
    if (mode === 'range' && range.trim() === '') return
    setError(null)
    setSplitting(true)
    try {
      const toolFile = { name: file.name, bytes: await file.arrayBuffer() }
      const base = baseName(file.name)

      if (mode === 'range') {
        const result = await splitPdf(toolFile, { mode: 'range', range: range.trim() })
        if (result.kind !== 'single') {
          // Defensive: range mode always returns a single PDF (11-01 contract).
          throw new Error('Unexpected split result for range mode.')
        }
        triggerBlobDownload(
          result.bytes,
          `${base}-pages-${range.trim()}.pdf`,
          'application/pdf',
        )
      } else {
        const result = await splitPdf(toolFile, { mode: 'each' })
        if (result.kind !== 'multi') {
          throw new Error('Unexpected split result for each-page mode.')
        }
        const zip = zipFiles(result.files)
        triggerBlobDownload(zip, `${base}-pages.zip`, 'application/zip')
      }
    } catch (cause) {
      // parsePageRange throws "Invalid page range: ..." — map that to the range copy;
      // every other failure maps to the generic corrupt-file copy. Never download.
      const message = cause instanceof Error ? cause.message : ''
      setError(/invalid page range/i.test(message) ? RANGE_INVALID_COPY : SPLIT_FAILED_COPY)
    } finally {
      setSplitting(false)
    }
  }, [file, splitting, mode, range])

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
            SPLIT PDF
          </h1>
          <p
            style={{
              fontFamily: 'system-ui',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            Extract a page range into one PDF, or save each page as its own file.
          </p>
        </header>

        {file === null ? (
          <SingleFileUploadZone
            onFileSelected={(f) => void handleFileSelected(f)}
            error={error ?? undefined}
          />
        ) : (
          <>
            {/* Page-count readout */}
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '0.08em',
                color: 'var(--color-text-primary)',
                textAlign: 'center',
                margin: 0,
              }}
            >
              PAGES — {pageCount ?? '…'}
            </p>

            {/* Mode selector */}
            <div
              role="group"
              aria-label="Split mode"
              style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}
            >
              <HardwareKey
                armed={mode === 'range'}
                aria-pressed={mode === 'range'}
                onClick={() => {
                  setMode('range')
                  setError(null)
                }}
                aria-label="Extract range mode"
              >
                EXTRACT RANGE
              </HardwareKey>
              <HardwareKey
                armed={mode === 'each'}
                aria-pressed={mode === 'each'}
                onClick={() => {
                  setMode('each')
                  setError(null)
                }}
                aria-label="Each page to zip mode"
              >
                EACH PAGE → ZIP
              </HardwareKey>
            </div>

            {/* Range input — revealed only in range mode */}
            {mode === 'range' && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <input
                  type="text"
                  value={range}
                  onChange={(e) => {
                    setRange(e.target.value)
                    setError(null)
                  }}
                  placeholder="e.g. 2-4 or 5"
                  aria-label="Page range to extract"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '13px',
                    padding: '8px 12px',
                    width: '160px',
                    textAlign: 'center',
                    background: 'var(--color-canvas)',
                    border: '1px solid var(--color-line-strong)',
                    borderRadius: '6px',
                    color: 'var(--color-text-primary)',
                  }}
                />
              </div>
            )}

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
                armed={canSplit}
                disabled={!canSplit}
                onClick={() => void handleSplit()}
                aria-label={
                  mode === null
                    ? 'Split — choose a mode first'
                    : 'Split PDF and download'
                }
              >
                {splitting ? '⏳ SPLITTING…' : 'SPLIT → DOWNLOAD'}
              </HardwareKey>
              <HardwareKey
                onClick={() => {
                  setFile(null)
                  setPageCount(null)
                  setMode(null)
                  setRange('')
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
