import { useState, useCallback } from 'react'
import { ToolFrame } from '../components/ToolFrame'
import { MultiImageUploadZone } from '../components/MultiImageUploadZone'
import { HardwareKey } from '../components/ui/HardwareKey'
import { imagesToPdf } from '../lib/imageWrapper'
import { triggerBlobDownload } from '../lib/toolDownload'

/**
 * ImageToPdfRoute — the Image → PDF tool, mounted at `/image-to-pdf` (CNV-02).
 *
 * Flow:
 *   1. Pick ≥1 JPG/PNG via <MultiImageUploadZone> (image-only, multi-select).
 *      Appended files stack onto the existing list so the set is built incrementally.
 *   2. Reorder (move up/down) or remove rows — the displayed order IS the page order.
 *   3. CONVERT → DOWNLOAD (gated on ≥1 image): calls imagesToPdf(orderedFiles)
 *      (12-02 foundation), then triggerBlobDownload of the single combined
 *      `images.pdf`. This is the SINGLE download call-site for this tool (Phase 13
 *      will hook one counter increment here — NOT added now).
 *
 * Each image becomes one page; original image bytes are embedded (embedJpg/embedPng)
 * with no rasterization or re-encode. Everything is client-side: no fetch, no
 * network, no upload (PAR-05). Local component state only — no global store.
 *
 * Does NOT touch documentStore/fieldStore/coordinateMapper/exportPdf — the signing
 * path is untouched.
 */

interface ImageFile {
  id: string
  file: File
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `image-${idCounter}`
}

const CONVERT_FAILED_COPY =
  'Could not convert these images. One may be corrupt — try removing it.'

export function ImageToPdfRoute() {
  const [files, setFiles] = useState<ImageFile[]>([])
  const [error, setError] = useState<string | null>(null)
  const [converting, setConverting] = useState(false)

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

  const canConvert = files.length >= 1 && !converting

  const handleConvert = useCallback(async () => {
    if (files.length < 1 || converting) return
    setError(null)
    setConverting(true)
    try {
      const bytes = await imagesToPdf(files.map((f) => f.file))
      triggerBlobDownload(bytes, 'images.pdf', 'application/pdf')
    } catch {
      // Friendly inline copy — never leak internal pdf-lib messages, never download.
      setError(CONVERT_FAILED_COPY)
    } finally {
      setConverting(false)
    }
  }, [files, converting])

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
            IMAGE → PDF
          </h1>
          <p
            style={{
              fontFamily: 'system-ui',
              fontSize: '14px',
              color: 'var(--color-text-secondary)',
              margin: 0,
            }}
          >
            Add JPG or PNG images, set the order, and download one PDF.
          </p>
        </header>

        <MultiImageUploadZone onFilesAdded={append} />

        {files.length > 0 && (
          <ol
            aria-label="Selected images in page order"
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
                data-testid="image-file-row"
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
            armed={canConvert}
            disabled={!canConvert}
            onClick={() => void handleConvert()}
            aria-label={
              files.length < 1
                ? 'Convert — add at least 1 image first'
                : 'Convert images to PDF and download the combined file'
            }
          >
            {converting ? '⏳ CONVERTING…' : 'CONVERT → DOWNLOAD'}
          </HardwareKey>
        </div>
      </div>
    </ToolFrame>
  )
}
