import { BUY_ME_A_COFFEE_URL } from '../config'
import { Wordmark } from './Wordmark'

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
        <p style={{ margin: '0 0 8px' }}>
          <Wordmark />
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

        {/* Open-source link — inline GitHub mark (no third-party request, PRV-03) */}
        <a
          href="https://github.com/c-lamd/free-esign"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="View the FreeESign source code on GitHub (opens in new tab)"
          style={{
            color: 'var(--color-text-secondary)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: 400,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            minHeight: '44px',
            lineHeight: '44px',
            marginLeft: '20px',
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
          <svg
            viewBox="0 0 16 16"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.27-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.46-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
          </svg>
          Source on GitHub
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
