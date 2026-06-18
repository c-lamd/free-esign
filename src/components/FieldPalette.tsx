/**
 * FieldPalette.tsx
 *
 * Five numbered hardware keys for arming the five field types:
 * SIG 01, INI 02, DATE 03, TXT 04, ☑ 05.
 *
 * Armed state behavior (UNCHANGED from prior implementation):
 * - Exactly one or zero buttons is armed at a time.
 * - Clicking an armed button disarms it (toggles to null).
 * - Clicking another button arms it and disarms the previous.
 * - Signature opens the draw modal (existing flow) — the modal calls setArmedFieldType('signature') on confirm.
 * - Initials calls openInitialsModal() — the modal (Plan 04) sets initialsDataUrl and arms 'initials'.
 * - Date, Text, Checkbox arm directly via setArmedFieldType.
 *
 * Visual treatment (EDT-02):
 * - Each button uses the HardwareKey primitive (FND-04) with armed={armedFieldType === type}
 * - Two-line key structure: main label (SIG/INI/DATE/TXT/☑) over sublabel (01-05)
 * - aria-labels and aria-pressed are PRESERVED verbatim (PAR-01)
 *
 * @see 07-UI-SPEC.md § 2 (FieldPalette — Numbered Hardware Keys)
 * @see 07-RESEARCH.md Code Examples "FieldPalette Key Structure"
 * @see src/store/fieldStore.ts (armedFieldType, setArmedFieldType, openInitialsModal)
 */

import { useFieldStore } from '../store/fieldStore'
import type { FieldType } from '../store/fieldStore'
import { HardwareKey } from './ui/HardwareKey'

// Short mono labels per type (main label row)
const SHORT_LABELS: Record<FieldType, string> = {
  signature: 'SIG',
  initials:  'INI',
  date:      'DATE',
  text:      'TXT',
  checkbox:  '☑',
}

// Silkscreen sublabel numbers per type (01–05 in PALETTE_TYPES order)
const NUMBERS: Record<FieldType, string> = {
  signature: '01',
  initials:  '02',
  date:      '03',
  text:      '04',
  checkbox:  '05',
}

// aria-label per type (Copywriting Contract — PRESERVED VERBATIM, PAR-01)
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
  const armedFieldType    = useFieldStore((s) => s.armedFieldType)
  const setArmedFieldType = useFieldStore((s) => s.setArmedFieldType)
  const openModal         = useFieldStore((s) => s.openModal)
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
          <HardwareKey
            key={type}
            armed={isArmed}
            onClick={() => handleButtonClick(type)}
            aria-label={ARIA_LABELS[type]}
            aria-pressed={isArmed}
          >
            {/* Two-line key structure: main label over sublabel (07-UI-SPEC § 2) */}
            <span
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  lineHeight: 1,
                }}
              >
                {SHORT_LABELS[type]}
              </span>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 400,
                  lineHeight: 1,
                  color: isArmed ? 'inherit' : 'var(--color-ink-muted)',
                }}
              >
                {NUMBERS[type]}
              </span>
            </span>
          </HardwareKey>
        )
      })}
    </div>
  )
}
