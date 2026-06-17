import { useEffect, useRef, useState, useCallback } from 'react'
import { Page } from 'react-pdf'
import { useFieldStore } from '../store/fieldStore'
import type { PlacedField, FieldType } from '../store/fieldStore'
import { useDocumentStore } from '../store/documentStore'
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
 * - When a field type is armed: overlay receives pointer-events:auto and cursor:crosshair;
 *   clicking drops a new field centered on the click, auto-selects it, and disarms.
 *
 * Phase 3 migration:
 * - placementMode/setPlacementMode replaced by armedFieldType/setArmedFieldType.
 * - handleOverlayClick dispatches all five armed types with per-type defaults.
 * - Date fields default to today (M/D/YYYY format).
 * - addField owns the pre+post history snapshot pair (one undo entry per drop).
 *
 * Plan 03-03 zoom threading:
 * - subscribes to zoom from documentStore.
 * - effectiveScale = (containerWidth / dims.originalWidth) * zoom.
 * - Page width = containerWidth * zoom (NO scale prop — RESEARCH Pitfall 5).
 * - All viewport builds and drop-geometry division use effectiveScale.
 * - dims.scale (stored by onLoadSuccess) remains the zoom-free fit-to-width baseline (RESEARCH A2).
 *
 * Security: renderAnnotationLayer={false} eliminates annotation-based injection surface (T-01-03).
 * Security: overlay is pointer-events:none except during placement and on individual widgets (T-02-08).
 * Security: react-rnd bounds="parent" prevents field drag off-page (T-02-09).
 * Performance: renderTextLayer={false} — Phase 1 is display-only; re-enable in Phase 2+ if needed.
 */
