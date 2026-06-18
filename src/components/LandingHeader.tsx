import { useDocumentStore } from '../store/documentStore'
import { Wordmark } from './Wordmark'

export function LandingHeader() {
  const startSigning = useDocumentStore((s) => s.startSigning)

  return (
    <header
      style={{
        height: '56px',
        backgroundColor: 'var(--color-surface-elevated)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '0 16px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>
          <Wordmark />
        </span>

        <button
          type="button"
          onClick={startSigning}
          aria-label="Sign a document — opens the document uploader"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--color-accent)',
            padding: '12px 0',
            minHeight: '44px',
            fontFamily: 'inherit',
            outline: 'none',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLButtonElement).style.textDecoration = 'underline'
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
        >
          Sign a document
        </button>
      </div>
    </header>
  )
}
