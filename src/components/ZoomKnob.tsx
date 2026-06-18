import { useRef } from 'react'
import { useDocumentStore, ZOOM_STEPS, type ZoomStep } from '../store/documentStore'

/**
 * ZoomKnob — calm rotary zoom control (EDT-05).
 *
 * Visual contract (07-UI-SPEC § 5):
 * - 64px knob face / 80px tick ring + accent arc hit area
 * - Tick ring bounded to 270° travel (mask extended to 272° so end tick isn't clipped)
 * - Hairline 2px accent progress arc tracking current zoom
 * - Accent pointer line rotating within the knob face
 * - Live % readout (aria-live="polite", aria-atomic="true")
 *
 * Store contract (PAR-03):
 * - Drag delta → nearestZoomStep(rawZoom) → setZoom(snappedStep) ONLY
 * - NEVER calls setZoom(rawContinuousValue) — store guard silently ignores non-ZOOM_STEP values
 * - Visual state (pointer angle, arc) derived from documentStore.zoom (the snapped value)
 * - Does NOT apply any CSS transform to the document (LazyPage handles zoom via width prop)
 *
 * Position: same zone as the removed ZoomControl (right: calc(50% + 85px); bottom: 24px)
 */

// Mutable array copy for indexOf / nearest search
const ZOOM_STEPS_ARR = [...ZOOM_STEPS] as ZoomStep[]

/**
 * Exported for testing — snaps a continuous raw zoom value to the nearest ZOOM_STEP.
 * This is the EDT-05 snap-contract function; it is always called before setZoom.
 */
export function nearestZoomStep(raw: number): ZoomStep {
  return ZOOM_STEPS_ARR.reduce((prev, curr) =>
    Math.abs(curr - raw) < Math.abs(prev - raw) ? curr : prev,
  )
}

