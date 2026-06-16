import { RefObject } from 'react'
import { useDocumentStore } from '../store/documentStore'

interface PageNavigationProps {
  /** Ref to the scrollable container that holds the page list */
  scrollContainerRef: RefObject<HTMLDivElement | null>
}

/**
 * Fixed bottom-center navigation pill: [prev] [1 / N] [next]
 *
 * Accessibility requirements (UI-SPEC):
 * - Prev/next use aria-disabled="true" (NOT the disabled attribute) at boundaries
 *   so focus remains reachable for keyboard users.
 * - Each button carries BOTH aria-label AND an inner <span class="sr-only"> label.
 * - The indicator is aria-live="polite" so screen readers announce page changes.
 * - Focus ring: 2px outline, --color-accent.
 * - 44px minimum touch target on prev/next.
 */
export function PageNavigation({ scrollContainerRef }: PageNavigationProps) {
  const currentPage = useDocumentStore((s) => s.currentPage)
  const numPages = useDocumentStore((s) => s.numPages)
  const setCurrentPage = useDocumentStore((s) => s.setCurrentPage)

  if (!numPages || numPages < 1) return null

  const isFirst = currentPage <= 1
  const isLast = currentPage >= numPages

  /**
   * Scroll the target page into view by finding the [data-page-number] element
   * inside the scroll container, then calling scrollIntoView.
   */
  const scrollToPage = (targetPage: number) => {
    const clamped = Math.max(1, Math.min(numPages, targetPage))
    setCurrentPage(clamped)

    const container = scrollContainerRef.current
    if (!container) return

    const pageEl = container.querySelector<HTMLElement>(
      `[data-page-number="${clamped}"]`,
    )
    if (pageEl) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const handlePrev = () => {
    if (!isFirst) scrollToPage(currentPage - 1)
  }

  const handleNext = () => {
    if (!isLast) scrollToPage(currentPage + 1)
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: 'var(--color-surface-elevated)',
        borderRadius: '20px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        zIndex: 50,
      }}
    >
      {/* Prev button */}
      <button
        aria-label="Previous page"
        aria-disabled={isFirst ? 'true' : undefined}
        onClick={handlePrev}
        style={{
          // 44px minimum touch target (WCAG 2.5.5)
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: isFirst ? 'default' : 'pointer',
          opacity: isFirst ? 0.35 : 1,
          color: 'var(--color-text-primary)',
          borderRadius: '6px',
          padding: '0 8px',
          outline: 'none',
          transition: 'color 0.15s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        onMouseEnter={(e) => {
          if (!isFirst) e.currentTarget.style.color = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-primary)'
        }}
      >
        {/* Visually hidden label — sr-only defined in index.css (Plan 01-01) */}
        <span className="sr-only">Previous page</span>
        {/* 16px left chevron SVG */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M10 12L6 8L10 4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {/* Page indicator: "1 / N" — aria-live so screen readers announce changes */}
      <span
        aria-live="polite"
        aria-atomic="true"
        style={{
          fontSize: '14px',
          fontWeight: 400,
          lineHeight: 1.4,
          color: 'var(--color-text-secondary)',
          minWidth: '60px',
          textAlign: 'center',
          userSelect: 'none',
        }}
      >
        {currentPage} / {numPages}
      </span>

      {/* Next button */}
      <button
        aria-label="Next page"
        aria-disabled={isLast ? 'true' : undefined}
        onClick={handleNext}
        style={{
          minWidth: '44px',
          minHeight: '44px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'none',
          border: 'none',
          cursor: isLast ? 'default' : 'pointer',
          opacity: isLast ? 0.35 : 1,
          color: 'var(--color-text-primary)',
          borderRadius: '6px',
          padding: '0 8px',
          outline: 'none',
          transition: 'color 0.15s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.outline = '2px solid var(--color-accent)'
          e.currentTarget.style.outlineOffset = '2px'
        }}
        onBlur={(e) => {
          e.currentTarget.style.outline = 'none'
        }}
        onMouseEnter={(e) => {
          if (!isLast) e.currentTarget.style.color = 'var(--color-accent)'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--color-text-primary)'
        }}
      >
        <span className="sr-only">Next page</span>
        {/* 16px right chevron SVG */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 16 16"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <path
            d="M6 4L10 8L6 12"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  )
}
