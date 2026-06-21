/**
 * GET /api/ping — zero-dependency diagnostic endpoint.
 *
 * No imports, no app code, no dependencies. If THIS returns 500
 * FUNCTION_INVOCATION_FAILED, the fault is in the serverless-function
 * infrastructure itself (build/runtime/ESM), not in any application code or
 * dependency. If this works while /api/count fails, the fault is the counter's
 * dependency chain (@upstash/redis bundling). Diagnostic for the prod 500.
 */
interface VercelRes {
  status(code: number): VercelRes
  json(body: unknown): void
}

export default function handler(_req: unknown, res: VercelRes): void {
  res.status(200).json({ ok: true })
}
