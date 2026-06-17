import { BUY_ME_A_COFFEE_URL } from '../config'

export function LandingFooter() {
  return (
    <footer
      role="contentinfo"
      style={{
        backgroundColor: 'var(--color-surface-elevated)',
        borderTop: '1px solid var(--color-border)',
        padding: '32px 16px',
        textAlign: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
        }}
      >
        <p
          style={{
            fontSize: '24px',
            fontWeight: 600,
            lineHeight: 1.1,
            color: 'var(--color-text-primary)',
            marginBottom: '8px',
            margin: '0 0 8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          FreeESign
        </p>

        <p
          style={{
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            marginBottom: '24px',
            margin: '0 0 24px',
          }}
        >
          Sign your documents privately, in your browser.
        </p>

        {/* TODO: replace BUY_ME_A_COFFEE_URL placeholder before deploy */}
        <a
          href={BUY_ME_A_COFFEE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Support FreeESign — Buy Me a Coffee (opens in new tab)"
          style={{
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 400,
            display: 'inline-block',
            minHeight: '44px',
            lineHeight: '44px',
            outline: 'none',
          }}
          onMouseEnter={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.color =
              'var(--color-text-primary)'
            ;(e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'
          }}
          onMouseLeave={(e) => {
            ;(e.currentTarget as HTMLAnchorElement).style.color =
              'var(--color-text-secondary)'
            ;(e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'
          }}
          onFocus={(e) => {
            e.currentTarget.style.outline = '2px solid var(--color-accent)'
            e.currentTarget.style.outlineOffset = '2px'
            e.currentTarget.style.borderRadius = '2px'
          }}
          onBlur={(e) => {
            e.currentTarget.style.outline = 'none'
          }}
        >
          Buy me a coffee ☕
        </a>

        <p
          style={{
            fontSize: '14px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            marginTop: '16px',
            margin: '16px 0 0',
          }}
        >
          FreeESign is free for everyone. No data leaves your browser.
        </p>
      </div>
    </footer>
  )
}
