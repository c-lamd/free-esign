// pdfWorker side-effect is anchored in main.tsx (WR-02); the named import here gives
// access to pdfOptions for any per-Page rendering needs and keeps the pdfjs worker
// self-hosted (no CDN — PRV-02 / PAR-07). The <Page> below is rendered inside the
// single shared <Document> owned by OrganizeRoute, so this component imports only Page.
import { Page } from 'react-pdf'
import { HardwareKey } from './ui/HardwareKey'

/**
 * PageThumbnail — one page preview cell for the Organize grid (ORG-01).
 *
 * Renders a single PDF page as a small pdfjs thumbnail (via react-pdf's <Page>, which
 * must live inside the parent's shared <Document> so the PDF parses ONCE for the whole
 * grid). The page's current rotation (0/90/180/270) is applied to the preview via the
 * Page `rotate` prop so the thumbnail visually matches what `organizePages` will
 * produce on rebuild.
 *
 * Chrome (instrument-panel): a bone card with a mono 1-based page-number badge and two
 * HardwareKey controls — ↻ rotate and ✕ remove. Reorder is owned by the parent: this
 * cell exposes optional move-up / move-down HardwareKeys (the simplest reliable grid
 * reorder; native HTML5 drag is layered on top via the draggable props the parent
 * wires) so the displayed order IS the rebuild order.
 *
 * Presentational only — no store coupling, no fetch, no network (PAR-05). Tests mock
 * 'react-pdf' so the <Page> renders as a marker; behavior (badge, rotation pass-through,
 * control callbacks) is asserted without real pdfjs rendering.
 */
export interface PageThumbnailProps {
  /** 0-based index of the source page this cell renders. */
  srcIndex: number
  /** 1-based position of this cell in the current order (shown in the badge). */
  displayNumber: number
  /** Current additive rotation applied to the preview (0/90/180/270). */
  rotation: number
  /** Fixed thumbnail render width in px (defaults to a small grid cell). */
  width?: number
  /** Advance this page's rotation (parent does 0→90→180→270→0). */
  onRotate: () => void
  /** Remove this page from the grid + rebuild. */
  onDelete: () => void
  /** Move this page one position earlier (optional — parent reorder control). */
  onMoveUp?: () => void
  /** Move this page one position later (optional — parent reorder control). */
  onMoveDown?: () => void
  /** True when this is the first cell (move-up disabled). */
  isFirst?: boolean
  /** True when this is the last cell (move-down disabled). */
  isLast?: boolean
  /** Native HTML5 drag wiring from the parent (optional reorder affordance). */
  draggable?: boolean
  onDragStart?: (e: React.DragEvent<HTMLDivElement>) => void
  onDragOver?: (e: React.DragEvent<HTMLDivElement>) => void
  onDrop?: (e: React.DragEvent<HTMLDivElement>) => void
}

const THUMB_WIDTH = 150

export function PageThumbnail({
  srcIndex,
  displayNumber,
  rotation,
  width = THUMB_WIDTH,
  onRotate,
  onDelete,
  onMoveUp,
  onMoveDown,
  isFirst = false,
  isLast = false,
  draggable = false,
  onDragStart,
  onDragOver,
  onDrop,
}: PageThumbnailProps) {
  return (
    <div
      role="group"
      aria-label={`Page ${displayNumber}`}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '8px',
        padding: '10px',
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-line-strong)',
        borderRadius: '8px',
        cursor: draggable ? 'grab' : 'default',
        userSelect: 'none',
      }}
    >
      {/* Page-number badge (mono, 1-based position in the current order) */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          gap: '6px',
        }}
      >
        <span
          aria-label={`Page number ${displayNumber}`}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            color: 'var(--color-text-primary)',
            background: 'var(--color-key)',
            border: '1px solid var(--color-line-strong)',
            borderRadius: '4px',
            padding: '2px 6px',
          }}
        >
          {displayNumber}
        </span>
        {draggable && (
          <span
            aria-hidden="true"
            title="Drag to reorder"
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '12px',
              color: 'var(--color-ink-faint)',
              cursor: 'grab',
            }}
          >
            ⠿
          </span>
        )}
      </div>

      {/* The pdfjs page preview — rotation applied via the Page rotate prop */}
      <div
        style={{
          background: 'var(--color-canvas)',
          border: '1px solid var(--color-border)',
          borderRadius: '4px',
          overflow: 'hidden',
          minHeight: '40px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Page
          pageNumber={srcIndex + 1}
          rotate={rotation}
          width={width}
          renderTextLayer={false}
          renderAnnotationLayer={false}
        />
      </div>

      {/* Controls: rotate / delete (+ optional move up/down for reorder) */}
      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {onMoveUp && (
          <HardwareKey
            onClick={onMoveUp}
            disabled={isFirst}
            aria-label={`Move page ${displayNumber} up`}
          >
            ↑
          </HardwareKey>
        )}
        {onMoveDown && (
          <HardwareKey
            onClick={onMoveDown}
            disabled={isLast}
            aria-label={`Move page ${displayNumber} down`}
          >
            ↓
          </HardwareKey>
        )}
        <HardwareKey onClick={onRotate} aria-label={`Rotate page ${displayNumber}`}>
          ↻
        </HardwareKey>
        <HardwareKey onClick={onDelete} aria-label={`Delete page ${displayNumber}`}>
          ✕
        </HardwareKey>
      </div>
    </div>
  )
}
