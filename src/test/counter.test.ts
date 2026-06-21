/**
 * counter.test.ts — src/lib/counter.ts client counter API (Phase 13, CNT-02/CNT-04).
 *
 * The browser only ever touches same-origin RELATIVE '/api' paths — never Upstash,
 * never an absolute host. These tests pin that contract plus the graceful-degradation
 * guarantee:
 *   - fetchCount() GETs '/api/count' and resolves number | null, never throwing.
 *   - recordExport() fire-and-forget POSTs '/api/increment', swallows ALL errors,
 *     never throws and never blocks the caller (a download must complete even if
 *     /api is down — CNT-04).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { fetchCount, recordExport } from '../lib/counter'

let fetchSpy: ReturnType<typeof vi.fn>

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// ── fetchCount ──────────────────────────────────────────────────────────────────

describe('fetchCount', () => {
  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  it('resolves the number on a 200 with { count: N }', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ count: 5 }) })
    await expect(fetchCount()).resolves.toBe(5)
  })

  it('resolves null on the { count: null } sentinel (graceful degradation)', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ count: null }) })
    await expect(fetchCount()).resolves.toBeNull()
  })

  it('resolves null on a non-ok response', async () => {
    fetchSpy.mockResolvedValue({ ok: false, json: async () => ({}) })
    await expect(fetchCount()).resolves.toBeNull()
  })

  it('resolves null when fetch rejects (network error) — never throws', async () => {
    fetchSpy.mockRejectedValue(new Error('network down'))
    await expect(fetchCount()).resolves.toBeNull()
  })

  it('resolves null when the JSON is malformed', async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      json: async () => {
        throw new Error('not JSON')
      },
    })
    await expect(fetchCount()).resolves.toBeNull()
  })

  it('resolves null when count is not a number', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ count: 'lots' }) })
    await expect(fetchCount()).resolves.toBeNull()
  })

  it('GETs the exact same-origin relative path "/api/count" (no host)', async () => {
    fetchSpy.mockResolvedValue({ ok: true, json: async () => ({ count: 1 }) })
    await fetchCount()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/count')
  })
})

// ── recordExport ────────────────────────────────────────────────────────────────

describe('recordExport', () => {
  beforeEach(() => {
    fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
  })

  it('POSTs the exact relative path "/api/increment" with method POST', () => {
    fetchSpy.mockResolvedValue({ ok: true })
    recordExport()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy.mock.calls[0][0]).toBe('/api/increment')
    expect(fetchSpy.mock.calls[0][1]).toMatchObject({ method: 'POST' })
  })

  it('returns undefined synchronously (does not await the promise)', () => {
    fetchSpy.mockResolvedValue({ ok: true })
    expect(recordExport()).toBeUndefined()
  })

  it('never throws when fetch rejects, and produces no unhandled rejection (CNT-04)', async () => {
    fetchSpy.mockRejectedValue(new Error('api down'))
    const onUnhandled = vi.fn()
    process.on('unhandledRejection', onUnhandled)
    expect(() => recordExport()).not.toThrow()
    // Flush microtasks so any swallowed rejection settles.
    await Promise.resolve()
    await Promise.resolve()
    process.off('unhandledRejection', onUnhandled)
    expect(onUnhandled).not.toHaveBeenCalled()
  })

  it('never throws even if fetch itself is undefined in the environment', () => {
    vi.stubGlobal('fetch', undefined as unknown as typeof fetch)
    expect(() => recordExport()).not.toThrow()
  })

  it('sends NO request body (T-13-05 — no filename/bytes/identity leaves the client)', () => {
    fetchSpy.mockResolvedValue({ ok: true })
    recordExport()
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(init.body).toBeUndefined()
  })
})
