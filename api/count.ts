/**
 * GET /api/count — returns the current global "documents processed" count
 * (CNT-01). Web-handler style: Request → Response.
 *
 * Graceful degradation (CNT-04):
 *  - No store provisioned (getRedis() → null) → 200 { count: null }.
 *  - The Redis read throws (network/credential error) → 200 { count: null },
 *    with NO error detail in the body and nothing logged that contains the
 *    token or url (no secret leak, T-13-01).
 *
 * Only an integer ever crosses the wire. The browser fetches this same-origin
 * endpoint; it never contacts Upstash directly.
 */
import { getRedis, readCount } from './_redis'

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}

export default async function handler(_req: Request): Promise<Response> {
  const redis = getRedis()
  if (redis === null) {
    // Store not provisioned — graceful "unknown" sentinel (CNT-04).
    return json({ count: null })
  }

  try {
    const count = await readCount(redis)
    return json({ count })
  } catch {
    // Swallow the error entirely — never surface an error body or log the
    // token/url/stack (CNT-04, no secret leak).
    return json({ count: null })
  }
}
