import { useRef } from 'react'
import { useDocumentStore, ZOOM_MIN, ZOOM_MAX, ZOOM_KEY_STEP } from '../store/documentStore'

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
 * - Drag delta → rawZoom (1% granularity via Math.round) → setZoom(rawZoom)
 * - Store clamps to [ZOOM_MIN, ZOOM_MAX]; no discrete snapping
 * - Visual state (pointer angle, arc) derived from documentStore.zoom
 * - Does NOT apply any CSS transform to the document (LazyPage handles zoom via width prop)
 *
 * Position: inline in the TopBar loaded-view right group, between the LCD readout and the OPEN key.
 * The knob is visually scaled to ~40×40px via a CSS transform wrapper; internal geometry is unchanged.
 */

export function ZoomKnob() {
  const zoom = useDocumentStore((s) => s.zoom)
  const setZoom = useDocumentStore((s) => s.setZoom)
  const numPages = useDocumentStore((s) => s.numPages)

  // Drag state (refs to avoid re-renders during drag)
  const dragState = useRef<{ startY: number; startZoom: number } | null>(null)

  // Mount guard: only render when a document is loaded
  if (!numPages || numPages < 1) return null

  // ── Visual derivation ─────────────────────────────────────────────────────────
  const pct = (zoom - ZOOM_MIN) / (ZOOM_MAX - ZOOM_MIN)
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
    const sensitivity = 0.007 // 1/0.007 ≈ 143 px per 1.0 zoom unit; full range (0.1→2.0) ≈ 271 px
    const rawZoom = startZoom + deltaY * sensitivity
    // Round to 1% granularity → clean integer % readout; store clamps to [ZOOM_MIN, ZOOM_MAX]
    setZoom(Math.round(rawZoom * 100) / 100)
  }

  function handlePointerUp() {
    dragState.current = null
  }

  // ── Keyboard fallback (WCAG 2.1 AA) ──────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') {
      e.preventDefault()
      setZoom(zoom + ZOOM_KEY_STEP)
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') {
      e.preventDefault()
      setZoom(zoom - ZOOM_KEY_STEP)
    } else if (e.key === 'Home') {
      e.preventDefault()
      setZoom(1.0)
    }
  }

  // ── Styles (inline, using CSS var tokens) ─────────────────────────────────────

  // Outer inline-row wrapper — flows inside the TopBar right group (no fixed positioning)
  const wrapperStyle: React.CSSProperties = {
    display: 'inline-flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '6px',
    userSelect: 'none',
  }

  // 40×40px sizing box that visually contains the 80px hit area via scale(0.5)
  const sizingBoxStyle: React.CSSProperties = {
    width: '40px',
    height: '40px',
    position: 'relative',
    flexShrink: 0,
  }

  // 80×80px hit area for the knob ring + face.
  // Positioned at top-left of the 40px sizing box and scaled to 0.5 so it visually
  // occupies 40×40px. CSS transform does NOT affect clientY screen coordinates —
  // drag sensitivity (0.007) is unchanged (PAR-03).
  const knobHitAreaStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    transform: 'scale(0.5)',
    transformOrigin: 'top left',
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

  // % readout inline to the right of the knob
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
      {/* 40×40 sizing box: contains the 80px hit area visually scaled to 40px */}
      <div style={sizingBoxStyle}>
        {/* Knob hit area: handles drag + keyboard events + ARIA */}
        <div
          role="slider"
          aria-valuenow={Math.round(zoom * 100)}
          aria-valuemin={10}
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
      </div>

      {/* Live % readout inline to the right of the knob */}
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
