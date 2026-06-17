import { useEffect, useRef, useState, useCallback } from 'react'
import { Page } from 'react-pdf'
import { useFieldStore } from '../store/fieldStore'
import type { PlacedField } from '../store/fieldStore'
import { makeSimpleViewport } from '../lib/pageViewport'
import { cssPixelToPageSpace } from '../lib/coordinateMapper'
import { PlacedFieldWidget } from './PlacedFieldWidget'

interface LazyPageProps {
  pageNumber: number
  containerWidth: number | undefined
}

/**
 * Wraps react-pdf <Page> with IntersectionObserver lazy rendering.
 * While off-screen: renders a placeholder div preserving estimated scroll height.
 * Once intersecting (with 200px rootMargin preload): renders the real PDF page.
 *
 * Phase 2 additions:
 * - onLoadSuccess: reads page.originalWidth/originalHeight (react-pdf extensions),
 *   computes render scale, and stores PageDimensions in Zustand via setPageDimensions.
 * - Per-page overlay div (position:absolute, inset:0, pointer-events:none) that hosts
 *   PlacedFieldWidgets for fields belonging to this page.
 * - When placementMode is armed: overlay receives pointer-events:auto and cursor:crosshair;
 *   clicking drops a new field centered on the click, auto-selects it, and disarms placement.
 *
 * Security: renderAnnotationLayer={false} eliminates annotation-based injection surface (T-01-03).
 * Security: overlay is pointer-events:none except during placement and on individual widgets (T-02-08).
 * Security: react-rnd bounds="parent" prevents field drag off-page (T-02-09).
 * Performance: renderTextLayer={false} — Phase 1 is display-only; re-enable in Phase 2+ if needed.
 */
export function LazyPage({ pageNumber, containerWidth }: LazyPageProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Field store state
  const placementMode    = useFieldStore((s) => s.placementMode)
  const signatureDataUrl = useFieldStore((s) => s.signatureDataUrl)
  const fields           = useFieldStore((s) => s.fields)
  const selectedFieldId  = useFieldStore((s) => s.selectedFieldId)
  const pageDimensions   = useFieldStore((s) => s.pageDimensions)
  const addField         = useFieldStore((s) => s.addField)
  const setSelectedFieldId = useFieldStore((s) => s.setSelectedFieldId)
  const setPlacementMode   = useFieldStore((s) => s.setPlacementMode)
  const setPageDimensions  = useFieldStore((s) => s.setPageDimensions)

  // Fields that belong to this page
  const pageFields = fields.filter((f) => f.pageNumber === pageNumber)

  // Current page dimensions from the store (populated by onLoadSuccess)
  const dims = pageDimensions.get(pageNumber)

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

  // ── onLoadSuccess: read react-pdf extended props and store page dimensions ──
  const handlePageLoadSuccess = useCallback(
    (page: unknown) => {
      // react-pdf enriches the PDFPageProxy with originalWidth and originalHeight.
      // TypeScript types don't include these (RESEARCH Open Q3 / A3) — cast to access them.
      const enrichedPage = page as unknown as { originalWidth: number; originalHeight: number }
      const { originalWidth, originalHeight } = enrichedPage
      const scale = containerWidth && originalWidth ? containerWidth / originalWidth : 1
      setPageDimensions(pageNumber, { originalWidth, originalHeight, scale })
    },
    [containerWidth, pageNumber, setPageDimensions],
  )

  // ── Placement click handler ─────────────────────────────────────────────────
  const handleOverlayClick = useCallback(
    async (e: React.MouseEvent<HTMLDivElement>) => {
      if (!placementMode || !signatureDataUrl || !dims) return

      // Compute CSS click position relative to the page overlay div
      const rect = e.currentTarget.getBoundingClientRect()
      const cssX = e.clientX - rect.left
      const cssY = e.clientY - rect.top

      const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, dims.scale)

      // Determine field dimensions: 180px wide, height from PNG aspect ratio
      const defaultWidthPx = 180

      // Derive aspect ratio from the PNG data URL via a temporary Image
      // (The PNG natural dimensions determine the aspect ratio to preserve, per UI-SPEC)
      let aspectRatio = 3 // fallback to 3:1 if Image load fails
      try {
        aspectRatio = await new Promise<number>((resolve) => {
          const img = new Image()
          img.onload = () => {
            resolve(img.naturalWidth / img.naturalHeight || 3)
          }
          img.onerror = () => resolve(3)
          img.src = signatureDataUrl
        })
      } catch {
        aspectRatio = 3
      }

      const defaultHeightPx = defaultWidthPx / aspectRatio

      // Center the field on the click point (compute top-left CSS corner)
      const fieldTopLeftCss = {
        x: cssX - defaultWidthPx / 2,
        y: cssY - defaultHeightPx / 2,
      }

      // Convert top-left CSS corner → PDF space (bottom-left in PDF terms).
      // Coordinate Mapper handles the Y-axis flip — no additional flip needed (Pitfall 2).
      const pdfBottomLeft = cssPixelToPageSpace(fieldTopLeftCss, viewport)

      const newField: PlacedField = {
        id: crypto.randomUUID(),
        type: 'signature',
        pageNumber,
        pdfX:      pdfBottomLeft.x,
        pdfY:      pdfBottomLeft.y,
        pdfWidth:  defaultWidthPx  / dims.scale,
        pdfHeight: defaultHeightPx / dims.scale,
        dataUrl:   signatureDataUrl,
      }

      addField(newField)
      setSelectedFieldId(newField.id)
      setPlacementMode(false)
    },
    [
      placementMode,
      signatureDataUrl,
      dims,
      pageNumber,
      addField,
      setSelectedFieldId,
      setPlacementMode,
    ],
  )

  // ── Click-away deselection on overlay (when NOT in placement mode) ──────────
  const handleOverlayClickAway = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (placementMode) return // placement mode has its own handler
      // If the click target is the overlay div itself (not a child widget), deselect
      if (e.target === e.currentTarget) {
        setSelectedFieldId(null)
      }
    },
    [placementMode, setSelectedFieldId],
  )

  // Estimate A4/Letter page aspect ratio (1.414) for placeholder height
  const estimatedHeight = containerWidth ? containerWidth * 1.414 : 800

  return (
    <div
      ref={ref}
      data-page-number={pageNumber}
      style={{
        // position:relative is required for bounds="parent" in react-rnd (Pitfall 4)
        position: 'relative',
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
          onLoadSuccess={handlePageLoadSuccess}
        />
      )}

      {/* Per-page overlay div — hosts PlacedFieldWidgets for this page.
          pointer-events:none by default (T-02-08) so it never blocks the PDF canvas.
          During placement mode: pointer-events:auto + crosshair cursor to capture clicks.
          Individual widgets re-enable pointer-events:auto themselves. */}
      {isVisible && (
        <div
          onClick={placementMode ? handleOverlayClick : handleOverlayClickAway}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: placementMode ? 'auto' : 'none',
            cursor: placementMode ? 'crosshair' : 'default',
            // Overlay must NOT intercept non-placement clicks when no placement mode
            // — individual widgets set pointer-events:auto themselves
          }}
        >
          {/* Render a PlacedFieldWidget for each field on this page */}
          {pageFields.map((field) => {
            if (!dims) return null
            const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, dims.scale)
            return (
              <PlacedFieldWidget
                key={field.id}
                field={field}
                viewport={viewport}
                isSelected={selectedFieldId === field.id}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
