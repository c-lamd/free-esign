import { useDocumentStore } from '../store/documentStore'

/**
 * ErrorBanner — inline error card for failed file ingestion.
 *
 * Displayed in the 'error' view state (replaces UploadZone content).
 * Not a modal or toast — it replaces the main content area.
 *
 * UI-SPEC:
 *   - 4px left border (--color-destructive)
 *   - White background, 6px border-radius, 16px padding
 *   - 16px red warning icon
 *   - Heading "Could not open file" (20px/600)
 *   - Body: dynamic error message from store.errorMessage
 *   - Retry action: "Try another file" → calls reset()
 *   - role="alert" so screen readers announce immediately on appearance
 *
 * See copy contract in 01-03-PLAN.md <copy_contract> and UI-SPEC Copywriting Contract.
 */
export function ErrorBanner() {
  const errorMessage = useDocumentStore((s) => s.errorMessage)
  const reset = useDocumentStore((s) => s.reset)

  function handleRetry() {
    // Blob URL revocation is handled by DocumentViewer's useEffect cleanup (WR-01).
    reset()
  }

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px)',
        backgroundColor: 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      {/* role="alert" — screen readers announce this immediately (UI-SPEC accessibility) */}
      <div
        role="alert"
        style={{
          backgroundColor: 'var(--color-surface-elevated)',
          borderLeft: '4px solid var(--color-destructive)',
          borderRadius: '6px',
          padding: '16px',
          maxWidth: '480px',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        {/* Icon + heading row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* 16px red warning icon (UI-SPEC) */}
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

          <h2
            style={{
              fontSize: '20px',
              fontWeight: 600,
              lineHeight: 1.2,
              color: 'var(--color-text-primary)',
              margin: 0,
            }}
          >
            Could not open file
          </h2>
        </div>

        {/* Dynamic error message body */}
        <p
          style={{
            fontSize: '16px',
            fontWeight: 400,
            lineHeight: 1.5,
            color: 'var(--color-text-primary)',
            margin: 0,
          }}
        >
          {errorMessage ??
            "This file couldn't be read. It may be corrupt or password-protected. Try another file."}
        </p>

        {/* Retry action — "Try another file" (copy contract) */}
        <button
          type="button"
          onClick={handleRetry}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.textDecoration =
              'underline'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.textDecoration = 'none'
          }}
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
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--color-accent)',
            padding: 0,
            textAlign: 'left',
            fontFamily: 'inherit',
            minHeight: '44px',
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          Try another file
        </button>
      </div>
    </div>
  )
}
