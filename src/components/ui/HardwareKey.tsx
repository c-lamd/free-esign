/**
 * HardwareKey — shared hardware-key button primitive (FND-04).
 *
 * Visual contract (from 06-UI-SPEC § 2 and visual-foundation.md § Key CSS):
 *   - Mono uppercase letter-spaced key with key-face background (#F0ECE1)
 *   - 1px line-strong border (top/left/right) + 3px key-edge bottom border (press depth)
 *   - :hover lifts translateY(-1px); :active sinks translateY(2px) + collapses bottom to 1px
 *   - .hw-key--armed → Signal Orange accent background/border/bottom-edge
 *   - disabled uses aria-disabled (not HTML disabled) — WCAG 2.5.5 focusable-disabled
 *
 * Implementation: module-level style injection (singleton guard on `let styleInjected`)
 * per 06-RESEARCH Pitfall 5 — only one <style> block across all instances.
 */

import React from 'react'

export interface HardwareKeyProps {
  children: React.ReactNode
  armed?: boolean
  onClick?: () => void
  type?: 'button' | 'submit'
  'aria-label'?: string
  disabled?: boolean
  className?: string
}

// ── Single style injection (guard against duplicate <style> tags across instances) ──

let styleInjected = false

function injectStyles() {
  if (styleInjected) return
  styleInjected = true

  // Skip in non-DOM environments (e.g. SSR or test runners without a document)
  if (typeof document === 'undefined') return

  const style = document.createElement('style')
  style.setAttribute('data-hw-key', '1')
  style.textContent = `
/* HardwareKey primitive — hardware press physics (FND-04) */
/* Ported from visual-foundation.md § Key CSS */
.hw-key {
  font-family: var(--font-mono);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
  font-size: 11px;
  line-height: 1.0;
  background: var(--color-key);
  color: var(--color-ink);
  border: 1px solid var(--color-line-strong);
  border-bottom: 3px solid var(--color-key-edge);
  border-radius: var(--radius-key);
  padding: 4px 8px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  outline: none;
  transition: transform 0.07s ease, background 0.12s, border-color 0.12s, color 0.12s;
  box-sizing: border-box;
}

.hw-key:hover {
  transform: translateY(-1px);
  border-color: var(--color-ink-muted);
}

.hw-key:active {
  transform: translateY(2px);
  border-bottom-width: 1px;
}

.hw-key.hw-key--armed {
  background: var(--color-accent);
  color: var(--color-on-accent);
  border-color: var(--color-accent);
  border-bottom-color: var(--color-accent-press);
}

.hw-key.hw-key--armed:hover {
  border-color: var(--color-accent);         /* keep accent border on armed hover */
  border-bottom-color: var(--color-accent-press);
}

.hw-key[aria-disabled="true"] {
  opacity: 0.5;
  pointer-events: none;
  /* cursor: not-allowed is omitted — pointer-events:none prevents the cursor
     from being shown, making that rule dead CSS (WR-01). */
}
`
  document.head.appendChild(style)
}

// ── Component ──────────────────────────────────────────────────────────────────

export function HardwareKey({
  children,
  armed = false,
  onClick,
  type = 'button',
  'aria-label': ariaLabel,
  disabled = false,
  className,
}: HardwareKeyProps) {
  // Inject styles once per document
  injectStyles()

  const [focused, setFocused] = React.useState(false)

  const classes = [
    'hw-key',
    armed ? 'hw-key--armed' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      aria-label={ariaLabel}
      aria-disabled={disabled ? 'true' : undefined}
      // Click guard: never fire onClick when disabled
      onClick={disabled ? undefined : onClick}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={
        focused
          ? { outline: '2px solid var(--color-accent)', outlineOffset: '2px' }
          : undefined
      }
    >
      {children}
    </button>
  )
}
