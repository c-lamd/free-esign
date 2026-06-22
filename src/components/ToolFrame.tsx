import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Wordmark } from './Wordmark'

/**
 * ToolFrame — the shared instrument-panel tool-page frame (SUITE-05).
 *
 * Every tool route (Sign now; Merge/Split/Organize/Convert in P11/P12) mounts
 * inside this frame so the suite has one consistent chrome:
 *   - a slim sticky back-to-hub bar carrying the <Wordmark /> as a react-router
 *     <Link to="/"> (aria-label "free·esign — back to tools"), distinct from the
 *     signing-only "return to home" reset semantics inside the tool;
 *   - an optional `actions` slot on the right for tool-specific controls;
 *   - a <main> region for the tool's own UI (`children`).
 *
 * Reuses TopBar's 56px chrome dimensions + tokens (--color-surface-elevated,
 * --color-line-strong) so the frame reads as part of the same instrument panel.
 *
 * Presentational only — no store coupling, no router state beyond the back link.
 */
export function ToolFrame({
  children,
  actions,
  chrome = true,
}: {
  children: ReactNode
  actions?: ReactNode
  /**
   * Render the shared back-to-hub header bar (default). Tools that supply their
   * own full header — e.g. the signing tool's <TopBar> — pass `chrome={false}`
   * to avoid stacking two bars (which fight for `top:0` and hide each other on
   * scroll). The wrapper + <main> are always rendered.
   */
  chrome?: boolean
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      {chrome && (
        <div
          style={{
            // minHeight + flexWrap so a tool's `actions` wrap on mobile instead of
            // overflowing the screen horizontally (mirrors TopBar). Desktop stays
            // a single row.
            minHeight: '56px',
            backgroundColor: 'var(--color-surface-elevated)',
            borderBottom: '1px solid var(--color-line-strong)',
            padding: '6px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            flexWrap: 'wrap',
            position: 'sticky',
            top: 0,
            zIndex: 11,
          }}
        >
          <Link
            to="/"
            aria-label="free·esign — back to tools"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              textDecoration: 'none',
              outline: 'none',
            }}
          >
            <Wordmark />
          </Link>

          {actions != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', rowGap: '6px' }}>
              {actions}
            </div>
          )}
        </div>
      )}

      <main>{children}</main>
    </div>
  )
}
