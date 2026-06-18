// pdfWorker side-effect is anchored in main.tsx (WR-02); the named import here
// gives access to pdfOptions. The bare side-effect import on the previous line
// has been removed — it was dead code after main.tsx started importing the module.
import { pdfOptions } from '../lib/pdfWorker'

import { Document } from 'react-pdf'
// AnnotationLayer.css intentionally NOT imported — renderAnnotationLayer={false} on every Page.
// Re-add alongside a security review of the annotation attack surface when annotations are enabled.
// TextLayer.css intentionally NOT imported — renderTextLayer={false} in Phase 1

import { useCallback, useEffect, useRef, useState } from 'react'
import { useDocumentStore } from '../store/documentStore'
import { useFieldStore } from '../store/fieldStore'
import { LazyPage } from './LazyPage'
import { PageNavigation } from './PageNavigation'
import { ZoomControl } from './ZoomControl'
import { LoadingSpinner } from './LoadingSpinner'
import { PlacementModeOverlay } from './PlacementModeOverlay'

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
  const currentPage = useDocumentStore((s) => s.currentPage)
  const zoom = useDocumentStore((s) => s.zoom)
  const setNumPages = useDocumentStore((s) => s.setNumPages)
  const setCurrentPage = useDocumentStore((s) => s.setCurrentPage)
  const setError = useDocumentStore((s) => s.setError)

  // Field store subscriptions for keyboard delete (FLD-07) and undo/redo (FLD-09)
  const selectedFieldId = useFieldStore((s) => s.selectedFieldId)
  const deleteField     = useFieldStore((s) => s.deleteField)
  const undo            = useFieldStore((s) => s.undo)
  const redo            = useFieldStore((s) => s.redo)

  // Revoke the previous Blob URL after DocumentViewer unmounts or docUrl changes,
  // ensuring revocation happens after react-pdf has released its internal reference.
  // This replaces the eager URL.revokeObjectURL() calls in TopBar and ErrorBanner (WR-01).
  useEffect(() => {
    const url = docUrl
    return () => {
      if (url) URL.revokeObjectURL(url)
    }
  }, [docUrl])

  // Single keydown handler — hosts both Delete/Backspace field deletion (FLD-07)
  // and Cmd/Ctrl+Z / Shift+Z / Ctrl+Y undo/redo shortcuts (FLD-09).
  //
  // Security (T-02-07 / T-03-11): the INPUT/TEXTAREA/contentEditable guard fires FIRST.
  // All undo/redo branches are placed AFTER this guard so they are never triggered
  // while a text/date field input is focused.
  //
  // Pitfall: the Delete/Backspace branch returns early when !selectedFieldId, but
  // undo/redo must NOT be blocked by that check — they are positioned before the
  // Delete/Backspace selection gate so they always run when the guard passes.
  //
  // RESEARCH Section 4: extend this handler rather than adding a second
  // addEventListener, to avoid double-binding and event ordering issues.
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // T-02-07 / T-03-11 guard: do not intercept keystrokes in text input contexts.
      // This guard is SHARED by both undo/redo and Delete/Backspace branches.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA') return
        if (target.isContentEditable) return
      }

      // FLD-09: Undo/Redo keyboard shortcuts.
      // Placed BEFORE the selectedFieldId check so they work regardless of selection.
      const isMod = e.metaKey || e.ctrlKey
      if (isMod && e.shiftKey && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        redo()
        return
      }
      if (isMod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault()
        undo()
        return
      }
      if (e.ctrlKey && (e.key === 'y' || e.key === 'Y')) {
        e.preventDefault()
        redo()
        return
      }

      // FLD-07: Delete/Backspace removes the selected field.
      // Only fires when a field is selected — checked AFTER undo/redo branches.
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      if (!selectedFieldId) return

      // Prevent Backspace from triggering browser back-navigation
      e.preventDefault()
      deleteField(selectedFieldId)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedFieldId, deleteField, undo, redo])

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

  // Page-anchor on zoom: after zoom changes, scroll the current page back into view.
  // This prevents the viewport drifting away from the previously visible page.
  // Minimal implementation: requestAnimationFrame to let React re-render the resized
  // page before scrolling, then scrollIntoView on the current page element.
  // Guard with typeof to avoid jsdom test failures (scrollIntoView not in jsdom).
  useEffect(() => {
    if (!scrollContainerRef.current || !currentPage) return
    const container = scrollContainerRef.current
    requestAnimationFrame(() => {
      const pageEl = container.querySelector<HTMLElement>(
        `[data-page-number="${currentPage}"]`,
      )
      if (pageEl && typeof pageEl.scrollIntoView === 'function') {
        pageEl.scrollIntoView({ block: 'nearest' })
      }
    })
  }, [zoom, currentPage])

  if (!docUrl) return null

  const pageNumbers = numPages
    ? Array.from({ length: numPages }, (_, i) => i + 1)
    : []

  return (
    <>
      {/* PlacementModeOverlay: sticky banner below TopBar (z-index:20, top:56px).
          Rendered outside the scrollable canvas div so it sticks to the viewport,
          not to the scroll container. Announces armed state to screen readers
          (role="status" aria-live="polite" on the overlay itself). */}
      <PlacementModeOverlay />

      <div
        ref={scrollContainerRef}
        style={{
          // EDT-04: warm bone worktable background (same visual value as --color-canvas).
          // backgroundImage adds the dotted grid — background-image has NO layout effect.
          // Do NOT add padding/border here (PAR-03: scroll container box model untouched).
          backgroundColor: 'var(--color-bg)',
          backgroundImage: 'radial-gradient(var(--color-line-strong) 1px, transparent 1px)',
          backgroundSize: '16px 16px',
          backgroundPosition: '-1px -1px',
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

        {/* ZoomControl pill: fixed bottom, to the left of PageNavigation */}
        <ZoomControl />
      </div>
    </>
  )
}
