/**
 * ExportErrorBanner — inline, dismissible export-failure banner.
 *
 * Rendered below the TopBar when an export error is set in documentStore.
 * Self-gates: renders nothing when exportError is null.
 *
 * UI-SPEC / Copywriting Contract:
 *   - role="alert" aria-live="assertive" — screen readers announce immediately
 *   - Destructive left-border styling (same pattern as ErrorBanner, at banner scale)
 *   - Copy: exactly "Could not export the signed PDF. Try downloading again."
 *   - Dismiss control: "×" button clears the error (setExportError(null))
 *
 * Threat model:
 *   T-02-02: export failures are contained and surfaced here, never unhandled rejections.
 */

import { useDocumentStore } from '../store/documentStore'

export function ExportErrorBanner() {
  const exportError = useDocumentStore((s) => s.exportError)
  const setExportError = useDocumentStore((s) => s.setExportError)

  // Self-gate: nothing to show when no error is set
  if (!exportError) return null

  function handleDismiss() {
    setExportError(null)
  }

  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        backgroundColor: 'var(--color-surface-elevated)',
        borderLeft: '4px solid var(--color-destructive)',
        borderBottom: '1px solid var(--color-border)',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        position: 'sticky',
        top: '56px',
        zIndex: 15,
      }}
    >
      {/* Warning icon */}
      <svg
        width="16"
        height="16"
        viewBox="0 0 16 16"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ color: 'var(--color-destructive)', flexShrink: 0 }}
      >
        <path
          d="M8 1.5L14.5 13H1.5L8 1.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M8 6V9"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        <circle cx="8" cy="11" r="0.75" fill="currentColor" />
      </svg>

      {/* Error message — exact copy from UI-SPEC Copywriting Contract */}
      <p
        style={{
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: 1.4,
          color: 'var(--color-text-primary)',
          margin: 0,
          flex: 1,
        }}
      >
        {exportError}
      </p>

      {/* Dismiss control */}
      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss export error"
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: '16px',
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          padding: '4px 8px',
          minHeight: '32px',
          minWidth: '32px',
          borderRadius: '4px',
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        ×
        <span
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            overflow: 'hidden',
            clip: 'rect(0,0,0,0)',
            whiteSpace: 'nowrap',
          }}
        >
          Dismiss
        </span>
      </button>
    </div>
  )
}
