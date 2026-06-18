/**
 * RegistrationMarks.tsx
 *
 * Absolutely-positioned, pointer-events:none corner crop marks for a PDF page.
 *
 * Rendered as a SIBLING of <Page> and the overlay div inside LazyPage's
 * position:relative outer wrapper — NOT a wrapper around <Page>. This ensures
 * the marks do not create a new containing block that would shift the
 * inset:0 overlay origin (PAR-03 critical constraint).
 *
 * Visual spec (07-UI-SPEC.md § 4):
 * - Four corners, each composed of two <span> arms (horizontal + vertical)
 * - Each arm: 12px long, 1.5px stroke, var(--color-line-strong) colour
 * - Arms sit ~4px outside the page rect so they frame each corner without
 *   overlapping the page canvas
 * - pointer-events:none, user-select:none, aria-hidden — pure decoration
 * - overflow:visible so arms outside the page rect are visible
 */
export function RegistrationMarks() {
  const ARM_LEN = 12 // px — arm length
  const STROKE = 1.5 // px — arm stroke width
  const OFFSET = 4 // px — how far outside the page rect the arm origins are
  const COLOR = 'var(--color-line-strong)'

  // Shared wrapper style: absolutely-fills parent, no layout effect
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    userSelect: 'none',
    overflow: 'visible',
    zIndex: 0,
    // aria-hidden set on the element itself (JSX attribute below)
  }

  // Corner definitions: which CSS properties to set for the outer corner div
  // and for the two arm spans (horizontal and vertical).
  type Corner = {
    corner: React.CSSProperties  // position of the corner composite
    hArm: React.CSSProperties    // horizontal arm
    vArm: React.CSSProperties    // vertical arm
  }

  const corners: Corner[] = [
    // Top-left
    {
      corner: { position: 'absolute', top: -OFFSET, left: -OFFSET },
      hArm:   { width: ARM_LEN, height: STROKE, top: 0, left: 0 },
      vArm:   { width: STROKE, height: ARM_LEN, top: 0, left: 0 },
    },
    // Top-right
    {
      corner: { position: 'absolute', top: -OFFSET, right: -OFFSET },
      hArm:   { width: ARM_LEN, height: STROKE, top: 0, right: 0 },
      vArm:   { width: STROKE, height: ARM_LEN, top: 0, right: 0 },
    },
    // Bottom-left
    {
      corner: { position: 'absolute', bottom: -OFFSET, left: -OFFSET },
      hArm:   { width: ARM_LEN, height: STROKE, bottom: 0, left: 0 },
      vArm:   { width: STROKE, height: ARM_LEN, bottom: 0, left: 0 },
    },
    // Bottom-right
    {
      corner: { position: 'absolute', bottom: -OFFSET, right: -OFFSET },
      hArm:   { width: ARM_LEN, height: STROKE, bottom: 0, right: 0 },
      vArm:   { width: STROKE, height: ARM_LEN, bottom: 0, right: 0 },
    },
  ]

  const armBase: React.CSSProperties = {
    position: 'absolute',
    backgroundColor: COLOR,
    display: 'block',
  }

  return (
    <div style={containerStyle} aria-hidden="true">
      {corners.map((c, i) => (
        <div key={i} style={c.corner}>
          {/* Horizontal arm */}
          <span style={{ ...armBase, ...c.hArm }} />
          {/* Vertical arm */}
          <span style={{ ...armBase, ...c.vArm }} />
        </div>
      ))}
    </div>
  )
}
