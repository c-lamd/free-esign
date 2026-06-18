import { useState, useRef, useCallback } from 'react'
import { useDocumentStore } from '../store/documentStore'
import { validateFile } from '../lib/fileValidation'
import { wrapImageAsPdfWithBytes } from '../lib/imageWrapper'
import { WordDocBanner } from './WordDocBanner'
import { HardwareKey } from './ui/HardwareKey'

/**
 * UploadZone — full-screen drag-and-drop + Browse empty state.
 *
 * Interaction model:
 *   - Drag a PDF/JPG/PNG anywhere onto this zone → validate → load
 *   - Click "Browse files" → opens hidden file input → validate → load
 *   - Invalid type  → setError(unsupported-type copy)
 *   - Over 100 MB   → setError(too-large copy)
 *   - Corrupt image → setError(corrupt-file copy)
 *   - Valid PDF     → URL.createObjectURL → loadDocument
 *   - Valid image   → wrapImageAsPdf → Blob URL → loadDocument
 *
 * Security: all validation goes through validateFile() before any byte reads.
 * See threat model entries T-01-05 through T-01-07 in 01-03-PLAN.md.
 */
export function UploadZone() {
  const loadDocument = useDocumentStore((s) => s.loadDocument)
  const setError = useDocumentStore((s) => s.setError)
  const setView = useDocumentStore((s) => s.setView)
  const setOriginalPdfBytes = useDocumentStore((s) => s.setOriginalPdfBytes)
  const setFileName = useDocumentStore((s) => s.setFileName)

  const [isDragOver, setIsDragOver] = useState(false)
  const [wordDocMode, setWordDocMode] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Core ingestion handler — used by both drag-drop and Browse picker.
   * Validates, wraps images if needed, then loads into the store.
   *
   * Stores originalPdfBytes and fileName for use by the export/download handler.
   * - PDF path: reads file bytes via arrayBuffer() and stores them directly.
   * - Image path (EXP-03): wrapImageAsPdfWithBytes returns both the Blob URL
   *   and the wrapped PDF bytes; the bytes are stored as originalPdfBytes so
   *   exportSignedPdf() produces a PDF containing the image + signature.
   */
  const handleFile = useCallback(
    async (file: File) => {
      // Reset word-doc mode at the start of any new file pick — ensures that
      // a subsequent valid file clears the banner without needing the "Choose a
      // PDF instead" button.
      setWordDocMode(false)

      const validationError = validateFile(file)

      // Word-doc detected — show friendly guidance banner, never a generic error
      // and never attempt a silent conversion (DOC-05, T-03-05).
      if (validationError === 'word-doc') {
        setWordDocMode(true)
        return
      }

      if (validationError === 'unsupported-type') {
        setError(
          'Only PDF, JPG, and PNG files are supported. Try another file.',
        )
        return
      }

      if (validationError === 'too-large') {
        setError(
          'This file is too large to open in the browser. Try a smaller file.',
        )
        return
      }

      // Store the original filename for the download handler (signedFilename())
      setFileName(file.name)

      // File is valid — transition to loading state immediately
      // Images need to be wrapped; PDFs go straight through
      if (file.type === 'image/jpeg' || file.type === 'image/png') {
        setView('loading') // show spinner before the async wrap (can take seconds for large images)
        try {
          const { url: blobUrl, bytes } = await wrapImageAsPdfWithBytes(file)
          // EXP-03: store the wrapped PDF bytes so export includes the image
          setOriginalPdfBytes(bytes.buffer as ArrayBuffer)
          loadDocument(blobUrl)
        } catch {
          setError(
            "This file couldn't be read. It may be corrupt or password-protected. Try another file.",
          )
        }
      } else {
        // PDF — read bytes for export, then create a Blob URL for display
        // (Pitfall 5: Blob URLs cannot recover bytes; must read before createObjectURL)
        const bytes = await file.arrayBuffer()
        setOriginalPdfBytes(bytes)
        const blobUrl = URL.createObjectURL(file)
        loadDocument(blobUrl)
      }
    },
    [loadDocument, setError, setView, setOriginalPdfBytes, setFileName],
  )

  // ── Drag event handlers ──────────────────────────────────────────────────

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
    // Only clear drag state when leaving the zone entirely (not a child element)
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setIsDragOver(false)
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const file = e.dataTransfer.files?.[0]
    if (file) {
      void handleFile(file)
    }
  }

  // ── File picker handler ──────────────────────────────────────────────────

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      void handleFile(file)
    }
    // Reset the input so the same file can be re-selected after an error
    e.target.value = ''
  }

  function handleBrowseClick() {
    fileInputRef.current?.click()
  }

  function handleBrowseKeyDown(e: React.KeyboardEvent<HTMLButtonElement>) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  // ── Styles ───────────────────────────────────────────────────────────────

  const zoneStyle: React.CSSProperties = {
    minHeight: 'calc(100dvh - 56px)',
    backgroundColor: isDragOver
      ? 'var(--color-accent-soft)'
      : 'var(--color-surface)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px 16px',
    // Drag-over state: 2px dashed accent border (UI-SPEC interaction states)
    outline: isDragOver ? '2px dashed var(--color-accent)' : 'none',
    outlineOffset: isDragOver ? '-2px' : '0',
    borderRadius: isDragOver ? '8px' : '0',
    transition: 'background-color 0.15s ease, outline 0.1s ease',
    // Prevent text selection during drag
    userSelect: 'none',
  }

  return (
    <div
      role="region"
      aria-label="Document upload area"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={zoneStyle}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0',
        }}
      >
        {/* Word-doc guidance banner — swaps out upload content (DOC-05) */}
        {wordDocMode ? (
          <WordDocBanner onChoosePdf={() => setWordDocMode(false)} />
        ) : (
          <>
            {/* Drop bay — dashed instrument-panel "insert document" frame (LND-06) */}
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
              {/* Primary label — mono chrome label (UI-SPEC § Surface 2) */}
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

              {/* Browse trigger — HardwareKey (replaces ad-hoc button) */}
              <HardwareKey
                onClick={handleBrowseClick}
                aria-label="Browse files to open"
              >
                ⏏ BROWSE FILES
              </HardwareKey>

              {/* Status line — static privacy architecture display (aria-hidden) */}
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
                FILE — none · ENGINE — client-side · NET — 0 requests
              </p>
            </div>

            {/* Visually-hidden file input — activated by Browse key (accept list unchanged) */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
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

            {/* Privacy line — below the drop bay (copy contract: verbatim) */}
            <p
              style={{
                fontFamily: 'system-ui',
                fontSize: '14px',
                fontWeight: 400,
                color: 'var(--color-text-secondary)',
                marginTop: '16px',
                marginBottom: 0,
              }}
            >
              Your files never leave your browser.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
