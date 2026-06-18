/**
 * lcdReadout.test.tsx — EDT-03 LcdReadout component tests.
 *
 * Tests:
 *   a. Returns no LCD wrapper when numPages is null (no document loaded)
 *   b. Returns no LCD wrapper when numPages is 0
 *   c. With numPages=3, currentPage=1, zoom=1.0, 2 fields: status row reads
 *      "PG 01/03 · ZM 100 · FLD 02"
 *   d. Guarantee row contains "ORIG.BYTES OK"
 *   e. Updating zoom to 1.5 re-renders ZM 150
 *
 * State seeding mirrors downloadWiring.test.ts pattern:
 *   useDocumentStore.getState() + useFieldStore.getState() direct mutation.
 *
 * Plan 07-01, Task 2 (TDD).
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import React from 'react'

/** Resolves the Zustand stores. */
async function getStores() {
  const { useDocumentStore } = await import('../store/documentStore')
  const { useFieldStore } = await import('../store/fieldStore')
  return { useDocumentStore, useFieldStore }
}

/** Build a minimal valid PlacedField for testing. */
function makeField(id = 'field-1') {
  return {
    id,
    type: 'signature' as const,
    pageNumber: 1,
    pdfX: 100,
    pdfY: 200,
    pdfWidth: 180,
    pdfHeight: 60,
    dataUrl: 'data:image/png;base64,AAAA',
  }
}

/** Renders LcdReadout and waits for it to settle. Returns the container. */
async function renderLcdReadout() {
  const { LcdReadout } = await import('../components/LcdReadout')
  let container!: Element
  await act(async () => {
    const result = render(React.createElement(LcdReadout))
    container = result.container
  })
  return container
}

afterEach(() => {
  cleanup()
})

// ── Mount guard tests ────────────────────────────────────────────────────────

describe('LcdReadout — mount guard (no document loaded)', () => {
  beforeEach(async () => {
    const { useDocumentStore, useFieldStore } = await getStores()
    // Reset to default state (numPages is null)
    useDocumentStore.getState().reset()
    useFieldStore.getState().resetFields()
  })

  it('returns null (no LCD wrapper) when numPages is null', async () => {
    const container = await renderLcdReadout()
    // The aria-label "Document session status" should NOT be in the DOM
    const lcd = container.querySelector('[aria-label="Document session status"]')
    expect(lcd).toBeNull()
  })

  it('returns null when numPages is 0', async () => {
    const { useDocumentStore } = await getStores()
    // Manually set numPages to 0 (edge case below the guard)
    useDocumentStore.setState({ numPages: 0 })
    const container = await renderLcdReadout()
    const lcd = container.querySelector('[aria-label="Document session status"]')
    expect(lcd).toBeNull()
  })
})

// ── Status line rendering ────────────────────────────────────────────────────

describe('LcdReadout — live status with document loaded', () => {
  beforeEach(async () => {
    const { useDocumentStore, useFieldStore } = await getStores()
    // Seed state: 3 pages, current page 1, zoom 1.0, 2 fields
    useDocumentStore.getState().reset()
    useDocumentStore.getState().loadDocument('blob:test-url')
    useDocumentStore.getState().setNumPages(3)
    useDocumentStore.setState({ currentPage: 1, zoom: 1.0 })
    useFieldStore.getState().resetFields()
    useFieldStore.getState().addField(makeField('f1'))
    useFieldStore.getState().addField(makeField('f2'))
  })

  it('renders the guarantee row containing ORIG.BYTES OK', async () => {
    const container = await renderLcdReadout()
    const lcd = container.querySelector('[aria-label="Document session status"]')
    expect(lcd).not.toBeNull()
    expect(lcd!.textContent).toContain('ORIG.BYTES OK')
  })

  it('renders status row "PG 01/03 · ZM 100 · FLD 02"', async () => {
    const container = await renderLcdReadout()
    // The live status element has role="status"
    const statusEl = container.querySelector('[role="status"]')
    expect(statusEl).not.toBeNull()
    expect(statusEl!.textContent).toBe('PG 01/03 · ZM 100 · FLD 02')
  })

  it('updates ZM to 150 when zoom changes to 1.5', async () => {
    const { useDocumentStore } = await getStores()
    const { LcdReadout } = await import('../components/LcdReadout')

    // Render and then update zoom reactively
    let statusEl: Element | null = null
    await act(async () => {
      const result = render(React.createElement(LcdReadout))
      statusEl = result.container.querySelector('[role="status"]')
    })

    expect(statusEl!.textContent).toContain('ZM 100')

    // Update zoom to 1.5 via the store
    await act(async () => {
      useDocumentStore.getState().setZoom(1.5)
    })

    // Re-query after update
    expect(statusEl!.textContent).toContain('ZM 150')
  })
})
