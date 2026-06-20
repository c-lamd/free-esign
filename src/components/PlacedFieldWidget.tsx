/**
 * PlacedFieldWidget.tsx
 *
 * A react-rnd controlled drag/resize widget that renders one placed field.
 * Position and size are derived from PDF-space coordinates and converted to CSS pixels
 * at the current render scale via the Coordinate Mapper.
 *
 * On drag/resize stop the widget converts back to PDF-space and updates the store
 * so positions are render-scale-independent.
 *
 * Phase 3 additions:
 * - Per-type rendering: image (signature/initials), inline input (date/text), checkbox ✕
 * - Local isEditing/localValue state for text/date inline editing
 * - pushHistory before updateField on drag/resize/blur (one undo entry each)
 * - disableDragging={isEditing} to prevent drag while typing
 * - lockAspectRatio per type (true for signature/initials/checkbox; false for date/text)
 * - Per-type aria-labels on delete button and outer wrapper
 *
 * @see 03-02-PLAN.md Task 2
 * @see 03-UI-SPEC.md PlacedFieldWidget
 * @see 03-RESEARCH.md Section 5 (Inline Text/Date Editing)
 * @see src/lib/coordinateMapper.ts (cssPixelToPageSpace / pageSpaceToCssPixel)
 * @see src/lib/pageViewport.ts (SimpleViewport)
 */

import { useState, useEffect, useRef } from 'react'
import { Rnd } from 'react-rnd'
import type { PlacedField, FieldType } from '../store/fieldStore'
import { useFieldStore } from '../store/fieldStore'
import { cssPixelToPageSpace, pageSpaceToCssPixel } from '../lib/coordinateMapper'
import type { SimpleViewport } from '../lib/pageViewport'
import { FORM_FIELD_FONT_PT } from '../lib/fieldDefaults'

// ---------------------------------------------------------------------------
// Resize handle dot — 8px accent circle with white ring (UI-SPEC)
// ---------------------------------------------------------------------------

