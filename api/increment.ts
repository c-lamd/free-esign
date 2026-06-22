/**
 * POST /api/increment — performs an atomic Redis INCR on the global
 * "documents processed" counter and returns the new value (CNT-01). Vercel Node
 * serverless function: (req, res) signature — the canonical form Vercel's Node
 * runtime invokes (the earlier Web `Request -> Response` handler 500'd in prod).
 *
 * The handler reads NO request body — it performs a fixed INCR on a fixed key
 * regardless of payload, so a malicious body cannot redirect the write
 * (T-13-03). INCR is the single source of count truth (atomic server-side, no
 * read-modify-write race). One POST = exactly one INCR (no retry loop).
 *
 * Graceful degradation (CNT-04):
 *  - No store provisioned (getRedis() -> null) -> 200 { count: null }.
 *  - INCR throws (network/credential error) -> 200 { count: null }, with NO
 *    error detail in the body and nothing logged that contains the token or url
 *    (no secret leak, T-13-01).
 */
import { getRedis, COUNT_KEY } from './_redis.js'

// Minimal Vercel Node response shape — avoids a @vercel/node dependency.
interface VercelRes {
  status(code: number): VercelRes
  json(body: unknown): void
}

export default async function handler(req: { method?: string }, res: VercelRes): Promise<void> {
  // Reject non-POST verbs: a drive-by GET (no preflight, trivially scriptable in
  // a loop) must not trigger a write — that is the counter-inflation / Upstash
  // quota-burn vector. A missing method only occurs in synthetic unit calls
  // (real HTTP always carries one), so undefined is treated as allowed to keep
  // the handler unit-testable.
  if (req.method && req.method !== 'POST') {
    res.status(405).json({ count: null })
    return
  }

  const redis = await getRedis()
  if (redis === null) {
    // Store not provisioned — graceful "unknown" sentinel (CNT-04).
    res.status(200).json({ count: null })
    return
  }

  try {
    // Atomic server-side increment; returns the post-increment value.
    // @upstash/redis may serialize the result as a number or numeric string —
    // coerce with Number(...) and guard NaN -> null sentinel.
    const raw = await redis.incr(COUNT_KEY)
    const n = Number(raw)
    res.status(200).json({ count: Number.isNaN(n) ? null : n })
  } catch {
    // Swallow the error entirely — never surface an error body or log the
    // token/url/stack (CNT-04, no secret leak).
    res.status(200).json({ count: null })
  }
}
