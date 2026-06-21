/**
 * counter.ts — client half of the live "documents processed" counter (Phase 13).
 *
 * The browser ONLY ever touches same-origin RELATIVE '/api' paths:
 *   - fetchCount()   GET  '/api/count'      → number | null
 *   - recordExport() POST '/api/increment'  → fire-and-forget (no body, no await)
 *
 * It NEVER contacts Upstash directly and NEVER constructs an absolute URL — the
 * Redis REST call happens server-side inside the serverless function. So zero
 * third-party request and zero document data ever leave the device (PAR-06,
 * T-13-05, T-13-08). This file MUST NOT import @upstash/redis.
 *
 * Graceful degradation (CNT-04): both functions are total. fetchCount resolves
 * null on ANY error so the vestaboard falls back to its neutral placeholder, and
 * recordExport swallows ALL errors so a download always completes even when /api
 * is unreachable — it never throws and never blocks the caller.
 */

/** Same-origin relative paths — no protocol, no host. */
const COUNT_PATH = '/api/count'
const INCREMENT_PATH = '/api/increment'

/**
 * GETs the live global count from same-origin '/api/count'.
 *
 * @returns the count when the endpoint returns `{ count: <number> }`; otherwise
 *   `null` (the `{ count: null }` sentinel, a non-ok response, malformed JSON, a
 *   non-numeric count, or a thrown/rejected fetch). NEVER throws.
 */
export async function fetchCount(): Promise<number | null> {
  try {
    const res = await fetch(COUNT_PATH)
    if (!res.ok) return null
    const data = (await res.json()) as { count?: unknown }
    return typeof data.count === 'number' ? data.count : null
  } catch {
    return null
  }
}

/**
 * Fire-and-forget POST to same-origin '/api/increment' recording one successful
 * export. Sends NO body (T-13-05). Returns `void` synchronously — it does NOT
 * await the request — and swallows every error so it can never throw or block the
 * caller (CNT-04). A download must complete even if /api is down.
 */
export function recordExport(): void {
  try {
    // Do NOT await; attach a no-op catch so a rejected promise never surfaces as
    // an unhandled rejection. Bare POST — no body, no headers, no payload.
    void fetch(INCREMENT_PATH, { method: 'POST' }).catch(() => {})
  } catch {
    // Defensive: if fetch is undefined/throws synchronously in some env, never
    // propagate to the caller — the export already succeeded.
  }
}
