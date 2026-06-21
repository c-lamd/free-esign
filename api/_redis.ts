/**
 * Server-only Upstash Redis client factory for the global "documents processed"
 * counter (CNT-01). This module — and the @upstash/redis dependency it imports —
 * MUST be imported ONLY from api/*.ts. It must NEVER be imported anywhere under
 * src/, or the store token would ship to the browser bundle (T-13-04). Plan
 * 13-03 adds a bundle-exclusion test asserting no src/** import of @upstash/redis.
 *
 * The counter stores ONLY a single integer at COUNT_KEY. No document bytes,
 * filenames, identity, or IP ever touch this store (CNT-01, privacy-first).
 *
 * Graceful degradation (CNT-04): when no credentials are present (local dev, or
 * before the user provisions Upstash in Phase 14), getRedis() returns null and
 * the handlers respond with the { count: null } sentinel — never crashing,
 * never leaking secrets.
 */
import { Redis } from '@upstash/redis'

/**
 * The single Redis key backing the global counter. Stores ONLY an integer.
 */
export const COUNT_KEY = 'freesign:documents_processed'

/**
 * Construct an Upstash Redis client from env, supporting BOTH naming schemes:
 *   - Direct Upstash names:        UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *   - Vercel-Marketplace-injected: KV_REST_API_URL        / KV_REST_API_TOKEN
 *
 * We construct explicitly via `new Redis({ url, token })` rather than relying on
 * `Redis.fromEnv()` (which only reads the UPSTASH_ names) so both name pairs are
 * handled uniformly.
 *
 * Returns null when either the url or token is missing/empty after both lookups.
 * A null return is the CNT-04 graceful-degradation signal — callers MUST treat
 * it as "store not provisioned" and respond with the { count: null } sentinel.
 */
export function getRedis(): Redis | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? ''
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? ''

  if (!url || !token) {
    return null
  }

  return new Redis({ url, token })
}

/**
 * Read the current count from the store, coercing a missing/never-incremented
 * key to 0 (a never-incremented store reads as 0, not null). @upstash/redis may
 * return the integer as a number or a numeric string depending on
 * serialization, so we coerce with Number(...) and guard NaN → 0.
 */
export async function readCount(redis: Redis): Promise<number> {
  const raw = await redis.get<number | string | null>(COUNT_KEY)
  if (raw === null || raw === undefined) {
    return 0
  }
  const n = Number(raw)
  return Number.isNaN(n) ? 0 : n
}
