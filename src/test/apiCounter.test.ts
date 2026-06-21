/**
 * apiCounter.test.ts — unit tests for the serverless counter handlers
 * (api/count.ts + api/increment.ts), CNT-01 + CNT-04.
 *
 * The handlers are pure Web-handler functions (Request → Response), so we test
 * them in isolation with a mocked api/_redis module — no live Upstash store.
 *
 * Coverage:
 *  - count success: store configured → 200 { count: 7 }
 *  - increment success: store configured → atomic INCR → 200 { count: 8 },
 *    INCR called exactly once with COUNT_KEY
 *  - missing-env (CNT-04): getRedis() → null → both handlers 200 { count: null }, no throw
 *  - error path (CNT-04 no-leak): Redis call rejects with a token-bearing error →
 *    handler still resolves 200 { count: null } and the response body NEVER
 *    contains the token substring
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// The shared client factory the handlers depend on. Mock it so no live store is
// needed. Vitest hoists vi.mock, so this intercepts the import in count/increment.
vi.mock('../../api/_redis', () => ({
  COUNT_KEY: 'freesign:documents_processed',
  getRedis: vi.fn(),
  readCount: vi.fn(),
}))

import { COUNT_KEY, getRedis, readCount } from '../../api/_redis'
import countHandler from '../../api/count'
import incrementHandler from '../../api/increment'

const mockedGetRedis = vi.mocked(getRedis)
const mockedReadCount = vi.mocked(readCount)

const FAKE_TOKEN = 'SECRET_TOKEN_abc123_should_never_leak'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('GET /api/count (CNT-01)', () => {
  it('returns 200 { count: N } when the store is configured', async () => {
    // Fake client; count.ts reads via readCount, which we stub directly.
    mockedGetRedis.mockReturnValue({} as never)
    mockedReadCount.mockResolvedValue(7)

    const res = await countHandler(new Request('http://localhost/api/count'))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    expect(await res.json()).toEqual({ count: 7 })
  })

  it('returns 200 { count: null } when no env vars are present (CNT-04)', async () => {
    mockedGetRedis.mockReturnValue(null)

    const res = await countHandler(new Request('http://localhost/api/count'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ count: null })
  })

  it('returns 200 { count: null } with NO token leak when the Redis read throws (CNT-04)', async () => {
    mockedGetRedis.mockReturnValue({} as never)
    mockedReadCount.mockRejectedValue(new Error(`connect failed with ${FAKE_TOKEN}`))

    const res = await countHandler(new Request('http://localhost/api/count'))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain(FAKE_TOKEN)
    expect(JSON.parse(text)).toEqual({ count: null })
  })
})

describe('POST /api/increment (CNT-01)', () => {
  it('performs an atomic INCR once on COUNT_KEY and returns 200 { count: N+1 }', async () => {
    const incr = vi.fn().mockResolvedValue(8)
    mockedGetRedis.mockReturnValue({ incr } as never)

    const res = await incrementHandler(
      new Request('http://localhost/api/increment', { method: 'POST' }),
    )
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toContain('application/json')
    expect(await res.json()).toEqual({ count: 8 })
    expect(incr).toHaveBeenCalledTimes(1)
    expect(incr).toHaveBeenCalledWith(COUNT_KEY)
  })

  it('coerces a numeric-string INCR result to a number', async () => {
    const incr = vi.fn().mockResolvedValue('8')
    mockedGetRedis.mockReturnValue({ incr } as never)

    const res = await incrementHandler(
      new Request('http://localhost/api/increment', { method: 'POST' }),
    )
    expect(await res.json()).toEqual({ count: 8 })
  })

  it('returns 200 { count: null } when no env vars are present (CNT-04)', async () => {
    mockedGetRedis.mockReturnValue(null)

    const res = await incrementHandler(
      new Request('http://localhost/api/increment', { method: 'POST' }),
    )
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ count: null })
  })

  it('returns 200 { count: null } with NO token leak when INCR throws (CNT-04)', async () => {
    const incr = vi.fn().mockRejectedValue(new Error(`unauthorized ${FAKE_TOKEN}`))
    mockedGetRedis.mockReturnValue({ incr } as never)

    const res = await incrementHandler(
      new Request('http://localhost/api/increment', { method: 'POST' }),
    )
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain(FAKE_TOKEN)
    expect(JSON.parse(text)).toEqual({ count: null })
  })
})
