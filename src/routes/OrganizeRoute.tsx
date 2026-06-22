// pdfWorker side-effect is anchored in main.tsx (WR-02); the named import here gives
// access to pdfOptions for the shared <Document> (self-hosted worker, no CDN — PAR-07).
import { pdfOptions } from '../lib/pdfWorker'
import { Document } from 'react-pdf'

import { useState, useCallback, useEffect, useRef } from 'react'
import { ToolFrame } from '../components/ToolFrame'
import { SingleFileUploadZone } from '../components/SingleFileUploadZone'
import { PageThumbnail } from '../components/PageThumbnail'
import { HardwareKey } from '../components/ui/HardwareKey'
import { getPageCount, organizePages } from '../lib/pdfOrganize'
import { triggerBlobDownload } from '../lib/toolDownload'

/**
 * OrganizeRoute — the Organize pages tool, mounted at `/organize` (ORG-01).
 *
 * Flow:
 *   1. Pick one PDF via <SingleFileUploadZone> (PDF-only). On select, read the page
 *      count once via getPageCount (11-01) and seed the editable page model.
 *   2. The PDF is parsed ONCE inside a single shared <Document file={url}>; each page
 *      renders as a <PageThumbnail> (pdfjs preview) in the current order.
 *   3. Per-page edits mutate an ordered model `pages: { id, srcIndex, rotation }[]`:
 *        - reorder (move up / down) changes the order → the displayed order IS the
 *          rebuild order;
 *        - delete drops a page from the model (empty model disables REBUILD);
 *        - rotate advances that page's rotation 0→90→180→270→0.
 *   4. REBUILD → DOWNLOAD funnels through exactly ONE triggerBlobDownload call:
 *        organizePages(file, ops) where ops = pages.map(p => ({srcIndex, rotate:rotation}))
 *        → triggerBlobDownload(bytes, '<base>-organized.pdf', 'application/pdf').
 *      This single download call-site is Phase-13-ready (one counter increment there).
 *
 * Everything is client-side: no fetch, no network, no document upload (PAR-05). The
 * pdfjs worker is self-hosted via pdfWorker.ts (PAR-07). Local component state only.
 *
 * Does NOT touch documentStore/fieldStore/coordinateMapper/exportPdf — the signing
 * path is untouched, and Organize legitimately produces a NEW PDF (EXP-02 byte-identity
 * does not apply here — see 11-CONTEXT). A rebuild failure surfaces friendly inline copy
 * and never downloads. The blob URL is revoked on unmount / new upload to avoid leaks.
 */

interface PageEntry {
  /** Stable React key, independent of position. */
  id: string
  /** 0-based source page index this entry renders. */
  srcIndex: number
  /** Additive rotation in {0,90,180,270}. */
  rotation: number
}

const REBUILD_FAILED_COPY =
  'Could not rebuild this PDF — it may be corrupt. Try another file.'
const READ_FAILED_COPY =
  'Could not read this PDF — it may be corrupt. Try another file.'

/** Strips the final extension from a filename ("report.pdf" → "report"). */
function baseName(name: string): string {
  const lastDot = name.lastIndexOf('.')
  return lastDot > 0 ? name.slice(0, lastDot) : name
}

export function OrganizeRoute() {
  const [file, setFile] = useState<File | null>(null)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [pages, setPages] = useState<PageEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState(false)

  // Track the active object URL so it is always revoked exactly once (on replace/unmount).
  const docUrlRef = useRef<string | null>(null)
  useEffect(() => {
    docUrlRef.current = docUrl
  }, [docUrl])
  useEffect(() => {
    return () => {
      if (docUrlRef.current) URL.revokeObjectURL(docUrlRef.current)
    }
  }, [])

  const resetTo = useCallback((next: File | null, url: string | null, count: number) => {
    setDocUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return url
    })
    setFile(next)
    setPages(
      Array.from({ length: count }, (_, i) => ({
        id: `p-${i}`,
        srcIndex: i,
        rotation: 0,
      })),
    )
    setError(null)
  }, [])

  const handleFileSelected = useCallback(
    async (selected: File) => {
      setError(null)
      try {
        const count = await getPageCount(await selected.arrayBuffer())
        const url = URL.createObjectURL(selected)
        resetTo(selected, url, count)
      } catch {
        // Corrupt / unreadable PDF — drop it and show friendly copy.
        setError(READ_FAILED_COPY)
      }
    },
    [resetTo],
  )

  const handleRotate = useCallback((id: string) => {
    setPages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)),
    )
  }, [])

  const handleDelete = useCallback((id: string) => {
    setPages((prev) => prev.filter((p) => p.id !== id))
  }, [])

  const move = useCallback((index: number, delta: number) => {
    setPages((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = prev.slice()
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }, [])

  const handleChangeFile = useCallback(() => {
    setDocUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    setFile(null)
    setPages([])
    setError(null)
  }, [])

  const canRebuild = file !== null && pages.length > 0 && !rebuilding

  const handleRebuild = useCallback(async () => {
    if (!file || pages.length === 0 || rebuilding) return
    setError(null)
    setRebuilding(true)
    try {
      const bytes = await file.arrayBuffer()
      const ops = pages.map((p) => ({ srcIndex: p.srcIndex, rotate: p.rotation }))
      const out = await organizePages({ name: file.name, bytes }, ops)
      triggerBlobDownload(out, `${baseName(file.name)}-organized.pdf`, 'application/pdf')
    } catch {
      setError(REBUILD_FAILED_COPY)
    } finally {
      setRebuilding(false)
    }
  }, [file, pages, rebuilding])

  return (
    <ToolFrame>
      <div
        style={{
          maxWidth: '880px',
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
            ORGANIZE PAGES
          </h1>
          <p
            style={{
              fontFamily: 'system-ui',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            Reorder, rotate, and remove pages, then rebuild your PDF.
          </p>
        </header>

        {file === null || docUrl === null ? (
          <SingleFileUploadZone
            onFileSelected={(f) => void handleFileSelected(f)}
            error={error ?? undefined}
          />
        ) : (
          <>
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
              PAGES — {pages.length}
            </p>

            {/* Single shared <Document> — the PDF parses ONCE for the whole grid */}
            <Document file={docUrl} options={pdfOptions}>
              <div
                role="list"
                aria-label="Pages to organize"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                  gap: '12px',
                }}
              >
                {pages.map((p, index) => (
                  <PageThumbnail
                    key={p.id}
                    srcIndex={p.srcIndex}
                    displayNumber={index + 1}
                    rotation={p.rotation}
                    onRotate={() => handleRotate(p.id)}
                    onDelete={() => handleDelete(p.id)}
                    onMoveUp={() => move(index, -1)}
                    onMoveDown={() => move(index, 1)}
                    isFirst={index === 0}
                    isLast={index === pages.length - 1}
                  />
                ))}
              </div>
            </Document>

            {pages.length === 0 && (
              <p
                style={{
                  fontFamily: 'system-ui',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                  textAlign: 'center',
                  margin: 0,
                }}
              >
                All pages removed — add the file again to start over.
              </p>
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
                armed={canRebuild}
                disabled={!canRebuild}
                onClick={() => void handleRebuild()}
                aria-label="Rebuild PDF and download"
              >
                {rebuilding ? '⏳ REBUILDING…' : 'REBUILD → DOWNLOAD'}
              </HardwareKey>
              <HardwareKey onClick={handleChangeFile} aria-label="Choose a different PDF">
                ✕ CHANGE FILE
              </HardwareKey>
            </div>
          </>
        )}
      </div>
    </ToolFrame>
  )
}