export function LazyPage({ pageNumber, containerWidth }: LazyPageProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // Document store — zoom multiplier (0.5–2.0, default 1.0)
  const zoom = useDocumentStore((s) => s.zoom)

  // Field store state
  const armedFieldType    = useFieldStore((s) => s.armedFieldType)
  const signatureDataUrl  = useFieldStore((s) => s.signatureDataUrl)
  const initialsDataUrl   = useFieldStore((s) => s.initialsDataUrl)
  const fields            = useFieldStore((s) => s.fields)
  const selectedFieldId   = useFieldStore((s) => s.selectedFieldId)
  const pageDimensions    = useFieldStore((s) => s.pageDimensions)
  const addField          = useFieldStore((s) => s.addField)
  const setSelectedFieldId  = useFieldStore((s) => s.setSelectedFieldId)
  const setArmedFieldType   = useFieldStore((s) => s.setArmedFieldType)
  const setPageDimensions   = useFieldStore((s) => s.setPageDimensions)

  // Fields that belong to this page
  const pageFields = fields.filter((f) => f.pageNumber === pageNumber)

  // Current page dimensions from the store (populated by onLoadSuccess)
  const dims = pageDimensions.get(pageNumber)

  // isArmed: any non-null armedFieldType
  const isArmed = armedFieldType !== null

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
      if (!armedFieldType || !dims) return
      // Image types require their data URL to be set
      if (armedFieldType === 'signature' && !signatureDataUrl) return
      if (armedFieldType === 'initials' && !initialsDataUrl) return

      // Compute CSS click position relative to the page overlay div
      const rect = e.currentTarget.getBoundingClientRect()
      const cssX = e.clientX - rect.left
      const cssY = e.clientY - rect.top

      // effectiveScale = (containerWidth / originalWidth) * zoom
      // This is the scale used for both page raster width and overlay viewport (RESEARCH A2 + Pitfall 2).
      // dims.scale stays zoom-free (fit-to-width baseline stored by onLoadSuccess).
      const effectiveScale = containerWidth && dims
        ? (containerWidth / dims.originalWidth) * zoom
        : dims.scale
      const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, effectiveScale)

      // Default CSS sizes per type at current scale
      const defaults: Record<FieldType, { w: number; h: number }> = {
        signature: { w: 180, h: 60 },  // adjusted by PNG aspect ratio below
        initials:  { w: 80,  h: 40 },  // adjusted by PNG aspect ratio below
        date:      { w: 160, h: 28 },
        text:      { w: 160, h: 28 },
        checkbox:  { w: 32,  h: 32 },
      }

      let defaultWidthPx  = defaults[armedFieldType].w
      let defaultHeightPx = defaults[armedFieldType].h

      // For image types: derive height from actual PNG aspect ratio
      if (armedFieldType === 'signature' || armedFieldType === 'initials') {
        const dataUrl = armedFieldType === 'signature' ? signatureDataUrl! : initialsDataUrl!
        let aspectRatio = armedFieldType === 'signature' ? 3 : 2 // fallbacks
        try {
          aspectRatio = await new Promise<number>((resolve) => {
            const img = new Image()
            img.onload = () => {
              resolve(img.naturalWidth / img.naturalHeight || (armedFieldType === 'signature' ? 3 : 2))
            }
            img.onerror = () => resolve(armedFieldType === 'signature' ? 3 : 2)
            img.src = dataUrl
          })
        } catch {
          // fallback already set
        }
        defaultHeightPx = defaultWidthPx / aspectRatio
      }

      // Center the field on the click point (compute top-left CSS corner)
      const fieldTopLeftCss = {
        x: cssX - defaultWidthPx / 2,
        y: cssY - defaultHeightPx / 2,
      }

      // Convert top-left CSS corner → PDF space (bottom-left in PDF terms).
      // Coordinate Mapper handles the Y-axis flip — no additional flip needed (Pitfall 2).
      const pdfBottomLeft = cssPixelToPageSpace(fieldTopLeftCss, viewport)

      // Today-date default for 'date' type; empty string for 'text'; undefined otherwise
      const today = new Date()
      const textValue: string | undefined =
        armedFieldType === 'date'
          ? `${today.getMonth() + 1}/${today.getDate()}/${today.getFullYear()}`
          : armedFieldType === 'text'
          ? ''
          : undefined

      const newField: PlacedField = {
        id: crypto.randomUUID(),
        type: armedFieldType,
        pageNumber,
        pdfX:     pdfBottomLeft.x,
        pdfY:     pdfBottomLeft.y,
        pdfWidth:  defaultWidthPx  / effectiveScale,
        pdfHeight: defaultHeightPx / effectiveScale,
        // dataUrl only for image types
        ...(armedFieldType === 'signature' ? { dataUrl: signatureDataUrl! } :
            armedFieldType === 'initials'  ? { dataUrl: initialsDataUrl! }  : {}),
        // textValue for date/text
        ...(textValue !== undefined ? { textValue } : {}),
      }

      // addField handles the complete pre+post history snapshot pair internally —
      // one undo step per field drop with no phantom entries.
      addField(newField)
      setSelectedFieldId(newField.id)
      setArmedFieldType(null) // disarm after drop
    },
    [
      armedFieldType,
      dims,
      signatureDataUrl,
      initialsDataUrl,
      pageNumber,
      containerWidth,
      zoom,
      addField,
      setSelectedFieldId,
      setArmedFieldType,
    ],
  )

  // ── Click-away deselection on overlay (when NOT in placement mode) ──────────
  const handleOverlayClickAway = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isArmed) return // armed mode has its own handler
      // If the click target is the overlay div itself (not a child widget), deselect
      if (e.target === e.currentTarget) {
        setSelectedFieldId(null)
      }
    },
    [isArmed, setSelectedFieldId],
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
          width={containerWidth ? containerWidth * zoom : undefined}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onLoadSuccess={handlePageLoadSuccess}
        />
      )}

      {/* Per-page overlay div — hosts PlacedFieldWidgets for this page.
          pointer-events:none by default (T-02-08) so it never blocks the PDF canvas.
          During armed placement: pointer-events:auto + crosshair cursor to capture clicks.
          Individual widgets re-enable pointer-events:auto themselves. */}
      {isVisible && (
        <div
          onClick={isArmed ? handleOverlayClick : handleOverlayClickAway}
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: isArmed ? 'auto' : 'none',
            cursor: isArmed ? 'crosshair' : 'default',
            // Overlay must NOT intercept non-placement clicks when not armed
            // — individual widgets set pointer-events:auto themselves
          }}
        >
          {/* Render a PlacedFieldWidget for each field on this page.
              Uses effectiveScale so field overlay scales with the page at any zoom level. */}
          {pageFields.map((field) => {
            if (!dims) return null
            // effectiveScale = (containerWidth / originalWidth) * zoom
            // Must match the effectiveScale used for the Page width above (Pitfall 2).
            const fieldEffectiveScale = containerWidth && dims
              ? (containerWidth / dims.originalWidth) * zoom
              : dims.scale
            const viewport = makeSimpleViewport(dims.originalWidth, dims.originalHeight, fieldEffectiveScale)
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
