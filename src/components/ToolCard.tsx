/**
 * ToolCard.tsx — SUITE-02 registry-driven tool card (hardware-key idiom).
 *
 * One card per TOOL_REGISTRY entry on the tools-hub grid:
 *   - `live`        → an interactive react-router <Link> to the tool's route
 *                     (the Sign card → /sign), styled as a hardware-key face.
 *   - `coming-soon` → the same card visual but NON-interactive (no Link,
 *                     aria-disabled) with a mono "COMING SOON" badge, so the hub
 *                     looks complete but the card cannot navigate to an unbuilt
 *                     route (T-10-05).
 *
 * Visual language reuses the hardware-key tokens (--color-key face, line-strong
 * border, key-edge press-depth bottom border) and mono chrome labels so the card
 * reads as part of the same instrument panel as HardwareKey / Wordmark.
 */
import { Link } from 'react-router-dom'
import type { ToolDescriptor } from '../tools/registry'

const cardBaseStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
  textAlign: 'left',
  background: 'var(--color-key)',
  border: '1px solid var(--color-line-strong)',
  borderBottom: '3px solid var(--color-key-edge)',
  borderRadius: 'var(--radius-key)',
  padding: '18px 18px 16px',
  minHeight: '128px',
  boxSizing: 'border-box',
  textDecoration: 'none',
  color: 'var(--color-ink)',
  transition: 'transform 0.07s ease, border-color 0.12s',
}

const nameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  fontWeight: 600,
  fontSize: '15px',
  color: 'var(--color-ink)',
}

const blurbStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  lineHeight: 1.45,
  color: 'var(--color-ink-muted)',
  margin: 0,
}

const badgeStyle: React.CSSProperties = {
  alignSelf: 'flex-start',
  marginTop: 'auto',
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--color-ink-faint)',
  border: '1px solid var(--color-line)',
  borderRadius: 'var(--radius)',
  padding: '3px 7px',
}

const armBadgeStyle: React.CSSProperties = {
  ...badgeStyle,
  color: 'var(--color-accent)',
  borderColor: 'color-mix(in srgb, var(--color-accent) 55%, transparent)',
}

export function ToolCard({ tool }: { tool: ToolDescriptor }) {
  const isLive = tool.status === 'live'

  const body = (
    <>
      <span style={nameStyle}>{tool.name}</span>
      <p style={blurbStyle}>{tool.blurb}</p>
      {isLive ? (
        <span style={armBadgeStyle} aria-hidden="true">
          Open →
        </span>
      ) : (
        <span style={badgeStyle}>Coming Soon</span>
      )}
    </>
  )

  if (isLive) {
    return (
      <Link
        to={tool.route}
        data-tool-card={tool.id}
        aria-label={`${tool.name} — ${tool.blurb}`}
        style={cardBaseStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'translateY(-2px)'
          e.currentTarget.style.borderColor = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'translateY(0)'
          e.currentTarget.style.borderColor = 'var(--color-line-strong)'
        }}
      >
        {body}
      </Link>
    )
  }

  // Coming-soon: inert, marked, not in the navigation tab order.
  return (
    <div
      data-tool-card={tool.id}
      aria-disabled="true"
      style={{ ...cardBaseStyle, opacity: 0.62, cursor: 'default' }}
    >
      {body}
    </div>
  )
}
