/**
 * FieldPalette.tsx
 *
 * A compact group of five labeled buttons for arming the five field types:
 * Signature, Initials, Date, Text, Checkbox.
 *
 * Armed state behavior:
 * - Exactly one or zero buttons is armed at a time.
 * - Clicking an armed button disarms it (toggles to null).
 * - Clicking another button arms it and disarms the previous.
 * - Signature opens the draw modal (existing flow) — the modal calls setArmedFieldType('signature') on confirm.
 * - Initials calls openInitialsModal() — the modal (Plan 04) sets initialsDataUrl and arms 'initials'.
 * - Date, Text, Checkbox arm directly via setArmedFieldType.
 *
 * @see 03-UI-SPEC.md FieldPalette
 * @see 03-CONTEXT.md Area 1 (field palette, click-to-arm)
 * @see src/store/fieldStore.ts (armedFieldType, setArmedFieldType, openInitialsModal)
 */

import { useFieldStore } from '../store/fieldStore'
import type { FieldType } from '../store/fieldStore'

// Button label text per type
const LABELS: Record<FieldType, string> = {
  signature: 'Signature',
  initials:  'Initials',
  date:      'Date',
  text:      'Text',
  checkbox:  'Checkbox',
}

// aria-label per type (Copywriting Contract)
const ARIA_LABELS: Record<FieldType, string> = {
  signature: 'Place signature field',
  initials:  'Place initials field',
  date:      'Place date field',
  text:      'Place text field',
  checkbox:  'Place checkbox field',
}

// Ordered list of buttons (left to right in palette)
const PALETTE_TYPES: FieldType[] = ['signature', 'initials', 'date', 'text', 'checkbox']

export function FieldPalette() {
  const armedFieldType  = useFieldStore((s) => s.armedFieldType)
  const setArmedFieldType = useFieldStore((s) => s.setArmedFieldType)
  const openModal       = useFieldStore((s) => s.openModal)
  const openInitialsModal = useFieldStore((s) => s.openInitialsModal)

  function handleButtonClick(type: FieldType) {
    if (type === 'signature') {
      // Signature: open the draw modal (existing flow); modal arms 'signature' on confirm
      openModal()
      return
    }
    if (type === 'initials') {
      // Initials: open the initials draw modal (Plan 04)
      openInitialsModal()
      return
    }
    // Date, Text, Checkbox: toggle armed state
    setArmedFieldType(armedFieldType === type ? null : type)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      {PALETTE_TYPES.map((type) => {
        const isArmed = armedFieldType === type

        return (
          <button
            key={type}
            onClick={() => handleButtonClick(type)}
            aria-label={ARIA_LABELS[type]}
            aria-pressed={isArmed}
            style={{
              background: isArmed ? 'var(--color-accent)' : 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 400,
              color: isArmed ? '#FFFFFF' : 'var(--color-text-secondary)',
              padding: '8px',
              minHeight: '44px',
              minWidth: '44px',
              borderRadius: '6px',
              outline: 'none',
              fontFamily: 'inherit',
              lineHeight: 1.4,
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              if (isArmed) {
                btn.style.backgroundColor = 'var(--color-accent-hover)'
              } else {
                btn.style.color = 'var(--color-text-primary)'
              }
            }}
            onMouseLeave={(e) => {
              const btn = e.currentTarget as HTMLButtonElement
              if (isArmed) {
                btn.style.backgroundColor = 'var(--color-accent)'
              } else {
                btn.style.color = 'var(--color-text-secondary)'
              }
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-accent)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
              e.currentTarget.style.outlineOffset = '0'
            }}
          >
            {LABELS[type]}
          </button>
        )
      })}
    </div>
  )
}
