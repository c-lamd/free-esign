import { useDocumentStore } from '../store/documentStore'
import { useFieldStore } from '../store/fieldStore'
import { exportSignedPdf, triggerDownload, signedFilename } from '../lib/exportPdf'
import { recordExport } from '../lib/counter'
import { FieldPalette } from './FieldPalette'
import { UndoRedoControls } from './UndoRedoControls'
import { Wordmark } from './Wordmark'
import { HardwareKey } from './ui/HardwareKey'
import { LcdReadout } from './LcdReadout'
import { ZoomKnob } from './ZoomKnob'

export function TopBar({ onHome }: { onHome?: () => void } = {}) {
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
      // CNT-03: count the signing export exactly once, only on the genuine success
      // path (after export resolves AND the download fires). The increment lives
      // ONLY here — NOT inside exportPdf.ts / coordinateMapper.ts, which stay
      // byte-identity-protected and untouched. Fire-and-forget; never blocks.
      recordExport()
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
        borderBottom: '1px solid var(--color-line-strong)',
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
          // onHome (supplied by the router-aware SignRoute) navigates to the
          // tools hub; bare renders (unit tests) fall back to the in-store
          // landing reset so TopBar needs no Router context on its own.
          if (onHome) onHome()
          else goToLanding()
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
              backgroundColor: 'var(--color-line-strong)',
              margin: '0 4px',
              flexShrink: 0,
            }}
          />

          {/* FieldPalette — five numbered hardware field type keys */}
          <FieldPalette />

          {/* Visual separator between palette and action keys group */}
          <div
            aria-hidden="true"
            style={{
              width: '1px',
              height: '20px',
              backgroundColor: 'var(--color-line-strong)',
              margin: '0 4px',
              flexShrink: 0,
            }}
          />

          {/* LCD readout — shows live session status; renders only when numPages > 0 */}
          <LcdReadout />

          {/* Visual separator between LCD and zoom knob */}
          <div
            aria-hidden="true"
            style={{
              width: '1px',
              height: '20px',
              backgroundColor: 'var(--color-line-strong)',
              margin: '0 4px',
              flexShrink: 0,
            }}
          />

          {/* ZoomKnob — inline rotary zoom control (EDT-05); self-gates on numPages > 0 */}
          <ZoomKnob />

          {/* Visual separator between zoom knob and OPEN key */}
          <div
            aria-hidden="true"
            style={{
              width: '1px',
              height: '20px',
              backgroundColor: 'var(--color-line-strong)',
              margin: '0 4px',
              flexShrink: 0,
            }}
          />

          {/* OPEN key — replaces "Open another" text; wiring + aria-label preserved (PAR-01) */}
          <HardwareKey
            onClick={handleOpenAnother}
            aria-label="Open another document"
          >
            OPEN
          </HardwareKey>

          {/* EXPORT key — replaces accent Download PDF button; aria-labels preserved (PAR-01) */}
          <HardwareKey
            onClick={() => { void handleDownload() }}
            disabled={isDownloadDisabled}
            aria-label={
              isDownloadDisabled
                ? 'Download PDF — place at least one field first'
                : 'Download PDF'
            }
          >
            EXPORT
          </HardwareKey>
        </div>
      )}
    </header>
  )
}
