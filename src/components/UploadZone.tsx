import { useState, useRef, useCallback } from 'react'
import { useDocumentStore } from '../store/documentStore'
import { validateFile } from '../lib/fileValidation'
import { wrapImageAsPdfWithBytes } from '../lib/imageWrapper'
import { WordDocBanner } from './WordDocBanner'

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
      ? 'rgba(255, 255, 255, 0.4)'
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

  const contentColumnStyle: React.CSSProperties = {
    maxWidth: '480px',
    width: '100%',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0',
  }

  const browseButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-accent)',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 400,
    padding: '8px 16px',
    borderRadius: '6px',
    cursor: 'pointer',
    minHeight: '44px',
    minWidth: '44px',
    border: 'none',
    fontFamily: 'inherit',
    // Focus ring applied via onFocus/onBlur handlers for IE11-safe focus management
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
      <div style={contentColumnStyle}>
        {/* Word-doc guidance banner — swaps out upload content (DOC-05) */}
        {wordDocMode ? (
          <WordDocBanner onChoosePdf={() => setWordDocMode(false)} />
        ) : (
          <>
        {/* Upload icon — 48×48, secondary color (UI-SPEC) */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            display: 'inline-block',
            marginBottom: '16px',
            color: 'var(--color-text-secondary)',
          }}
          aria-hidden="true"
        >
          <path
            d="M24 8L24 32M24 8L16 16M24 8L32 16"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 36V40H40V36"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        {/* Heading — "Drop your document here" (copy contract) */}
        <h1
          style={{
            fontSize: '20px',
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'var(--color-text-primary)',
            margin: '0 0 8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          Drop your document here
        </h1>

        {/* Secondary prompt — "or" (copy contract) */}
        <p
          style={{
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            margin: '0 0 12px',
          }}
        >
          or
        </p>

        {/* Browse files button — min 44×44 touch target (UI-SPEC accessibility) */}
        <button
          type="button"
          onClick={handleBrowseClick}
          onKeyDown={handleBrowseKeyDown}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'var(--color-accent-hover)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
              'var(--color-accent)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-accent)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
            e.currentTarget.style.backgroundColor = 'var(--color-accent)'
          }}
          style={browseButtonStyle}
          aria-label="Browse files to open"
        >
          Browse files
        </button>

        {/* Visually-hidden file input — activated by Browse button */}
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

        {/* Privacy line — "Your files never leave your browser." (copy contract) */}
        <p
          style={{
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            marginTop: '24px',
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
