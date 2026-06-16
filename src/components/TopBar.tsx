import { useDocumentStore } from '../store/documentStore'

export function TopBar() {
  const view = useDocumentStore((s) => s.view)
  const reset = useDocumentStore((s) => s.reset)
  const docUrl = useDocumentStore((s) => s.docUrl)

  function handleOpenAnother() {
    // Revoke the Blob URL to free memory, then reset store
    if (docUrl) {
      URL.revokeObjectURL(docUrl)
    }
    reset()
  }

  return (
    <header
      style={{
        height: '56px',
        backgroundColor: 'var(--color-surface-elevated)',
        borderBottom: '1px solid var(--color-border)',
        padding: '0 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <span
        style={{
          fontSize: '24px',
          fontWeight: 600,
          lineHeight: 1.1,
          color: 'var(--color-text-primary)',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        FreeESign
      </span>

      {view === 'loaded' && (
        <button
          onClick={handleOpenAnother}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            padding: '8px',
            minHeight: '44px',
            minWidth: '44px',
            borderRadius: '4px',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-accent)'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.color =
              'var(--color-text-secondary)'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-accent)'
            e.currentTarget.style.outlineOffset = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
          aria-label="Open another document"
        >
          Open another
        </button>
      )}
    </header>
  )
}
