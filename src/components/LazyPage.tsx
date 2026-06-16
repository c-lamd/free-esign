import { useEffect, useRef, useState } from 'react'
import { Page } from 'react-pdf'

interface LazyPageProps {
  pageNumber: number
  containerWidth: number | undefined
}

/**
 * Wraps react-pdf <Page> with IntersectionObserver lazy rendering.
 * While off-screen: renders a placeholder div preserving estimated scroll height.
 * Once intersecting (with 200px rootMargin preload): renders the real PDF page.
 *
 * Security: renderAnnotationLayer={false} eliminates annotation-based injection surface (T-01-03).
 * Performance: renderTextLayer={false} — Phase 1 is display-only; re-enable in Phase 2+ if needed.
 */
export function LazyPage({ pageNumber, containerWidth }: LazyPageProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true)
          // Once visible, stop observing — page stays rendered (no unload on scroll away)
          observer.disconnect()
        }
      },
      {
        // Preload 200px before the page enters the viewport for smooth scrolling
        rootMargin: '200px',
      },
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // Estimate A4/Letter page aspect ratio (1.414) for placeholder height
  const estimatedHeight = containerWidth ? containerWidth * 1.414 : 800

  return (
    <div
      ref={ref}
      data-page-number={pageNumber}
      style={{
        minHeight: isVisible ? undefined : estimatedHeight,
        backgroundColor: 'var(--color-surface-elevated)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: containerWidth ?? '100%',
      }}
    >
      {isVisible && (
        <Page
          pageNumber={pageNumber}
          width={containerWidth}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      )}
    </div>
  )
}
