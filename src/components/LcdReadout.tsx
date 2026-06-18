/**
 * LcdReadout.tsx — EDT-03 LCD session-status readout (Phase 7).
 *
 * Presentational read-only component — subscribes to documentStore and
 * fieldStore via granular selectors (NOT object selectors, per 07-RESEARCH
 * Anti-pattern). Writes to NO store.
 *
 * Visual contract from 07-UI-SPEC § 3 and editor-and-landing-layout.md .lcd:
 *   - Dark recessed #15120E background
 *   - Accent mono text with glow (text-shadow) + faint scanline overlay
 *   - Two rows: guarantee line (aria-hidden) + live status line (role="status")
 *
 * Mount guard: returns null when numPages is null or < 1 (no document loaded).
 */

import { useDocumentStore } from '../store/documentStore'
import { useFieldStore } from '../store/fieldStore'

export function LcdReadout() {
  // Granular selectors — one subscription per store field to minimise re-renders
  const currentPage = useDocumentStore((s) => s.currentPage)
  const numPages = useDocumentStore((s) => s.numPages)
  const zoom = useDocumentStore((s) => s.zoom)
  const fieldCount = useFieldStore((s) => s.fields.length)

  // Mount guard: only render when a document is loaded
  if (!numPages || numPages < 1) return null

  // Build zero-padded status segments per 07-UI-SPEC § 3 Copywriting Contract
  const pgStr = `PG ${String(currentPage).padStart(2, '0')}/${String(numPages).padStart(2, '0')}`
  const zmStr = `ZM ${Math.round(zoom * 100)}`
  const fldStr = `FLD ${String(fieldCount).padStart(2, '0')}`

  // LCD container styles — ported from editor-and-landing-layout.md .lcd
  const lcdContainerStyle: React.CSSProperties = {
    background: 'var(--color-lcd-bg)',
    borderRadius: '5px',
    padding: '9px 14px',
    boxShadow: 'inset 0 2px 6px rgba(0,0,0,.65), inset 0 0 0 1px #000',
    position: 'relative',
    overflow: 'hidden',
    flexShrink: 0,
  }

  // LCD text row styles — ported from editor-and-landing-layout.md .lcd .row
  const rowStyle: React.CSSProperties = {
    color: 'var(--color-accent)',
    fontFamily: 'var(--font-mono)',
    letterSpacing: '0.12em',
    fontSize: '11px',
    lineHeight: 1.4,
    textShadow: '0 0 7px color-mix(in srgb, var(--color-accent) 65%, transparent)',
    textTransform: 'uppercase',
    whiteSpace: 'nowrap',
  }

  // Scanline overlay style (optional flourish — pointer-events:none, no layout effect)
  const scanlineStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background:
      'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 3px)',
    pointerEvents: 'none',
    borderRadius: '5px',
  }

  return (
    <div aria-label="Document session status" style={lcdContainerStyle}>
      {/* Guarantee line — decorative, aria-hidden */}
      <div aria-hidden="true" style={rowStyle}>
        {'● ORIG.BYTES OK'}
      </div>

      {/* Live status line — polite, atomic for screen readers */}
      <div role="status" aria-live="polite" aria-atomic="true" style={rowStyle}>
        {`${pgStr} · ${zmStr} · ${fldStr}`}
      </div>

      {/* Scanline overlay flourish */}
      <div style={scanlineStyle} aria-hidden="true" />
    </div>
  )
}
