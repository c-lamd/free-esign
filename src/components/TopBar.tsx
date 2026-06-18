import { useDocumentStore } from '../store/documentStore'
import { useFieldStore } from '../store/fieldStore'
import { exportSignedPdf, triggerDownload, signedFilename } from '../lib/exportPdf'
import { FieldPalette } from './FieldPalette'
import { UndoRedoControls } from './UndoRedoControls'
import { Wordmark } from './Wordmark'
import { HardwareKey } from './ui/HardwareKey'

export function TopBar() {
  const view = useDocumentStore((s) => s.view)
  const reset = useDocumentStore((s) => s.reset)
  const goToLanding = useDocumentStore((s) => s.goToLanding)
  const originalPdfBytes = useDocumentStore((s) => s.originalPdfBytes)
  const fileName = useDocumentStore((s) => s.fileName)
  const setExportError = useDocumentStore((s) => s.setExportError)
  const fields = useFieldStore((s) => s.fields)

  function handleOpenAnother() {
    // Blob URL is revoked by DocumentViewer's useEffect cleanup after unmount (WR-01).
    // Reset placed fields before returning to empty view so fields from the
    // current document do not bleed onto the next document (WR-01 field-leak fix).
    useFieldStore.getState().resetFields()
    reset()
  }

  /**
   * Download handler — EXP-01 / T-02-02 / T-02-10.
   *
   * Guard: returns early if zero fields are placed (aria-disabled guard) or
   * if originalPdfBytes is null (defensive guard; should not normally happen).
   * Clears any prior export error, then calls exportSignedPdf + triggerDownload.
   * On failure surfaces the inline ExportErrorBanner copy (T-02-02).
   * Does NOT reset the document or fields after download (LOCKED CONTEXT.md).
   */
  async function handleDownload() {
    // T-02-10: guard zero fields and null bytes
    if (fields.length === 0 || !originalPdfBytes) return

    setExportError(null)

    try {
      const out = await exportSignedPdf(originalPdfBytes, fields)
      triggerDownload(out, signedFilename(fileName ?? 'document.pdf'))
    } catch {
      // T-02-02: surface export failure in the inline banner
      setExportError('Could not export the signed PDF. Try downloading again.')
    }
  }

  const isDownloadDisabled = fields.length === 0

  return (
    <header
      style={{
        height: '56px',
        backgroundColor: 'var(--color-surface-elevated)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <button
        type="button"
        onClick={() => {
          // Reset placed fields before navigating away so they never leak
          // onto a subsequently loaded document (WR-01 field-leak fix).
          useFieldStore.getState().resetFields()
          goToLanding()
        }}
        aria-label="free·esign — return to home"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '24px',
          fontWeight: 600,
          lineHeight: 1.1,
          color: 'var(--color-text-primary)',
          padding: 0,
          fontFamily: 'inherit',
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--color-text-primary)'
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
      >
        <Wordmark />
      </button>

      {view === 'loaded' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* UndoRedoControls — leftmost in the loaded group per UI-SPEC order */}
          <UndoRedoControls />

          {/* Visual separator between undo/redo and field palette */}
          <div
            aria-hidden="true"
            style={{
              width: '1px',
              height: '20px',
              backgroundColor: 'var(--color-border)',
              margin: '0 4px',
              flexShrink: 0,
            }}
          />

          {/* FieldPalette — five field type buttons (Signature, Initials, Date, Text, Checkbox) */}
          <FieldPalette />

          {/* Visual separator between palette and download group */}
          <div
            aria-hidden="true"
            style={{
              width: '1px',
              height: '20px',
              backgroundColor: 'var(--color-border)',
              margin: '0 4px',
              flexShrink: 0,
            }}
          />

          {/* "Download PDF" — primary export CTA */}
          <button
            onClick={() => { void handleDownload() }}
            aria-disabled={isDownloadDisabled ? 'true' : undefined}
            aria-label={
              isDownloadDisabled
                ? 'Download PDF — place at least one field first'
                : 'Download PDF'
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF',
              fontSize: '14px',
              fontWeight: 400,
              padding: '8px 16px',
              borderRadius: '6px',
              minHeight: '44px',
              border: 'none',
              cursor: isDownloadDisabled ? 'default' : 'pointer',
              opacity: isDownloadDisabled ? 0.45 : 1,
              outline: 'none',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              if (!isDownloadDisabled) {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  '#1D4ED8'
              }
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'var(--color-accent)'
            }}
            onMouseDown={(e) => {
              if (!isDownloadDisabled) {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  '#1E40AF'
              }
            }}
            onMouseUp={(e) => {
              if (!isDownloadDisabled) {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  '#1D4ED8'
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-accent)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
              e.currentTarget.style.backgroundColor = 'var(--color-accent)'
            }}
          >
            Download PDF
          </button>

          <HardwareKey
            onClick={handleOpenAnother}
            aria-label="Open another document"
          >
            Open another
          </HardwareKey>
        </div>
      )}
    </header>
  )
}
