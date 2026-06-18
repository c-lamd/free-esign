/**
 * Wordmark.tsx — free·esign brand wordmark component.
 *
 * Renders the 15px engraved square mark (.wm-mark) with an accent corner chip
 * (::after gradient) followed by the brand text "free·esign" in lowercase, with
 * the middot (U+00B7) colored in Signal Orange (var(--color-accent)).
 *
 * CSS source: visual-foundation.md § Key CSS (.wm-mark, .wm-mark::after, .wm-dot)
 * Spec: 06-UI-SPEC.md § Component Specs 1. Wordmark
 *
 * - Pure presentational component — no button role, no interaction.
 * - Wrapping elements provide role/interaction as needed.
 * - The .wm-mark span is aria-hidden (decorative mark).
 * - The ::after pseudo-element is delivered via a component-local <style> block
 *   (React inline styles cannot set pseudo-elements).
 * - Style injection is guarded by a module-level boolean to avoid accumulating
 *   duplicate <style> tags across multiple Wordmark instances (06-RESEARCH Pitfall 5).
 * - Typography: 2-weight system — middot is weight 600 (semibold), NOT 700;
 *   the sketch's 700 is collapsed to 600 per 06-UI-SPEC (negligible at 15px).
 * - Tokens consumed: var(--color-ink), var(--color-accent), var(--font-sans)
 *   (all added by Plan 01).
 *
 * FND-03 / Plan 06-02 Task 2.
 */

import React from 'react'

// ── Component-local CSS for .wm-mark::after (cannot be set via inline styles) ─
// Ported verbatim from visual-foundation.md § Key CSS.
// Guard prevents duplicate <style> injection across multiple instances.

let styleInjected = false

const WM_CSS = `
.wm-mark {
  width: 15px;
  height: 15px;
  border: 1.5px solid var(--color-ink);
  border-radius: 2px;
  position: relative;
  flex-shrink: 0;
}
.wm-mark::after {
  content: "";
  position: absolute;
  inset: 2px;
  background: linear-gradient(135deg, var(--color-accent) 0 45%, transparent 45%);
}
`

// ── Wordmark component ────────────────────────────────────────────────────────

interface WordmarkProps {
  className?: string
}

export function Wordmark({ className }: WordmarkProps) {
  // Inject the <style> block once per document (module-level guard).
  if (!styleInjected && typeof document !== 'undefined') {
    const el = document.createElement('style')
    el.textContent = WM_CSS
    document.head.appendChild(el)
    styleInjected = true
  }

  return (
    <span
      className={className}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {/* 15px engraved square mark with accent corner chip via ::after */}
      <span
        className="wm-mark"
        aria-hidden="true"
      />

      {/* Brand text: free·esign — all lowercase, weight 600, 15px */}
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '15px',
          fontWeight: 600,
          lineHeight: 1.0,
          textTransform: 'none',
          letterSpacing: 'normal',
          color: 'var(--color-ink)',
        }}
      >
        free
        {/* Middot: U+00B7, accent-colored, weight 600 (2-weight system — not 700) */}
        <span
          className="wm-dot"
          style={{
            color: 'var(--color-accent)',
            fontWeight: 600,
          }}
        >
          ·
        </span>
        esign
      </span>
    </span>
  )
}
