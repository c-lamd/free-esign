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
}: {
  children: ReactNode
  actions?: ReactNode
}) {
  return (
    <div
      style={{
        minHeight: '100dvh',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <div
        style={{
          height: '56px',
          backgroundColor: 'var(--color-surface-elevated)',
          borderBottom: '1px solid var(--color-line-strong)',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {actions}
          </div>
        )}
      </div>

      <main>{children}</main>
    </div>
  )
}
