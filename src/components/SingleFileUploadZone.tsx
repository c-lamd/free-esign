import { useState, useRef, useCallback } from 'react'
import { validateFile } from '../lib/fileValidation'
import { HardwareKey } from './ui/HardwareKey'

/**
 * SingleFileUploadZone — instrument-panel single-PDF picker for tools that
 * operate on ONE document (Split now; reused by Organize in 11-04).
 *
 * Mirrors UploadZone's chrome (dashed drop bay, mono "▼ INSERT DOCUMENT" label,
 * HardwareKey "⏏ BROWSE FILES", the "Your files never leave your browser." line)
 * so the suite reads consistently — but is purely PRESENTATIONAL: it is NOT coupled
 * to documentStore / fieldStore (those are signing-specific). It reports the
 * selected file via a callback.
 *
 * Validation (T-11-08 family): the picked file is run through validateFile AND
 * required to be application/pdf before it is reported. A non-PDF (image / word /
 * oversized) surfaces the existing friendly copy and never calls onFileSelected —
 * it does not crash or silently drop. Accept attribute is ".pdf" (single) so the OS
 * picker offers PDFs only.
 *
 * Privacy: no fetch, no network — files never leave the browser (PAR-05).
 */
export interface SingleFileUploadZoneProps {
  /** Called with the chosen file only when it is a valid PDF. */
  onFileSelected: (file: File) => void
  /**
   * Optional externally-controlled inline error (e.g. from the parent's own split
   * failure). Rendered in place of any internal per-file validation error.
   */
  error?: string
}

const UNSUPPORTED_COPY =
  'Only PDF files can be split. Choose a PDF and try again.'
const TOO_LARGE_COPY =
  'This file is too large to open in the browser. Try a smaller file.'

export function SingleFileUploadZone({ onFileSelected, error }: SingleFileUploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [internalError, setInternalError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Core ingestion handler — shared by drag-drop and the Browse picker. Takes the
   * first file; reports it only if it is a valid PDF (validateFile === null AND the
   * browser reports application/pdf). Otherwise surfaces a friendly inline error.
   * Never throws.
   */
  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return

      const validationError = validateFile(file)
      if (validationError === null && file.type === 'application/pdf') {
        setInternalError(null)
        onFileSelected(file)
        return
      }

      setInternalError(validationError === 'too-large' ? TOO_LARGE_COPY : UNSUPPORTED_COPY)
    },
    [onFileSelected],
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
    handleFile(e.dataTransfer.files?.[0])
  }

  // ── Picker handlers ────────────────────────────────────────────────────────

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    handleFile(e.target.files?.[0])
    // Reset so the same file can be re-selected after an error.
    e.target.value = ''
  }

  function handleBrowseClick() {
    fileInputRef.current?.click()
  }

  const shownError = internalError ?? error ?? null

  return (
    <div
      role="region"
      aria-label="Split document upload area"
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
      {/* Drop bay — dashed instrument-panel "insert document" frame */}
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
          ▼ INSERT DOCUMENT
        </p>

        <HardwareKey onClick={handleBrowseClick} aria-label="Browse files to open a PDF">
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
          FILE — PDF only · ENGINE — client-side · NET — 0 requests
        </p>
      </div>

      {/* Visually-hidden single-file input — PDF only */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf"
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
