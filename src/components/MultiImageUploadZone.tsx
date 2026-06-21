import { useState, useRef, useCallback } from 'react'
import { validateFile } from '../lib/fileValidation'
import { HardwareKey } from './ui/HardwareKey'

/**
 * MultiImageUploadZone — instrument-panel multi-IMAGE picker for the Image → PDF
 * tool (CNV-02). Select one or more JPG/PNG images; they are wrapped into ONE
 * multi-page PDF downstream.
 *
 * Mirrors MultiFileUploadZone's chrome EXACTLY (dashed drop bay, mono "▼ INSERT
 * IMAGES" label, HardwareKey "⏏ BROWSE FILES", the "FILES — JPG/PNG only · ENGINE
 * — client-side · NET — 0 requests" line, the "Your files never leave your
 * browser." line) so the suite reads consistently. Purely PRESENTATIONAL: NOT
 * coupled to documentStore / fieldStore (those are signing-specific). It reports
 * selected files via a callback.
 *
 * Validation (T-12-07): every dropped/selected file is run through validateFile
 * (which whitelists JPG/PNG via MIME + extension) AND gated on image/jpeg|image/png
 * before it is reported. Non-images are filtered out and surface an inline error
 * rather than crashing or silently dropping. Accept attribute is ".jpg,.jpeg,.png"
 * with `multiple` so the OS picker offers multi-select of images only.
 *
 * Privacy: no fetch, no network — files never leave the browser (PAR-05).
 */
export interface MultiImageUploadZoneProps {
  /** Called with the kept (valid JPG/PNG) files, in picker order. Never called with []. */
  onFilesAdded: (files: File[]) => void
  /**
   * Optional externally-controlled inline error (e.g. from the parent's own
   * conversion failure). Rendered alongside any internal per-file validation error.
   */
  error?: string
}

const UNSUPPORTED_COPY =
  'Only JPG or PNG images can be converted. Other files were skipped — try again with images.'

export function MultiImageUploadZone({ onFilesAdded, error }: MultiImageUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Core ingestion handler — shared by drag-drop and the Browse picker.
   * Keeps only files that are valid JPG/PNG images (validateFile === null AND the
   * browser reports image/jpeg or image/png); reports them via onFilesAdded. If
   * anything was rejected, surfaces an inline error. Never throws.
   */
  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      const all = fileList ? Array.from(fileList) : []
      if (all.length === 0) return

      const kept: File[] = []
      let rejected = 0
      for (const file of all) {
        if (
          validateFile(file) === null &&
          (file.type === 'image/jpeg' || file.type === 'image/png')
        ) {
          kept.push(file)
        } else {
          rejected += 1
        }
      }

      setInternalError(rejected > 0 ? UNSUPPORTED_COPY : null)
      if (kept.length > 0) {
        onFilesAdded(kept)
      }
    },
    [onFilesAdded],
  )

  // ── Drag handlers ──────────────────────────────────────────────────────────

  function handleDragEnter(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragOver(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  function handleDragLeave(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  // ── Picker handlers ────────────────────────────────────────────────────────

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files)
    // Reset so the same files can be re-selected after an error or after appending.
    e.target.value = ''
  }

  function handleBrowseClick() {
    fileInputRef.current?.click()
  }

  const shownError = internalError ?? error ?? null

  return (
    <div
      role="region"
      aria-label="Image to PDF upload area"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '12px',
        padding: '24px 16px',
        backgroundColor: isDragOver ? 'var(--color-accent-soft)' : 'transparent',
        outline: isDragOver ? '2px dashed var(--color-accent)' : 'none',
        outlineOffset: isDragOver ? '-2px' : '0',
        borderRadius: '8px',
        transition: 'background-color 0.15s ease, outline 0.1s ease',
        userSelect: 'none',
      }}
    >
      {/* Drop bay — dashed instrument-panel "insert images" frame */}
      <div
        style={{
          border: isDragOver
            ? '2px dashed var(--color-accent)'
            : '2px dashed var(--color-border)',
          borderRadius: '8px',
          padding: '32px 24px',
          width: '100%',
          maxWidth: '400px',
          background: 'var(--color-canvas)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            color: 'var(--color-text-primary)',
            letterSpacing: '0.1em',
            margin: 0,
          }}
        >
          ▼ INSERT IMAGES
        </p>

        <HardwareKey onClick={handleBrowseClick} aria-label="Browse files to add images">
          ⏏ BROWSE FILES
        </HardwareKey>

        <p
          aria-hidden="true"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 400,
            color: 'var(--color-ink-faint)',
            letterSpacing: '0.08em',
            margin: 0,
          }}
        >
          FILES — JPG/PNG only · ENGINE — client-side · NET — 0 requests
        </p>
      </div>

      {/* Visually-hidden multi-file input — JPG/PNG only, multiple */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".jpg,.jpeg,.png"
        multiple
        onChange={handleFileInputChange}
        aria-hidden="true"
        tabIndex={-1}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: '0',
        }}
      />

      {shownError !== null && (
        <p
          role="alert"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            fontWeight: 500,
            color: 'var(--color-accent)',
            margin: 0,
            textAlign: 'center',
            maxWidth: '400px',
          }}
        >
          {shownError}
        </p>
      )}

      <p
        style={{
          fontFamily: 'system-ui',
          fontSize: '14px',
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
          margin: 0,
        }}
      >
        Your files never leave your browser.
      </p>
    </div>
  )
}
