/**
 * registry.test.tsx — tool registry integrity (SUITE-03).
 *
 * The registry is the single source of truth: the route table (this plan) and
 * the hub grid + tools-listing (10-02) all derive from it. These tests pin the
 * invariants every consumer relies on:
 *   - Sign, Merge, Split, and Organize are live tools at /sign, /merge, /split, /organize.
 *   - The single remaining coming-soon placeholder (Convert) exists.
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

  it('contains a live Merge tool at /merge (MRG-01)', () => {
    const merge = TOOL_REGISTRY.find((t) => t.id === 'merge')
    expect(merge).toBeDefined()
    expect(merge?.route).toBe('/merge')
    expect(merge?.status).toBe('live')
    expect(merge?.element).not.toBeNull()
  })

  it('contains a live Split tool at /split (SPL-01)', () => {
    const split = TOOL_REGISTRY.find((t) => t.id === 'split')
    expect(split).toBeDefined()
    expect(split?.route).toBe('/split')
    expect(split?.status).toBe('live')
    expect(split?.element).not.toBeNull()
  })

  it('contains a live Organize tool at /organize (ORG-01)', () => {
    const organize = TOOL_REGISTRY.find((t) => t.id === 'organize')
    expect(organize).toBeDefined()
    expect(organize?.route).toBe('/organize')
    expect(organize?.status).toBe('live')
    expect(organize?.element).not.toBeNull()
  })

  it('contains a live PDF → Image tool at /pdf-to-image (CNV-01)', () => {
    const pdf2img = TOOL_REGISTRY.find((t) => t.id === 'pdf-to-image')
    expect(pdf2img).toBeDefined()
    expect(pdf2img?.route).toBe('/pdf-to-image')
    expect(pdf2img?.status).toBe('live')
    expect(pdf2img?.element).not.toBeNull()
    expect(pdf2img?.blurb ?? '').not.toMatch(/coming soon/i)
  })

  it('has zero coming-soon placeholders — pdf-to-image resolved the last one (12-01)', () => {
    // The registry's final coming-soon ('convert') is resolved by introducing the
    // live pdf-to-image tool; image-to-pdf simply lands as the second live convert
    // tool in 12-02. So no coming-soon entries remain after this plan.
    const expected: string[] = []
    const comingSoon = TOOL_REGISTRY.filter((t) => t.status === 'coming-soon').map((t) => t.id)
    expect(comingSoon).toEqual(expected)
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
