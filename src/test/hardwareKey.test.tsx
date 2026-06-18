/**
 * hardwareKey.test.tsx — FND-04 HardwareKey primitive structure + behavior tests.
 *
 * Tests:
 *   1. Renders <button> with children as accessible name
 *   2. Applies the base .hw-key class
 *   3. armed={true} adds .hw-key--armed class
 *   4. disabled={true} sets aria-disabled="true" and is NOT HTML-disabled (WCAG 2.5.5)
 *   5. onClick is suppressed when disabled is true
 *
 * Physics note: The :active border-collapse (3px → 1px) and translateY are CSS
 * pseudo-class transitions — jsdom cannot observe them. They are verified by the
 * manual browser check at the post-Phase-8 checkpoint (per orchestrator agreement).
 * This test proves structure, the armed class, and the disabled guard.
 *
 * TDD: RED until Task 2 creates HardwareKey.tsx.
 * Plan 06-03, Task 1.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

beforeEach(() => {
  cleanup()
})

describe('FND-04: HardwareKey primitive', () => {
  it('renders a <button> with children as the accessible name', async () => {
    const { HardwareKey } = await import('../components/ui/HardwareKey')
    render(React.createElement(HardwareKey, null, 'EXPORT'))
    expect(screen.getByRole('button', { name: 'EXPORT' })).toBeInTheDocument()
  })

  it('applies the base .hw-key class', async () => {
    const { HardwareKey } = await import('../components/ui/HardwareKey')
    const { container } = render(React.createElement(HardwareKey, null, 'EXPORT'))
    expect(container.querySelector('.hw-key')).toBeTruthy()
  })

  it('armed={true} adds the .hw-key--armed class', async () => {
    const { HardwareKey } = await import('../components/ui/HardwareKey')
    const { container } = render(
      React.createElement(HardwareKey, { armed: true }, 'EXPORT'),
    )
    expect(container.querySelector('.hw-key--armed')).toBeTruthy()
  })

  it('disabled={true} sets aria-disabled="true" (NOT HTML disabled) — WCAG 2.5.5', async () => {
    const { HardwareKey } = await import('../components/ui/HardwareKey')
    render(React.createElement(HardwareKey, { disabled: true }, 'EXPORT'))
    const btn = screen.getByRole('button', { name: 'EXPORT' })
    // Must have aria-disabled for AT
    expect(btn).toHaveAttribute('aria-disabled', 'true')
    // Must NOT be HTML-disabled — keeps focus reachable (WCAG 2.5.5)
    expect(btn).not.toBeDisabled()
  })

  it('onClick is NOT called when disabled={true} and the button is clicked', async () => {
    const { HardwareKey } = await import('../components/ui/HardwareKey')
    const spy = vi.fn()
    render(
      React.createElement(HardwareKey, { disabled: true, onClick: spy }, 'EXPORT'),
    )
    const btn = screen.getByRole('button', { name: 'EXPORT' })
    fireEvent.click(btn)
    expect(spy).not.toHaveBeenCalled()
  })
})