export function ZoomKnob() {
  const zoom = useDocumentStore((s) => s.zoom)
  const setZoom = useDocumentStore((s) => s.setZoom)
  const numPages = useDocumentStore((s) => s.numPages)

  // Drag state (refs to avoid re-renders during drag)
  const dragState = useRef<{ startY: number; startZoom: number } | null>(null)

  // Mount guard: only render when a document is loaded
  if (!numPages || numPages < 1) return null

  // ── Visual derivation (from snapped store value, NOT raw drag) ────────────────
  const pct = (zoom - 0.5) / (2.0 - 0.5) // 0.0 at 50% → 1.0 at 200%
  const deg = pct * 270

  // ── Drag handlers (pointer capture for cross-element tracking) ────────────────
  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    dragState.current = { startY: e.clientY, startZoom: zoom }
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState.current) return
    const { startY, startZoom } = dragState.current
    const deltaY = startY - e.clientY // drag UP = positive = zoom in
    const sensitivity = 0.007 // 1/0.007 ≈ 143 px per 1.0 zoom unit; full range (0.5→2.0) ≈ 214 px
    const rawZoom = startZoom + deltaY * sensitivity
    const snapped = nearestZoomStep(rawZoom)
    // Only call setZoom when the snapped value actually differs — avoid no-op dispatches
    if (snapped !== zoom) {
      setZoom(snapped)
    }
  }

  function handlePointerUp() {
    dragState.current = null
  }

  // ── Keyboard fallback (WCAG 2.1 AA) ──────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = ZOOM_STEPS_ARR.indexOf(zoom as ZoomStep)

    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      if (idx >= 0 && idx < ZOOM_STEPS_ARR.length - 1) {
        setZoom(ZOOM_STEPS_ARR[idx + 1])
      }
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      if (idx > 0) {
        setZoom(ZOOM_STEPS_ARR[idx - 1])
      }
    } else if (e.key === 'Home') {
      e.preventDefault()
      setZoom(1.0 as ZoomStep)
    }
  }

  // ── Styles (inline, using CSS var tokens) ─────────────────────────────────────

  // Outer fixed wrapper — same position zone as the removed ZoomControl
  const wrapperStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: '24px',
    right: 'calc(50% + 85px)',
    zIndex: 50,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    userSelect: 'none',
  }

  // 80×80px hit area for the knob ring + face
  const knobHitAreaStyle: React.CSSProperties = {
    position: 'relative',
    width: '80px',
    height: '80px',
    cursor: 'ns-resize',
    outline: 'none',
    borderRadius: '50%',
  }

  // Tick ring: repeating-conic-gradient ticks bounded to 272° mask
  // mask extended to 272° so the end-of-travel tick at 270° isn't clipped (07-UI-SPEC § 5)
  const ringStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background:
      'repeating-conic-gradient(from 225deg, var(--color-line-strong) 0 1.3deg, transparent 1.3deg 30deg)',
    WebkitMask: [
      'radial-gradient(circle, transparent 32px, #000 33px 35px, transparent 36px)',
      'conic-gradient(from 225deg, #000 0 272deg, transparent 272deg)',
    ].join(', '),
    WebkitMaskComposite: 'source-in',
    mask: [
      'radial-gradient(circle, transparent 32px, #000 33px 35px, transparent 36px)',
      'conic-gradient(from 225deg, #000 0 272deg, transparent 272deg)',
    ].join(', '),
    maskComposite: 'intersect',
  }

  // Progress arc: hairline 2px conic-gradient overlay in accent color
  // z-index above ring, below face
  const arcStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    background: `conic-gradient(from 225deg, var(--color-accent) ${deg}deg, transparent ${deg}deg)`,
    WebkitMask: [
      'radial-gradient(circle, transparent 32px, #000 33px 35px, transparent 36px)', // match tick ring band (33–35px)
      'conic-gradient(from 225deg, #000 0 272deg, transparent 272deg)',
    ].join(', '),
    WebkitMaskComposite: 'source-in',
    mask: [
      'radial-gradient(circle, transparent 32px, #000 33px 35px, transparent 36px)', // match tick ring band (33–35px)
      'conic-gradient(from 225deg, #000 0 272deg, transparent 272deg)',
    ].join(', '),
    maskComposite: 'intersect',
    zIndex: 1,
  }

  // Knob face: 64px, centered within the 80px hit area (8px margin each side)
  const faceStyle: React.CSSProperties = {
    position: 'absolute',
    top: '8px',
    left: '8px',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'radial-gradient(circle at 40% 33%, #fcfaf4, #ece6d9 52%, #ccc3b1 100%)',
    border: '1px solid var(--color-line-strong)',
    boxShadow:
      '0 3px 6px rgba(40,32,20,.22), inset 0 1px 0 #fff, inset 0 -2px 4px rgba(0,0,0,.13)',
    zIndex: 2,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  // Accent pointer: 2px × 20px line, rotating from center
  // transform-origin at center; rotate to -135 + deg
  const pointerStyle: React.CSSProperties = {
    position: 'absolute',
    width: '2px',
    height: '22px',
    background: 'var(--color-accent)',
    borderRadius: '1px',
    // The pointer pivots at its center, so the bottom half extends past center
    // toward the face edge; bottom half anchors at center, top half points outward
    transformOrigin: 'center bottom',
    transform: `rotate(${-135 + deg}deg)`,
    top: '10px', // position from top of face, pivot at bottom = center of 64px face (10px + 22px = 32px ✓)
    left: 'calc(50% - 1px)',
    zIndex: 3,
  }

  // % readout below the knob
  const readoutStyle: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    fontWeight: 400,
    color: 'var(--color-ink-muted)',
    lineHeight: 1,
    letterSpacing: '0.04em',
  }

  return (
    <div style={wrapperStyle}>
      {/* Knob hit area: handles drag + keyboard events + ARIA */}
      <div
        role="slider"
        aria-valuenow={Math.round(zoom * 100)}
        aria-valuemin={50}
        aria-valuemax={200}
        aria-label="Document zoom — drag up to zoom in, drag down to zoom out"
        tabIndex={0}
        style={knobHitAreaStyle}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onLostPointerCapture={handlePointerUp}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '3px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
      >
        {/* Layer 1: Tick ring (bottom) */}
        <div aria-hidden="true" style={ringStyle} />

        {/* Layer 2: Progress arc (above ring) */}
        <div aria-hidden="true" style={arcStyle} />

        {/* Layer 3: Knob face (above arc) */}
        <div aria-hidden="true" style={faceStyle}>
          {/* Layer 4: Accent pointer (rotates within face) */}
          <div style={pointerStyle} />
        </div>
      </div>

      {/* Live % readout below knob */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={readoutStyle}
      >
        {Math.round(zoom * 100)}%
      </span>
    </div>
  )
}
