/**
 * toolsListing.test.tsx — SUITE-03 tools-listing view at /tools.
 *
 * The /tools listing enumerates every TOOL_REGISTRY entry as a row with the
 * tool name + its one-line blurb — generated from the single registry (N entries
 * → N rows). Live rows link to their route (Sign → /sign); coming-soon rows are
 * marked. It renders inside the shared <ToolFrame> for suite continuity.
 *
 * ToolFrame + the registry's Sign element transitively import react-pdf's
 * pdfWorker (DOMMatrix at import time) — mock it like the signing-flow tests.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('react-pdf', () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' }, version: '0' },
}))
vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: { cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' },
}))

import { ToolsListing } from '../components/ToolsListing'
import { TOOL_REGISTRY } from '../tools/registry'

afterEach(() => cleanup())

function renderListing() {
  return render(
    <MemoryRouter>
      <ToolsListing />
    </MemoryRouter>,
  )
}

describe('SUITE-03: tools-listing view at /tools', () => {
  it('renders one row per TOOL_REGISTRY entry', () => {
    const { container } = renderListing()
    const rows = container.querySelectorAll('[data-tool-row]')
    expect(rows.length).toBe(TOOL_REGISTRY.length)
  })

  it('shows every tool name AND blurb', () => {
    const { getByText } = renderListing()
    for (const tool of TOOL_REGISTRY) {
      expect(getByText(tool.name)).toBeTruthy()
      expect(getByText(tool.blurb)).toBeTruthy()
    }
  })

  it('the Sign row links to /sign', () => {
    const { container } = renderListing()
    const row = container.querySelector('[data-tool-row="sign"]')
    expect(row).not.toBeNull()
    const link = row!.querySelector('a')
    expect(link).not.toBeNull()
    expect(link!.getAttribute('href')).toBe('/sign')
  })

  it('coming-soon rows are marked and do not link', () => {
    const { container } = renderListing()
    for (const tool of TOOL_REGISTRY.filter((t) => t.status === 'coming-soon')) {
      const row = container.querySelector(`[data-tool-row="${tool.id}"]`)
      expect(row, `row for ${tool.id}`).not.toBeNull()
      expect(row!.textContent).toMatch(/coming soon/i)
      expect(row!.querySelector('a')).toBeNull()
    }
  })

  it('renders inside the shared ToolFrame (back-to-hub wordmark link)', () => {
    const { container } = renderListing()
    const back = container.querySelector('a[aria-label="free·esign — back to tools"]')
    expect(back).not.toBeNull()
    expect(back!.getAttribute('href')).toBe('/')
  })
})
