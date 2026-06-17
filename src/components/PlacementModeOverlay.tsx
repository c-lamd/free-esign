/**
 * PlacementModeOverlay.tsx
 *
 * Sticky banner shown while placement mode is armed (placementMode === true).
 * Informs the user to click on the document to place their signature.
 * Provides a "Stop placing" link that disarms placement mode.
 * Listens for Escape key to cancel placement mode while armed.
 *
 * @see 02-UI-SPEC.md PlacementModeOverlay
 * @see 02-CONTEXT.md Placing the Signature
 * @see src/store/fieldStore.ts (placementMode, setPlacementMode)
 */

import { useEffect } from 'react'
import { useFieldStore } from '../store/fieldStore'

export function PlacementModeOverlay() {
  const placementMode    = useFieldStore((s) => s.placementMode)
  const setPlacementMode = useFieldStore((s) => s.setPlacementMode)

  // ── Escape key cancels placement mode while armed ─────────────────────────
  useEffect(() => {
    if (!placementMode) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setPlacementMode(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [placementMode, setPlacementMode])

  // ── Render only while armed ───────────────────────────────────────────────
  if (!placementMode) return null

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        // Sticky banner below the TopBar (56px height per UI-SPEC)
        position: 'sticky',
        top: '56px',
        zIndex: 20,
        backgroundColor: 'var(--color-surface-elevated)',
        borderBottom: '1px solid var(--color-border)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      {/* Placement instruction copy — UI-SPEC Copywriting Contract */}
      <span
        style={{
          fontSize: '16px',
          fontWeight: 400,
          lineHeight: 1.5,
          color: 'var(--color-text-secondary)',
        }}
      >
        Click anywhere on the document to place your signature.
      </span>

      {/* "Stop placing" link — disarms placement mode */}
      <button
        onClick={() => setPlacementMode(false)}
        style={{
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: 1.4,
          color: 'var(--color-text-secondary)',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '4px 8px',
          borderRadius: '4px',
          flexShrink: 0,
          outline: 'none',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--color-text-primary)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-secondary)'
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
          e.currentTarget.style.outlineOffset = '0'
        }}
      >
        Stop placing
      </button>
    </div>
  )
}
