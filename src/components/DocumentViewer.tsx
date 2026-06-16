// Import pdfWorker FIRST — sets GlobalWorkerOptions.workerSrc before react-pdf initialises.
// RESEARCH Pitfall 3: module execution order; this import must stay at the top.
import '../lib/pdfWorker'
import { pdfOptions } from '../lib/pdfWorker'

import { Document } from 'react-pdf'
import 'react-pdf/dist/Page/AnnotationLayer.css'
// TextLayer.css intentionally NOT imported — renderTextLayer={false} in Phase 1

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentStore } from '../store/documentStore'
import { LazyPage } from './LazyPage'
import { PageNavigation } from './PageNavigation'
import { LoadingSpinner } from './LoadingSpinner'

/**
 * Full continuous multi-page PDF viewer.
 *
 * Layout:
 * - Gray canvas (--color-canvas) background, 24px vertical padding
 * - Each page rendered as a centered white card with shadow, 24px gap between pages
 * - Pages fit-to-width via ResizeObserver on the inner container (RESEARCH Pattern 2)
 * - Off-screen pages lazy-rendered via LazyPage (IntersectionObserver, RESEARCH Pattern 3)
 * - ResizeObserver pitfall avoided: container uses width:100% inside a max-width parent (Pitfall 5)
 * - PageNavigation pill fixed at bottom-center
 *
 * Scroll tracking:
 * - An IntersectionObserver over all LazyPage wrappers tracks the most-visible page
 *   and calls setCurrentPage so the "1 / N" indicator stays in sync with manual scrolling.
 */
export function DocumentViewer() {
  const docUrl = useDocumentStore((s) => s.docUrl)
  const numPages = useDocumentStore((s) => s.numPages)
  const setNumPages = useDocumentStore((s) => s.setNumPages)
  const setCurrentPage = useDocumentStore((s) => s.setCurrentPage)
  const setError = useDocumentStore((s) => s.setError)

  // Width of the inner constrained container — passed to each LazyPage
  const [containerWidth, setContainerWidth] = useState<number | undefined>(undefined)

  // Ref to the scrollable outer container, used by PageNavigation for scroll-to-page
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  // ResizeObserver callback ref: attaches to the inner fixed-width container (Pitfall 5 — never
  // use width:fit-content; container is 100% inside a max-width parent so width is constrained)
  const innerContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const ro = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    ro.observe(node)
    return () => ro.disconnect()
  }, [])

  // Track currentPage from scrolling using IntersectionObserver over LazyPage wrappers.
  // We observe all [data-page-number] elements and track which one has the highest ratio visible.
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !numPages) return

    const ratioMap = new Map<number, number>()

    const updateCurrentPage = () => {
      if (ratioMap.size === 0) return
      let maxRatio = -1
      let topPage = 1
      ratioMap.forEach((ratio, page) => {
        if (ratio > maxRatio) {
          maxRatio = ratio
          topPage = page
        }
      })
      setCurrentPage(topPage)
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const pageEl = entry.target as HTMLElement
          const pageNum = parseInt(pageEl.dataset.pageNumber ?? '1', 10)
          ratioMap.set(pageNum, entry.intersectionRatio)
        })
        updateCurrentPage()
      },
      {
        root: container,
        // Use multiple thresholds so we get updates as pages scroll into/out of view
        threshold: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0],
      },
    )

    // Observe all page wrappers — re-run when numPages changes (new document loaded)
    const pageEls = container.querySelectorAll('[data-page-number]')
    pageEls.forEach((el) => observer.observe(el))

    return () => observer.disconnect()
  }, [numPages, setCurrentPage])

  if (!docUrl) return null

  const pageNumbers = numPages
    ? Array.from({ length: numPages }, (_, i) => i + 1)
    : []

  return (
    <div
      ref={scrollContainerRef}
      style={{
        backgroundColor: 'var(--color-canvas)',
        minHeight: 'calc(100dvh - 56px)',
        overflowY: 'auto',
        paddingTop: '24px',
        paddingBottom: '24px',
        // Constrained width container is inside this — no fit-content here (Pitfall 5)
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Inner container: constrained max-width, 100% width — ResizeObserver attached here */}
      <div
        ref={innerContainerRef}
        style={{
          width: '100%',
          maxWidth: '900px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '24px',
        }}
      >
        <Document
          file={docUrl}
          options={pdfOptions}
          onLoadSuccess={({ numPages: n }) => setNumPages(n)}
          onLoadError={() =>
            setError(
              "This file couldn't be read. It may be corrupt or password-protected. Try another file.",
            )
          }
          loading={<LoadingSpinner />}
        >
          {pageNumbers.map((pageNumber) => (
            <LazyPage
              key={pageNumber}
              pageNumber={pageNumber}
              containerWidth={containerWidth}
            />
          ))}
        </Document>
      </div>

      {/* PageNavigation pill: fixed bottom-center, wired to scroll container */}
      {numPages !== null && numPages > 0 && (
        <PageNavigation scrollContainerRef={scrollContainerRef} />
      )}
    </div>
  )
}
