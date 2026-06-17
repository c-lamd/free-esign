import { useDocumentStore, ZOOM_STEPS } from '../store/documentStore'

/**
 * ZoomControl — fixed bottom-center pill for document zoom (50–200%).
 *
 * Positioned to the left of the PageNavigation pill (same bottom row, 12px gap).
 * Layout within the pill: [−] [readout] [+] [Fit]
 *
 * Accessibility:
 * - Zoom-out/zoom-in use aria-disabled="true" (not HTML disabled) at limits so focus
 *   remains reachable (WCAG 2.5.5, established pattern from PageNavigation).
 * - Percentage readout has aria-live="polite" + aria-atomic="true".
 * - Each button has both aria-label and an inner <span class="sr-only">.
 * - Focus ring: 2px solid var(--color-accent), outlineOffset 2px.
 * - 44px minimum touch target on all buttons.
 *
 * Zoom architecture:
 * - Reads zoom from documentStore; calls setZoom via ZOOM_STEPS index arithmetic.
 * - "Fit" resets zoom to 1.0 (fit-to-width baseline per RESEARCH A2).
 * - At the minimum (0.5) zoom-out is disabled; at maximum (2.0) zoom-in is disabled.
 */
export function ZoomControl() {
  const zoom = useDocumentStore((s) => s.zoom)
  const setZoom = useDocumentStore((s) => s.setZoom)
  const numPages = useDocumentStore((s) => s.numPages)

  // Only render when a document is loaded
  if (!numPages || numPages < 1) return null

  const isAtMin = zoom <= ZOOM_STEPS[0]
  const isAtMax = zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]

  function handleZoomOut() {
    if (isAtMin) return
    const idx = ZOOM_STEPS.indexOf(zoom as (typeof ZOOM_STEPS)[number])
    if (idx > 0) setZoom(ZOOM_STEPS[idx - 1])
  }

  function handleZoomIn() {
    if (isAtMax) return
    const idx = ZOOM_STEPS.indexOf(zoom as (typeof ZOOM_STEPS)[number])
    if (idx >= 0 && idx < ZOOM_STEPS.length - 1) setZoom(ZOOM_STEPS[idx + 1])
  }

  function handleFit() {
    setZoom(1.0)
  }

  const buttonBase: React.CSSProperties = {
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    borderRadius: '6px',
    padding: '0 8px',
    outline: 'none',
    transition: 'color 0.15s',
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        // Position to the left of the PageNavigation pill.
        // PageNavigation is centered at left:50%/translateX(-50%).
        // A centered PageNav pill ~130px wide sits from ~(50%-65px) to ~(50%+65px).
        // We place ZoomControl at right: calc(50% + 65px + 12px) = calc(50% + 77px)
        // using right offset so it clears the PageNav pill with a ~12px gap.
        right: 'calc(50% + 85px)',
        backgroundColor: 'var(--color-surface-elevated)',
        borderRadius: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        zIndex: 50,
      }}
    >
      {/* Zoom-out button */}
      <button
        aria-label={isAtMin ? 'Zoom out (already at minimum)' : 'Zoom out'}
        aria-disabled={isAtMin ? 'true' : undefined}
        onClick={handleZoomOut}
        style={{
          ...buttonBase,
          cursor: isAtMin ? 'default' : 'pointer',
          opacity: isAtMin ? 0.35 : 1,
          color: 'var(--color-text-primary)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        onMouseEnter={(e) => {
          if (!isAtMin) e.currentTarget.style.color = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-primary)'
        }}
      >
        <span className="sr-only">Zoom out</span>
        {/* 16px inline minus icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M3 8H13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Percentage readout */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: 1.4,
          color: 'var(--color-text-secondary)',
          minWidth: '48px',
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        {Math.round(zoom * 100)}%
      </span>

      {/* Zoom-in button */}
      <button
        aria-label={isAtMax ? 'Zoom in (already at maximum)' : 'Zoom in'}
        aria-disabled={isAtMax ? 'true' : undefined}
        onClick={handleZoomIn}
        style={{
          ...buttonBase,
          cursor: isAtMax ? 'default' : 'pointer',
          opacity: isAtMax ? 0.35 : 1,
          color: 'var(--color-text-primary)',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        onMouseEnter={(e) => {
          if (!isAtMax) e.currentTarget.style.color = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-primary)'
        }}
      >
        <span className="sr-only">Zoom in</span>
        {/* 16px inline plus icon */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M8 3V13M3 8H13"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {/* Fit button — resets to 1.0 (fit-to-width) */}
      <button
        aria-label="Reset to fit width"
        onClick={handleFit}
        style={{
          ...buttonBase,
          cursor: 'pointer',
          fontSize: '13px',
          fontWeight: 400,
          color: 'var(--color-text-secondary)',
          padding: '0 6px',
          minWidth: 'unset',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-secondary)'
        }}
      >
        <span className="sr-only">Reset zoom to fit width</span>
        <span aria-hidden="true">Fit</span>
      </button>
    </div>
  )
}
