import { useDocumentStore } from '../store/documentStore'
import { useFieldStore } from '../store/fieldStore'
import { exportSignedPdf, triggerDownload, signedFilename } from '../lib/exportPdf'

export function TopBar() {
  const view = useDocumentStore((s) => s.view)
  const reset = useDocumentStore((s) => s.reset)
  const originalPdfBytes = useDocumentStore((s) => s.originalPdfBytes)
  const fileName = useDocumentStore((s) => s.fileName)
  const setExportError = useDocumentStore((s) => s.setExportError)
  const openModal = useFieldStore((s) => s.openModal)
  const fields = useFieldStore((s) => s.fields)

  function handleOpenAnother() {
    // Blob URL is revoked by DocumentViewer's useEffect cleanup after unmount (WR-01).
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
      <span
        style={{
          fontSize: '24px',
          fontWeight: 600,
          lineHeight: 1.1,
          color: 'var(--color-text-primary)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        FreeESign
      </span>

      {view === 'loaded' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* "Add signature" trigger — ghost/secondary style; opens the draw modal */}
          <button
            onClick={openModal}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
              padding: '8px',
              minHeight: '44px',
              minWidth: '44px',
              borderRadius: '4px',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-text-primary)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-text-secondary)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-accent)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
            aria-label="Add signature — open drawing modal"
          >
            Add signature
          </button>

          {/* "Download PDF" — primary export CTA (UI-SPEC: between Add signature and Open another) */}
          <button
            onClick={() => { void handleDownload() }}
            aria-disabled={isDownloadDisabled ? 'true' : undefined}
            aria-label={
              isDownloadDisabled
                ? 'Download PDF — place at least one signature first'
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

          <button
            onClick={handleOpenAnother}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            padding: '8px',
            minHeight: '44px',
            minWidth: '44px',
            borderRadius: '4px',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-accent)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-secondary)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-accent)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
            aria-label="Open another document"
          >
            Open another
          </button>
        </div>
      )}
    </header>
  )
}
