/**
 * registry.test.tsx — tool registry integrity (SUITE-03).
 *
 * The registry is the single source of truth: the route table (this plan) and
 * the hub grid + tools-listing (10-02) all derive from it. These tests pin the
 * invariants every consumer relies on:
 *   - Sign is a live tool at /sign.
 *   - The four coming-soon placeholders (Merge/Split/Organize/Convert) exist.
 *   - liveTools() returns only live entries, each with a non-null element and a
 *     unique route (so the generated <Route> table is well-formed).
 */
import { describe, it, expect, vi } from 'vitest'

// The registry's Sign element (<SignRoute/>) transitively imports react-pdf's
// pdfWorker, which touches DOMMatrix at import time — absent in jsdom. Mock it
// exactly as the signing-flow tests do so the registry module imports cleanly.
vi.mock('react-pdf', () => ({
  Document: () => null,
  Page: () => null,
  pdfjs: { GlobalWorkerOptions: { workerSrc: '' }, version: '0' },
}))
vi.mock('../lib/pdfWorker', () => ({
  default: undefined,
  pdfOptions: { cMapUrl: '/cmaps/', cMapPacked: true, standardFontDataUrl: '/standard_fonts/' },
}))

import { TOOL_REGISTRY, liveTools } from '../tools/registry'

describe('SUITE-03: tool registry is the single source of truth', () => {
  it('contains a live Sign tool at /sign', () => {
    const sign = TOOL_REGISTRY.find((t) => t.id === 'sign')
    expect(sign).toBeDefined()
    expect(sign?.route).toBe('/sign')
    expect(sign?.status).toBe('live')
    expect(sign?.element).not.toBeNull()
  })

  it('registers the four coming-soon placeholders', () => {
    const expected = ['merge', 'split', 'organize', 'convert']
    for (const id of expected) {
      const tool = TOOL_REGISTRY.find((t) => t.id === id)
      expect(tool, `registry must contain a "${id}" entry`).toBeDefined()
      expect(tool?.status).toBe('coming-soon')
    }
  })

  it('every coming-soon entry has a null element (mounts no route)', () => {
    for (const tool of TOOL_REGISTRY.filter((t) => t.status === 'coming-soon')) {
      expect(tool.element, `coming-soon "${tool.id}" must have a null element`).toBeNull()
    }
  })

  it('liveTools() returns only live entries', () => {
    const live = liveTools()
    expect(live.length).toBeGreaterThan(0)
    expect(live.every((t) => t.status === 'live')).toBe(true)
  })

  it('every live entry has a non-null element', () => {
    for (const tool of liveTools()) {
      expect(tool.element, `live "${tool.id}" must have a non-null element`).not.toBeNull()
    }
  })

  it('every live entry has a unique route (route table is well-formed)', () => {
    const routes = liveTools().map((t) => t.route)
    expect(new Set(routes).size).toBe(routes.length)
  })

  it('all registry ids are unique', () => {
    const ids = TOOL_REGISTRY.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
