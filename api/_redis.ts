/**
 * Server-only Upstash Redis client factory for the global "documents processed"
 * counter (CNT-01). The @upstash/redis dependency is imported LAZILY (dynamic
 * import) only when credentials are present — so the graceful no-store path
 * (the state in production until the user provisions Upstash) NEVER depends on
 * the package resolving inside Vercel's bundled serverless function. This module
 * MUST be imported ONLY from api/*.ts, never from src/ (the bundle-exclusion
 * test in privacyGuard asserts this), or the store token would ship to the
 * browser.
 *
 * The counter stores ONLY a single integer at COUNT_KEY. No document bytes,
 * filenames, identity, or IP ever touch this store (CNT-01, privacy-first).
 *
 * Graceful degradation (CNT-04): when no credentials are present, getRedis()
 * resolves to null and the handlers respond with the { count: null } sentinel —
 * never crashing, never leaking secrets.
 */

/** The single Redis key backing the global counter. Stores ONLY an integer. */
export const COUNT_KEY = 'freesign:documents_processed'

/** Minimal shape of the @upstash/redis client the handlers use. */
export interface RedisLike {
  get<T = unknown>(key: string): Promise<T>
  incr(key: string): Promise<number>
}

/**
 * Read credentials from env, supporting BOTH naming schemes:
 *   - Direct Upstash:              UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 *   - Vercel-Marketplace-injected: KV_REST_API_URL        / KV_REST_API_TOKEN
 * Returns null when either is missing/empty.
 */
function readCreds(): { url: string; token: string } | null {
  const url =
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL ?? ''
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN ?? ''
  if (!url || !token) return null
  return { url, token }
}

/**
 * Construct an Upstash Redis client, importing @upstash/redis LAZILY so the
 * package is only loaded when credentials exist. Resolves to null (the CNT-04
 * graceful-degradation signal) when the store is not provisioned.
 */
export async function getRedis(): Promise<RedisLike | null> {
  const creds = readCreds()
  if (!creds) return null
  const { Redis } = await import('@upstash/redis')
  return new Redis(creds) as unknown as RedisLike
}

/**
 * Read the current count, coercing a missing/never-incremented key to 0.
 * @upstash/redis may return the integer as a number or numeric string.
 */
export async function readCount(redis: RedisLike): Promise<number> {
  const raw = await redis.get<number | string | null>(COUNT_KEY)
  if (raw === null || raw === undefined) return 0
  const n = Number(raw)
  return Number.isNaN(n) ? 0 : n
}
