/**
 * Vestaboard.tsx — SUITE-02 hero centerpiece split-flap display (Phase 10).
 *
 * This is the headline visual of the tools-hub homepage (`/`): a split-flap
 * "vestaboard" documents-processed counter rendered in the instrument-panel
 * idiom (dark LCD face, accent glow, mono per-character cells).
 *
 * STATIC SHELL — this phase only. The component is pure and presentational:
 *   - It accepts a `value` prop (string | number) and renders one flap cell per
 *     character.
 *   - With NO value it renders a neutral placeholder (em-dash cells) — the
 *     Phase 10 static state.
 *   - It makes ZERO network requests (no fetch, no /api). Phase 13 owns wiring
 *     it to /api/count plus the live digit-flip animation; reserving the slot
 *     and shipping the shell now makes P13 pure plumbing (T-10-04: a fetch-spy
 *     test asserts no request is made on render).
 *
 * Visual treatment borrows LcdReadout's glow pattern (--color-lcd-bg recessed
 * face, --color-accent text with text-shadow glow, --font-mono) so it reads as
 * the same instrument family — but as a larger, character-celled display.
 */

const DEFAULT_LABEL = 'DOCUMENTS PROCESSED'
const PLACEHOLDER_CELL = '—'
/** How many placeholder cells the static state shows when no value is supplied. */
const PLACEHOLDER_CELL_COUNT = 6

export interface VestaboardProps {
  /** The count to display. When undefined, a neutral em-dash placeholder shows. */
  value?: string | number
  /** Accessible caption — defaults to the documents-processed counter copy. */
  label?: string
}

export function Vestaboard({ value, label = DEFAULT_LABEL }: VestaboardProps) {
  // Per-character cells. No value → neutral em-dash placeholder (static state).
  const chars =
    value === undefined
      ? Array.from({ length: PLACEHOLDER_CELL_COUNT }, () => PLACEHOLDER_CELL)
      : String(value).split('')

  const faceStyle: React.CSSProperties = {
    background: 'var(--color-lcd-bg)',
    borderRadius: '8px',
    padding: '20px 22px',
    boxShadow: 'inset 0 2px 8px rgba(0,0,0,.7), inset 0 0 0 1px #000',
    position: 'relative',
    overflow: 'hidden',
    display: 'inline-flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  }

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    gap: '8px',
  }

  const cellStyle: React.CSSProperties = {
    // A single split-flap cell: dark recessed panel with the accent glow.
    minWidth: '0.78em',
    padding: '10px 12px',
    background: 'color-mix(in srgb, var(--color-lcd-bg) 80%, #000)',
    borderRadius: '4px',
    // The horizontal seam that gives a flap its split-flap character.
    borderTop: '1px solid rgba(255,255,255,0.04)',
    borderBottom: '1px solid #000',
    boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.8)',
    color: 'var(--color-accent)',
    fontFamily: 'var(--font-mono)',
    fontSize: 'clamp(32px, 8vw, 56px)',
    fontWeight: 600,
    lineHeight: 1,
    letterSpacing: '0.04em',
    textAlign: 'center',
    textShadow: '0 0 12px color-mix(in srgb, var(--color-accent) 60%, transparent)',
    position: 'relative',
  }

  const captionStyle: React.CSSProperties = {
    color: 'color-mix(in srgb, var(--color-accent) 80%, transparent)',
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    textShadow: '0 0 6px color-mix(in srgb, var(--color-accent) 45%, transparent)',
  }

  const scanlineStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background:
      'repeating-linear-gradient(to bottom, transparent 0, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 3px)',
    pointerEvents: 'none',
    borderRadius: '8px',
  }

  // Accessible name: the readout reads as the documents-processed counter even
  // while static. The decorative flap internals are aria-hidden.
  const accessibleValue = value === undefined ? 'pending' : String(value)
  const accessibleName = `${label}: ${accessibleValue}`

  return (
    <div role="img" aria-label={accessibleName} style={faceStyle}>
      <div style={rowStyle} aria-hidden="true">
        {chars.map((ch, i) => (
          <span key={i} data-flap-cell="" style={cellStyle}>
            {ch}
          </span>
        ))}
      </div>

      <div style={captionStyle} aria-hidden="true">
        {label}
      </div>

      <div style={scanlineStyle} aria-hidden="true" />
    </div>
  )
}
