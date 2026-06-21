/**
 * ToolsListing.tsx — SUITE-03 tools-listing view at `/tools`.
 *
 * Enumerates every TOOL_REGISTRY entry as a row with the tool name + its
 * one-line blurb — generated from the single registry (N entries → N rows, the
 * same source of truth that drives the hub grid and the route table). Live rows
 * link to their route (Sign → /sign); coming-soon rows are marked but inert.
 *
 * Wrapped in the shared <ToolFrame> (10-01) so it shares the back-to-hub header
 * chrome for suite continuity (SUITE-05). Mono chrome tokens for labels.
 */
import { Link } from 'react-router-dom'
import { ToolFrame } from './ToolFrame'
import { TOOL_REGISTRY } from '../tools/registry'

const headingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '13px',
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--color-ink-muted)',
  margin: '0 0 20px',
}

const rowStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  padding: '16px 0',
  borderBottom: '1px solid var(--color-line)',
}

const nameStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '15px',
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--color-ink)',
  textDecoration: 'none',
}

const blurbStyle: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontSize: '13px',
  lineHeight: 1.45,
  color: 'var(--color-ink-muted)',
  margin: 0,
}

const badgeStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: '10px',
  fontWeight: 600,
  letterSpacing: '0.16em',
  textTransform: 'uppercase',
  color: 'var(--color-ink-faint)',
}

export function ToolsListing() {
  return (
    <ToolFrame>
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '40px 16px 64px',
        }}
      >
        <h1 style={headingStyle}>All tools</h1>

        <div>
          {TOOL_REGISTRY.map((tool) => (
            <div key={tool.id} data-tool-row={tool.id} style={rowStyle}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
              >
                {tool.status === 'live' ? (
                  <Link to={tool.route} style={nameStyle}>
                    {tool.name}
                  </Link>
                ) : (
                  <span style={{ ...nameStyle, color: 'var(--color-ink-muted)' }}>
                    {tool.name}
                  </span>
                )}

                {tool.status === 'coming-soon' && (
                  <span style={badgeStyle}>Coming Soon</span>
                )}
              </div>

              <p style={blurbStyle}>{tool.blurb}</p>
            </div>
          ))}
        </div>
      </div>
    </ToolFrame>
  )
}
