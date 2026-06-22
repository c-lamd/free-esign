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
 * Records one successful export against same-origin '/api/increment' (POST, no
 * body — T-13-05). Returns `void` synchronously and swallows every error so it
 * can never throw or block the caller (CNT-04).
 *
 * Uses `navigator.sendBeacon` FIRST: on mobile, triggering the file download
 * backgrounds/tears down the page before a plain fire-and-forget `fetch()` can
 * flush, so the POST never leaves the device (desktop is unaffected — which is
 * why a laptop export increments the counter but a phone export did not).
 * sendBeacon queues the request in the browser and delivers it even as the page
 * unloads. Falls back to a `keepalive` fetch (same teardown-survival property)
 * when sendBeacon is unavailable or declines to queue.
 */
export function recordExport(): void {
  try {
    // Primary path — survives the mobile download/page-teardown. sendBeacon is
    // always POST (matches the /api/increment method guard) and we pass no body,
    // so nothing about the document leaves the client (T-13-05). A truthy return
    // means the user agent queued it; only fall through if it could not.
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      if (navigator.sendBeacon(INCREMENT_PATH)) return
    }
    // Fallback: keepalive lets the request outlive the page on browsers without
    // sendBeacon; the no-op catch keeps a rejected promise from ever surfacing.
    void fetch(INCREMENT_PATH, { method: 'POST', keepalive: true }).catch(() => {})
  } catch {
    // Defensive: if sendBeacon/fetch is undefined or throws synchronously in some
    // environment, never propagate to the caller — the export already succeeded.
  }
}
