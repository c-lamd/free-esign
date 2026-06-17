import { useDocumentStore } from '../store/documentStore'

const facts = [
  'No uploads — your file never leaves your device',
  'No accounts — open the app and start signing',
  'No tracking — no analytics, no beacons, no third-party scripts',
]

export function PrivacySection() {
  const startSigning = useDocumentStore((s) => s.startSigning)

  return (
    <section
      aria-labelledby="privacy-heading"
      style={{
        backgroundColor: 'var(--color-surface)',
        padding: 'clamp(32px, 6vw, 48px) 16px',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-surface-elevated)',
            border: '1px solid var(--color-border)',
            borderRadius: '8px',
            padding: '32px',
            textAlign: 'center',
          }}
        >
          {/* Lock icon — decorative, aria-hidden */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 32 32"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
            style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}
          >
            <rect
              x="6"
              y="14"
              width="20"
              height="14"
              rx="2"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M10 14V10a6 6 0 0 1 12 0v4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <circle cx="16" cy="21" r="2" fill="currentColor" />
          </svg>

          <h2
            id="privacy-heading"
            style={{
              fontSize: '20px',
              fontWeight: 600,
              lineHeight: 1.2,
              color: 'var(--color-text-primary)',
              marginBottom: '16px',
              margin: '0 0 16px',
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
            }}
          >
            Your document never leaves your browser
          </h2>

          <p
            style={{
              fontSize: '16px',
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
              maxWidth: '560px',
              margin: '0 auto',
            }}
          >
            All processing happens right here, in your browser. There is no server receiving
            your files, no account to create, and no way for us to see what you&apos;re signing.
          </p>

          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              marginTop: '16px',
              textAlign: 'left',
              maxWidth: '400px',
              margin: '16px auto 0',
            }}
          >
            {facts.map((fact) => (
              <p
                key={fact}
                style={{
                  fontSize: '14px',
                  fontWeight: 400,
                  color: 'var(--color-text-secondary)',
                  paddingLeft: '20px',
                  position: 'relative',
                  margin: 0,
                }}
              >
                <span
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    left: 0,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  &#x2713;
                </span>
                {fact}
              </p>
            ))}
          </div>

          <button
            type="button"
            onClick={startSigning}
            aria-label="Start signing — opens the document uploader"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--color-accent)',
              color: '#FFFFFF',
              fontSize: '16px',
              fontWeight: 600,
              padding: '12px 32px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              minHeight: '48px',
              minWidth: '200px',
              marginTop: '32px',
              fontFamily: 'inherit',
              outline: 'none',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1D4ED8'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                'var(--color-accent)'
            }}
            onMouseDown={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1E40AF'
            }}
            onMouseUp={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.backgroundColor = '#1D4ED8'
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-accent)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
              e.currentTarget.style.backgroundColor = 'var(--color-accent)'
            }}
          >
            Start signing
          </button>
        </div>
      </div>
    </section>
  )
}
