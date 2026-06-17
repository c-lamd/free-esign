/**
 * UndoRedoControls — two ghost icon buttons (Undo, Redo) for the TopBar.
 *
 * Wires to fieldStore undo/redo actions. Derives canUndo/canRedo from
 * historyIndex and history.length.
 *
 * Accessibility:
 *   - aria-disabled (NOT HTML disabled) at history bounds so focus stays reachable (WCAG 2.5.5)
 *   - Per-state aria-label: "Undo — nothing to undo" / "Redo — nothing to redo" at limits
 *   - 44px × 44px minimum touch target
 *   - 2px --color-accent focus ring (focus-visible pattern from TopBar)
 *
 * Keyboard shortcuts live in DocumentViewer's SINGLE keydown handler (not here)
 * to avoid a second addEventListener on document (RESEARCH Section 4 / Pitfall 8).
 *
 * Threat model compliance:
 *   T-03-11: Guard against firing while input focused is enforced at the DocumentViewer
 *            handler level (it fires AFTER the INPUT/TEXTAREA guard).
 */

import { useFieldStore } from '../store/fieldStore'

export function UndoRedoControls() {
  const undo         = useFieldStore((s) => s.undo)
  const redo         = useFieldStore((s) => s.redo)
  const historyIndex = useFieldStore((s) => s.historyIndex)
  const historyLen   = useFieldStore((s) => s.history.length)

  const canUndo = historyIndex > 0
  const canRedo = historyIndex < historyLen - 1

  // ── SVG icons ──────────────────────────────────────────────────────────────

  // Counterclockwise curved arrow (Undo)
  const UndoIcon = (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M3.5 6.5H9A4 4 0 1 1 9 13.5H5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3.5 6.5L5.5 4.5M3.5 6.5L5.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  // Clockwise curved arrow (Redo)
  const RedoIcon = (
    <svg
      aria-hidden="true"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <path
        d="M12.5 6.5H7A4 4 0 1 0 7 13.5H11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 6.5L10.5 4.5M12.5 6.5L10.5 8.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )

  // ── Shared button style factory ────────────────────────────────────────────

  function makeButtonStyle(enabled: boolean): React.CSSProperties {
    return {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'none',
      border: 'none',
      cursor: enabled ? 'pointer' : 'default',
      color: enabled ? 'var(--color-text-secondary)' : 'var(--color-border)',
      padding: '8px',
      minHeight: '44px',
      minWidth: '44px',
      borderRadius: '4px',
      opacity: enabled ? 1 : 0.35,
      outline: 'none',
      fontFamily: 'inherit',
    }
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0' }}>
      {/* Undo button */}
      <button
        type="button"
        onClick={canUndo ? undo : undefined}
        aria-label={canUndo ? 'Undo' : 'Undo — nothing to undo'}
        aria-disabled={canUndo ? undefined : 'true'}
        style={makeButtonStyle(canUndo)}
        onMouseEnter={(e) => {
          if (canUndo) {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-primary)'
          }
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color =
            canUndo ? 'var(--color-text-secondary)' : 'var(--color-border)'
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
      >
        {UndoIcon}
        <span
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
        >
          Undo
        </span>
      </button>

      {/* Redo button */}
      <button
        type="button"
        onClick={canRedo ? redo : undefined}
        aria-label={canRedo ? 'Redo' : 'Redo — nothing to redo'}
        aria-disabled={canRedo ? undefined : 'true'}
        style={makeButtonStyle(canRedo)}
        onMouseEnter={(e) => {
          if (canRedo) {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-primary)'
          }
        }}
        onMouseLeave={(e) => {
          ;(e.currentTarget as HTMLButtonElement).style.color =
            canRedo ? 'var(--color-text-secondary)' : 'var(--color-border)'
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
      >
        {RedoIcon}
        <span
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: 0,
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
            borderWidth: 0,
          }}
        >
          Redo
        </span>
      </button>
    </div>
  )
}
