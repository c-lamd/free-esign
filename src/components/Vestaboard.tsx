/**
 * Vestaboard.tsx — SUITE-02 hero centerpiece split-flap display.
 *
 * This is the headline visual of the tools-hub homepage (`/`): a split-flap
 * "vestaboard" documents-processed counter rendered in the instrument-panel
 * idiom (dark LCD face, accent glow, mono per-character cells).
 *
 * LIVE (Phase 13) — the component self-fetches the global count:
 *   - On mount it calls fetchCount() from ../lib/counter ONCE (same-origin
 *     '/api/count' only — never Upstash, never an absolute host) and renders the
 *     resolved number with a per-digit split-flap flip animation (CNT-02).
 *   - While the fetch is pending, and whenever fetchCount resolves null (store
 *     absent / unreachable), it shows the neutral em-dash placeholder — never an
 *     error; the hero and page stay fully usable (CNT-04).
 *   - It still accepts an optional `value` prop as a STATIC override: when
 *     provided it wins over the fetched count and NO network request is made
 *     (preserves the Phase 10 value-prop + zero-network test contract).
 *
 * Visual treatment borrows LcdReadout's glow pattern (--color-lcd-bg recessed
 * face, --color-accent text with text-shadow glow, --font-mono) so it reads as
 * the same instrument family — but as a larger, character-celled display.
 */

import { useEffect, useState } from 'react'
import { fetchCount } from '../lib/counter'

const DEFAULT_LABEL = 'DOCUMENTS PROCESSED'
const PLACEHOLDER_CELL = '—'
/** How many placeholder cells the placeholder state shows when no count is known. */
const PLACEHOLDER_CELL_COUNT = 6

export interface VestaboardProps {
  /**
   * Static override of the displayed count. When provided it wins over the live
   * fetched count AND suppresses the network request (test/storybook use). When
   * undefined, the component fetches the live count from '/api/count' on mount.
   */
  value?: string | number
  /** Accessible caption — defaults to the documents-processed counter copy. */
  label?: string
}

export function Vestaboard({ value, label = DEFAULT_LABEL }: VestaboardProps) {
  // Live count fetched on mount. null = unknown (pending or unreachable) → placeholder.
  const [count, setCount] = useState<number | null>(null)

  useEffect(() => {
    // A static `value` override wins and suppresses the network request entirely
    // (preserves the Phase 10 value-prop + zero-network contract).
    if (value !== undefined) return
    let alive = true
    void fetchCount().then((n) => {
      if (alive) setCount(n)
    })
    return () => {
      alive = false
    }
  }, [value])

  // Resolve the effective display value: the explicit override wins; otherwise the
  // live count (null until it resolves to a number).
  const display = value !== undefined ? value : count

  // Per-character cells. No known value → neutral em-dash placeholder.
  const chars =
    display === null || display === undefined
      ? Array.from({ length: PLACEHOLDER_CELL_COUNT }, () => PLACEHOLDER_CELL)
      : String(display).split('')

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
    // Split-flap flip: each cell briefly rotates/settles when its digit changes.
    // Keyed off the cell's content below (animationName via key remount) so a
    // newly-rendered digit visibly flips into place (CNT-02).
    animation: 'vestaboard-flap 360ms ease-out',
    transition: 'color 360ms ease-out',
    transformOrigin: 'center top',
    backfaceVisibility: 'hidden',
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

  // Accessible name: the readout reads as the documents-processed counter. The
  // real number is announced once known; otherwise "pending". Flap internals are
  // aria-hidden.
  const accessibleValue =
    display === null || display === undefined ? 'pending' : String(display)
  const accessibleName = `${label}: ${accessibleValue}`

  return (
    <div role="img" aria-label={accessibleName} style={faceStyle}>
      {/* Split-flap flip keyframe — injected once; drives the per-cell animation. */}
      <style>{
        '@keyframes vestaboard-flap{0%{transform:rotateX(-90deg);opacity:.2}' +
        '55%{transform:rotateX(12deg);opacity:1}100%{transform:rotateX(0);opacity:1}}'
      }</style>
      <div style={rowStyle} aria-hidden="true">
        {chars.map((ch, i) => (
          // Key on content+index so a changed digit remounts the cell and replays
          // the flip animation (the split-flap "flap" effect).
          <span key={`${i}:${ch}`} data-flap-cell="" style={cellStyle}>
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
