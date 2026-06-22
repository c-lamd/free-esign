/**
 * GET /api/count — returns the current global "documents processed" count
 * (CNT-01). Vercel Node serverless function: (req, res) signature — the
 * canonical form Vercel's Node runtime invokes. (An earlier Web-standard
 * `Request -> Response` handler returned 500 FUNCTION_INVOCATION_FAILED in
 * production because the Node runtime calls handlers as (req, res); the unit
 * tests passed only because they mocked everything and never exercised Vercel's
 * invocation contract.)
 *
 * Graceful degradation (CNT-04):
 *  - No store provisioned (getRedis() -> null) -> 200 { count: null }.
 *  - The Redis read throws (network/credential error) -> 200 { count: null },
 *    with NO error detail in the body and nothing logged that contains the
 *    token or url (no secret leak, T-13-01).
 *
 * Only an integer ever crosses the wire. The browser fetches this same-origin
 * endpoint; it never contacts Upstash directly.
 */
import { getRedis, readCount } from './_redis.js'

// Minimal Vercel Node response shape — avoids a @vercel/node dependency. The
// real runtime object is an enhanced ServerResponse exposing status()/json().
interface VercelRes {
  status(code: number): VercelRes
  json(body: unknown): void
}

export default async function handler(req: { method?: string }, res: VercelRes): Promise<void> {
  // Read-only endpoint: only GET is meaningful. Reject other verbs for hygiene
  // (undefined method = synthetic unit call, treated as allowed).
  if (req.method && req.method !== 'GET') {
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
    const count = await readCount(redis)
    res.status(200).json({ count })
  } catch {
    // Swallow the error entirely — never surface an error body or log the
    // token/url/stack (CNT-04, no secret leak).
    res.status(200).json({ count: null })
  }
}
