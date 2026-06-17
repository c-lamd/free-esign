/**
 * PlacementModeOverlay.tsx
 *
 * Sticky banner shown while any field type is armed (armedFieldType !== null).
 * Shows type-specific placement instruction copy.
 * Provides a "Stop placing" link that disarms placement.
 * Listens for Escape key to disarm while armed.
 *
 * Phase 3 migration: placementMode/setPlacementMode replaced by armedFieldType/setArmedFieldType.
 *
 * @see 03-UI-SPEC.md PlacementModeOverlay
 * @see 03-UI-SPEC.md Copywriting Contract (per-type banner copy)
 * @see src/store/fieldStore.ts (armedFieldType, setArmedFieldType)
 */

import { useEffect } from 'react'
import { useFieldStore } from '../store/fieldStore'
import type { FieldType } from '../store/fieldStore'

// Per-type placement banner copy (Copywriting Contract)
const BANNER_COPY: Record<FieldType, string> = {
  signature: 'Click anywhere on the document to place your signature.',
  initials:  'Click anywhere on the document to place your initials.',
  date:      'Click anywhere on the document to place a date field.',
  text:      'Click anywhere on the document to place a text field.',
  checkbox:  'Click anywhere on the document to place a checkbox mark.',
}

export function PlacementModeOverlay() {
  const armedFieldType    = useFieldStore((s) => s.armedFieldType)
  const setArmedFieldType = useFieldStore((s) => s.setArmedFieldType)

  // ── Escape key disarms while armed ───────────────────────────────────────
  useEffect(() => {
    if (!armedFieldType) return

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setArmedFieldType(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [armedFieldType, setArmedFieldType])

  // ── Render only while armed ───────────────────────────────────────────────
  if (!armedFieldType) return null

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
      {/* Per-type placement instruction copy */}
      <span
        style={{
          fontSize: '16px',
          fontWeight: 400,
          lineHeight: 1.5,
          color: 'var(--color-text-secondary)',
        }}
      >
        {BANNER_COPY[armedFieldType]}
      </span>

      {/* "Stop placing" link — disarms placement */}
      <button
        onClick={() => setArmedFieldType(null)}
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
