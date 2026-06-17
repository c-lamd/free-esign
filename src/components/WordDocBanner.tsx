/**
 * WordDocBanner — friendly inline guidance shown when a .doc or .docx file
 * is selected in the UploadZone.
 *
 * Visual: informational (not destructive) — left border uses --color-border
 * (gray, NOT --color-destructive red). role="status" with aria-live="polite"
 * because this is guidance, not an urgent alert.
 *
 * Per UI-SPEC WordDocBanner section (lines 261–274) and Copywriting Contract
 * (lines 363–365). No server calls; no conversion attempted.
 */

interface WordDocBannerProps {
  /** Called when the user clicks "Choose a PDF instead" — resets UploadZone to empty state */
  onChoosePdf: () => void
}

export function WordDocBanner({ onChoosePdf }: WordDocBannerProps) {
  const bannerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    borderLeft: '4px solid var(--color-border)',
    backgroundColor: 'var(--color-surface-elevated)',
    borderRadius: '6px',
    padding: '16px',
    maxWidth: '480px',
    width: '100%',
    boxSizing: 'border-box',
  }

  const headerRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '8px',
  }

  const headingStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.2,
    color: 'var(--color-text-primary)',
    margin: 0,
  }

  const bodyStyle: React.CSSProperties = {
    fontSize: '16px',
    fontWeight: 400,
    lineHeight: 1.5,
    color: 'var(--color-text-secondary)',
    margin: 0,
  }

  const actionLinkStyle: React.CSSProperties = {
    fontSize: '14px',
    fontWeight: 400,
    color: 'var(--color-accent)',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    outline: 'none',
    alignSelf: 'flex-start',
  }

  function handleActionFocus(e: React.FocusEvent<HTMLButtonElement>) {
    e.currentTarget.style.outline = '2px solid var(--color-accent)'
    e.currentTarget.style.outlineOffset = '2px'
  }

  function handleActionBlur(e: React.FocusEvent<HTMLButtonElement>) {
    e.currentTarget.style.outline = 'none'
  }

  function handleActionMouseEnter(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.textDecoration = 'underline'
  }

  function handleActionMouseLeave(e: React.MouseEvent<HTMLButtonElement>) {
    e.currentTarget.style.textDecoration = 'none'
  }

  return (
    <div role="status" aria-live="polite" style={bannerStyle}>
      <div style={headerRowStyle}>
        {/* Information circle icon — --color-text-secondary stroke, not a warning triangle */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ flexShrink: 0, marginTop: '3px', color: 'var(--color-text-secondary)' }}
        >
          <circle
            cx="8"
            cy="8"
            r="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="8"
            y1="7"
            x2="8"
            y2="11"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="8" cy="4.5" r="0.75" fill="currentColor" />
        </svg>

        <h2 style={headingStyle}>Word documents aren&apos;t supported</h2>
      </div>

      <p style={bodyStyle}>
        To protect your document&apos;s original formatting, please export it
        to PDF first, then re-open it here. Your files will still never leave
        your browser.
      </p>

      <button
        type="button"
        onClick={onChoosePdf}
        onFocus={handleActionFocus}
        onBlur={handleActionBlur}
        onMouseEnter={handleActionMouseEnter}
        onMouseLeave={handleActionMouseLeave}
        style={actionLinkStyle}
      >
        Choose a PDF instead
      </button>
    </div>
  )
}
