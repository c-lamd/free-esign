import { useState, useCallback } from 'react'
import { ToolFrame } from '../components/ToolFrame'
import { MultiFileUploadZone } from '../components/MultiFileUploadZone'
import { HardwareKey } from '../components/ui/HardwareKey'
import { mergePdfs } from '../lib/pdfOrganize'
import { triggerBlobDownload } from '../lib/toolDownload'

/**
 * MergeRoute — the Merge PDF tool, mounted at `/merge` (MRG-01).
 *
 * Flow:
 *   1. Pick ≥2 PDFs via <MultiFileUploadZone> (PDF-only, multi-select). Appended
 *      files stack onto the existing list so the merge set is built incrementally.
 *   2. Reorder (move up/down) or remove rows — the displayed order IS the merge order.
 *   3. MERGE → DOWNLOAD (gated on ≥2 files): reads each File's bytes, calls
 *      mergePdfs(orderedFiles) (11-01 foundation), then triggerBlobDownload of the
 *      single combined `merged.pdf`. This is the SINGLE download call-site for this
 *      tool (Phase 13 will hook one counter increment here — NOT added now).
 *
 * Everything is client-side: no fetch, no network, no document upload (PAR-05).
 * Local component state only (mirrors SignRoute's minimalism) — no global store.
 *
 * Does NOT touch documentStore/fieldStore/coordinateMapper/exportPdf — the signing
 * path is untouched.
 */

interface MergeFile {
  id: string
  file: File
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `merge-${idCounter}`
}

const MERGE_FAILED_COPY =
  'Could not merge these PDFs. One may be corrupt — try removing it.'

export function MergeRoute() {
  const [files, setFiles] = useState<MergeFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [merging, setMerging] = useState(false)

  const append = useCallback((added: File[]) => {
    setError(null)
    setFiles((prev) => [...prev, ...added.map((file) => ({ id: nextId(), file }))])
  }, [])

  const move = useCallback((index: number, delta: number) => {
    setFiles((prev) => {
      const target = index + delta
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id))
  }, [])

  const canMerge = files.length >= 2 && !merging

  const handleMerge = useCallback(async () => {
    if (files.length < 2 || merging) return
    setError(null)
    setMerging(true)
    try {
      const toolFiles = await Promise.all(
        files.map(async ({ file }) => ({
          name: file.name,
          bytes: await file.arrayBuffer(),
        })),
      )
      const bytes = await mergePdfs(toolFiles)
      triggerBlobDownload(bytes, 'merged.pdf', 'application/pdf')
    } catch {
      // Friendly inline copy — never leak internal pdf-lib messages, never download.
      setError(MERGE_FAILED_COPY)
    } finally {
      setMerging(false)
    }
  }, [files, merging])

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
            MERGE PDFs
          </h1>
          <p
            style={{
              fontFamily: 'system-ui',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            Add two or more PDFs, set the order, and download one combined file.
          </p>
        </header>

        <MultiFileUploadZone onFilesAdded={append} />

        {files.length > 0 && (
          <ol
            aria-label="Selected PDFs in merge order"
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {files.map(({ id, file }, index) => (
              <li
                key={id}
                data-testid="merge-file-row"
                data-filename={file.name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 12px',
                  background: 'var(--color-surface-elevated)',
                  border: '1px solid var(--color-line-strong)',
                  borderRadius: '6px',
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: 'var(--color-ink-faint)',
                    minWidth: '20px',
                  }}
                >
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span
                  style={{
                    flex: 1,
                    fontFamily: 'var(--font-mono)',
                    fontSize: '12px',
                    color: 'var(--color-text-primary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={file.name}
                >
                  {file.name}
                </span>
                <HardwareKey
                  onClick={() => move(index, -1)}
                  disabled={index === 0}
                  aria-label={`Move ${file.name} up`}
                >
                  ▲
                </HardwareKey>
                <HardwareKey
                  onClick={() => move(index, 1)}
                  disabled={index === files.length - 1}
                  aria-label={`Move ${file.name} down`}
                >
                  ▼
                </HardwareKey>
                <HardwareKey
                  onClick={() => remove(id)}
                  aria-label={`Remove ${file.name}`}
                >
                  ✕
                </HardwareKey>
              </li>
            ))}
          </ol>
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

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <HardwareKey
            armed={canMerge}
            disabled={!canMerge}
            onClick={() => void handleMerge()}
            aria-label={
              files.length < 2
                ? 'Merge — add at least 2 PDFs first'
                : 'Merge PDFs and download the combined file'
            }
          >
            {merging ? '⏳ MERGING…' : 'MERGE → DOWNLOAD'}
          </HardwareKey>
        </div>
      </div>
    </ToolFrame>
  )
}