function ResizeHandle() {
  return (
    <div
      style={{
        width: '8px',
        height: '8px',
        backgroundColor: 'var(--color-accent)',
        border: '2px solid white',
        borderRadius: '50%',
        // Center the dot on the handle position
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Per-type aria strings (Copywriting Contract)
// ---------------------------------------------------------------------------

// Base aria labels for drawn (image-backed) signature/initials.
// Font-backed (typed) fields get a runtime override — see getWrapperAriaLabel().
const WRAPPER_ARIA_LABEL: Record<FieldType, string> = {
  signature: 'Placed signature — press Delete to remove',
  initials:  'Placed initials — press Delete to remove',
  date:      'Placed date field — press Delete to remove',
  text:      'Placed text field — press Delete to remove',
  checkbox:  'Placed checkbox mark — press Delete to remove',
}

/**
 * Returns the correct wrapper aria-label for a placed field.
 * Font-backed (typed) signature/initials get distinct labels (UI-SPEC).
 */
function getWrapperAriaLabel(field: PlacedField): string {
  if ((field.type === 'signature' || field.type === 'initials') && !field.dataUrl && field.textValue) {
    return field.type === 'signature'
      ? 'Placed typed signature — press Delete to remove'
      : 'Placed typed initials — press Delete to remove'
  }
  return WRAPPER_ARIA_LABEL[field.type]
}

// ---------------------------------------------------------------------------
// EDT-06: Mono tag label map — short uppercase label shown above selected field
// ---------------------------------------------------------------------------

const FIELD_SHORT_LABEL: Record<FieldType, string> = {
  signature: 'SIG',
  initials:  'INI',
  date:      'DATE',
  text:      'TXT',
  checkbox:  '☑',
}

const DELETE_ARIA_LABEL: Record<FieldType, string> = {
  signature: 'Delete signature',
  initials:  'Delete initials',
  date:      'Delete date field',
  text:      'Delete text field',
  checkbox:  'Delete checkbox field',
}

// DELETE_SR_ONLY was removed (IN-01): the inner sr-only span duplicated the
// aria-label, causing double announcement ("Delete signature Delete signature").
// The aria-label on the button is sufficient for screen readers.

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PlacedFieldWidgetProps {
  field: PlacedField
  viewport: SimpleViewport
  isSelected: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PlacedFieldWidget({ field, viewport, isSelected }: PlacedFieldWidgetProps) {
  const updateField = useFieldStore((s) => s.updateField)
  const deleteField = useFieldStore((s) => s.deleteField)
  const setSelectedFieldId = useFieldStore((s) => s.setSelectedFieldId)
  const pushHistory = useFieldStore((s) => s.pushHistory)

  // Convert PDF-space rect to CSS pixels for react-rnd controlled mode
  const cssPos = pageSpaceToCssPixel({ x: field.pdfX, y: field.pdfY }, viewport)
  const cssWidth  = field.pdfWidth  * viewport.scale
  const cssHeight = field.pdfHeight * viewport.scale

  // ── Inline text/date editing state ────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false)
  const [localValue, setLocalValue] = useState(field.textValue ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync local value when field.textValue changes externally (e.g., undo)
  useEffect(() => {
    setLocalValue(field.textValue ?? '')
  }, [field.textValue])

  // ---------------------------------------------------------------------------
  // Event handlers
  // ---------------------------------------------------------------------------

  function handleClick(e: React.MouseEvent) {
    // Stop propagation so the page overlay click-away does not immediately deselect
    e.stopPropagation()
    setSelectedFieldId(field.id)
  }

  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation()
    deleteField(field.id)
  }

  function handleDragStop(_e: unknown, d: { x: number; y: number }) {
    // d.x, d.y are the new CSS pixel position after drag (top-left corner)
    // No double Y-flip: cssPixelToPageSpace already handles the Y-axis inversion (Pitfall 2)
    const newPdfPos = cssPixelToPageSpace({ x: d.x, y: d.y }, viewport)
    pushHistory() // one undo entry before position change
    updateField(field.id, { pdfX: newPdfPos.x, pdfY: newPdfPos.y })
  }

  function handleResizeStop(
    _e: unknown,
    _direction: unknown,
    ref: HTMLElement,
    _delta: unknown,
    position: { x: number; y: number },
  ) {
    // ref.style.width/height are CSS strings like "180px" — use parseFloat (Pitfall 7)
    const newCssWidth  = parseFloat(ref.style.width)
    const newCssHeight = parseFloat(ref.style.height)
    const newPdfWidth  = newCssWidth  / viewport.scale
    const newPdfHeight = newCssHeight / viewport.scale
    const newPdfPos    = cssPixelToPageSpace({ x: position.x, y: position.y }, viewport)
    pushHistory() // one undo entry before size/position change
    updateField(field.id, {
      pdfX:      newPdfPos.x,
      pdfY:      newPdfPos.y,
      pdfWidth:  newPdfWidth,
      pdfHeight: newPdfHeight,
    })
  }

  function handleInputBlur() {
    setIsEditing(false)
    // Only push history and persist if the value actually changed (WR-04).
    // Blurring without editing must not create a phantom undo entry.
    if (localValue === (field.textValue ?? '')) return
    pushHistory() // one undo entry per committed text change (not per keystroke)
    updateField(field.id, { textValue: localValue })
  }

  // ---------------------------------------------------------------------------
  // Per-type content rendered inside the Rnd
  // ---------------------------------------------------------------------------

  let content: React.ReactNode = null

  if (field.type === 'signature' || field.type === 'initials') {
    if (field.dataUrl) {
      // Image-backed (drawn) — transparent-background PNG
      content = (
        <img
          src={field.dataUrl}
          alt={`Placed ${field.type}`}
          draggable={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            display: 'block',
            userSelect: 'none',
          }}
        />
      )
    } else if (field.textValue && field.fontFamily) {
      // Font-backed (typed) — render text in the @font-face script font (WYSIWYG with export).
      // T-04-06: React renders field.textValue as a text node — no dangerouslySetInnerHTML (XSS-safe).
      // Fit-to-box heuristic: fill height×0.85, capped by width heuristic (mirrors drawSignatureText).
      const fontSize = Math.min(
        cssHeight * 0.85,
        cssWidth / (field.textValue.length * 0.6 + 0.5),
      )
      content = (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            fontFamily: field.fontFamily, // CSS @font-face name — same TTF as export (WYSIWYG)
            fontSize,
            color: 'var(--color-text-primary)',
            whiteSpace: 'nowrap',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {field.textValue}
        </div>
      )
    }
  } else if (field.type === 'date' || field.type === 'text') {
    // Inline editable text input.
    // Dragging is handled by the outer Rnd (disableDragging={isEditing} gates it).
    // Double-click on the outer wrapper activates editing; single click just selects.
    content = (
      <input
        ref={inputRef}
        type="text"
        value={localValue}
        readOnly={!isEditing}
        placeholder={field.type === 'text' ? 'Type here' : undefined}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={(e) => {
          setIsEditing(true)
          e.currentTarget.style.borderColor = 'var(--color-accent)'
        }}
        onBlur={(e) => {
          handleInputBlur()
          e.currentTarget.style.borderColor = 'var(--color-border)'
        }}
        aria-label={field.type === 'date' ? 'Date field value' : 'Text field content'}
        style={{
          width: '100%',
          height: '100%',
          border: '1px solid var(--color-border)',
          borderRadius: '3px',
          padding: '0 4px',
          fontSize: `${FORM_FIELD_FONT_PT * viewport.scale}px`,
          fontWeight: 400,
          fontFamily: 'inherit',
          color: 'var(--color-text-primary)',
          backgroundColor: 'transparent',
          boxSizing: 'border-box',
          outline: 'none',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          pointerEvents: isEditing ? 'auto' : 'none',
          cursor: isEditing ? 'text' : 'inherit',
        }}
      />
    )
  } else if (field.type === 'checkbox') {
    // Bold ✕ centered (U+2715 on-screen only; PDF export uses ASCII 'X')
    const fontSize = Math.min(cssHeight * 0.7, cssWidth * 0.7)
    content = (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
          height: '100%',
          fontSize,
          fontWeight: 700,
          color: 'var(--color-text-primary)',
          userSelect: 'none',
          pointerEvents: 'none',
        }}
      >
        ✕
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Per-type Rnd configuration
  // ---------------------------------------------------------------------------

  // Phase 4 fix (RESEARCH Pitfall 2): lock aspect ratio only for IMAGE-backed sig/initials
  // (drawn, dataUrl present) and checkbox. Font-backed (typed) fields have no natural pixel
  // aspect ratio and must resize freely (lockAspectRatio={false}).
  const shouldLockAspectRatio =
    ((field.type === 'signature' || field.type === 'initials') && !!field.dataUrl) ||
    field.type === 'checkbox'

  const minWidth  = field.type === 'checkbox' ? 20 : 80
  const minHeight = field.type === 'checkbox' ? 20 : 24

  // ---------------------------------------------------------------------------
  // Resize handle component map (only shown when selected, but Rnd always needs them)
  // ---------------------------------------------------------------------------
  const handleComponents = isSelected
    ? {
        topLeft:     <ResizeHandle />,
        topRight:    <ResizeHandle />,
        bottomLeft:  <ResizeHandle />,
        bottomRight: <ResizeHandle />,
        top:         <ResizeHandle />,
        bottom:      <ResizeHandle />,
        left:        <ResizeHandle />,
        right:       <ResizeHandle />,
      }
    : undefined

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      role={
        field.type === 'checkbox' || field.type === 'signature' || field.type === 'initials'
          ? 'img'
          : undefined
      }
      aria-label={getWrapperAriaLabel(field)}
      data-selected={isSelected ? 'true' : undefined}
      onClick={handleClick}
      onDoubleClick={() => {
        if (field.type === 'date' || field.type === 'text') {
          setIsEditing(true)
          requestAnimationFrame(() => inputRef.current?.focus())
        }
      }}
      style={{
        // Outer wrapper FILLS the page so react-rnd bounds="parent" clamps to the page.
        // (With display:inline-block + an absolute Rnd child this collapsed to 0×0, so
        // dragging snapped every field to the top-left corner.) pointer-events:none lets
        // clicks fall through to the overlay / underlying fields; the Rnd re-enables
        // pointer events for itself. Visual chrome lives on the Rnd inner div.
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
      }}
    >
      <Rnd
        position={{ x: cssPos.x, y: cssPos.y }}
        size={{ width: cssWidth, height: cssHeight }}
        bounds="parent"
        lockAspectRatio={shouldLockAspectRatio}
        minWidth={minWidth}
        minHeight={minHeight}
        disableDragging={isEditing}
        enableResizing={true}
        resizeHandleComponent={handleComponents}
        onDragStop={handleDragStop}
        onResizeStop={handleResizeStop}
        style={{
          // EDT-06: accent outline — 1px semi-transparent when unselected, 2px solid when selected
          border: isSelected
            ? '2px solid var(--color-accent-line)'
            : '1px solid rgba(255, 77, 0, 0.35)',
          // EDT-06: translucent accent fill behind field content (PAR-03 safe: style only)
          backgroundColor: 'color-mix(in srgb, var(--color-accent-soft) 40%, transparent)',
          boxSizing: 'border-box',
          // Re-enable interaction: the full-page outer wrapper is pointer-events:none.
          pointerEvents: 'auto',
        }}
      >
        {/* EDT-06: mono tag label — absolutely-positioned above the field, shown only when selected.
            aria-hidden: accessible name is already on the outer wrapper div. */}
        {isSelected && (
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '-20px',
              left: 0,
              fontFamily: 'var(--font-mono)',
              fontSize: '9px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--color-accent)',
              lineHeight: 1,
              whiteSpace: 'nowrap',
              pointerEvents: 'none',
            }}
          >
            {FIELD_SHORT_LABEL[field.type]}
          </span>
        )}

        {content}

        {/* Delete control — shown only when selected (UI-SPEC: × button top-right) */}
        {isSelected && (
          <button
            onClick={handleDeleteClick}
            aria-label={DELETE_ARIA_LABEL[field.type]}
            style={{
              // Position: top-right corner of the widget, overlapping the border
              position: 'absolute',
              top: '-12px',
              right: '-12px',
              // Visual: 24px × 24px red circle with white ×
              width: '24px',
              height: '24px',
              backgroundColor: 'var(--color-destructive)',
              color: 'white',
              border: 'none',
              borderRadius: '50%',
              boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 600,
              lineHeight: 1,
              // Touch target: 32px × 32px transparent padding (UI-SPEC 32px touch target)
              padding: '4px',
              // Keep the button above the widget border
              zIndex: 10,
              // Focus ring: 2px accent outline (UI-SPEC + accessibility)
              outline: 'none',
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-accent)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
              e.currentTarget.style.outlineOffset = '0'
            }}
            onMouseEnter={(e) => {
              // Hover: #B91C1C (red-700) — UI-SPEC DeleteControl hover
              e.currentTarget.style.backgroundColor = '#B91C1C'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-destructive)'
            }}
          >
            {/* Visible × character — aria-label on the button provides the accessible name */}
            ×
          </button>
        )}
      </Rnd>
    </div>
  )
}
