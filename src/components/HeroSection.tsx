import { useDocumentStore } from '../store/documentStore'
import { Wordmark } from './Wordmark'

export function HeroSection() {
  const startSigning = useDocumentStore((s) => s.startSigning)

  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        backgroundColor: 'var(--color-surface)',
        padding: 'clamp(48px, 8vw, 64px) 16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
        }}
      >
        {/* Decorative brand display — aria-hidden, not in accessible tree */}
        <span
          aria-hidden="true"
          style={{
            display: 'block',
            marginBottom: '8px',
            userSelect: 'none',
          }}
        >
          <Wordmark />
        </span>

        <h1
          id="hero-heading"
          style={{
            fontSize: '36px',
            fontWeight: 600,
            lineHeight: 1.15,
            color: 'var(--color-text-primary)',
            marginBottom: '24px',
            margin: '0 0 24px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          I built this because I couldn&apos;t find a PDF signer that was actually free.
        </h1>

        <p
          style={{
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
            maxWidth: '600px',
            margin: '0 auto 24px',
          }}
        >
          Every one I tried had a catch: sign up for an account, pay to download your own
          document, or quietly upload your files to a server I&apos;ve never heard of.
        </p>

        <p
          style={{
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.5,
            maxWidth: '600px',
            margin: '0 auto 32px',
          }}
        >
          FreeESign does one thing: you drop a PDF, place your signature, and download it
          back — untouched. No server ever sees your document. No account. No paywall. Just
          sign your thing and move on.
        </p>

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
          Start signing — it&apos;s free
        </button>

        <p
          style={{
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            marginTop: '16px',
          }}
        >
          No account needed. No uploads. Works in your browser.
        </p>
      </div>
    </section>
  )
}
