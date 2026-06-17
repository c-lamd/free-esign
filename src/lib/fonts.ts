/**
 * fonts.ts
 *
 * Font byte loader for typed signature/initials PDF export.
 *
 * Provides a same-origin `fetch`-based loader with a static 3-key allowlist
 * (`FONT_FILE_MAP`) that guards against path traversal (T-04-04 / PRV-02).
 *
 * Security:
 *   T-04-04: `FONT_FILE_MAP` is a static allowlist. Unknown font families throw
 *            BEFORE `fetch` is called — no arbitrary URL construction, no path traversal.
 *   PRV-02: All fetches are same-origin (`/fonts/...`). Zero third-party requests.
 *
 * Architecture:
 *   - Module-level `fontBytesCache` (NOT React state) avoids re-renders and ensures
 *     repeated exports of the same font family skip the network after the first fetch.
 *   - `fetch('/fonts/...')` works identically in Vite dev (serves `public/` at root)
 *     and production (Vercel serves `public/` at root). No URL hashing.
 */

/**
 * Static allowlist mapping font family names to their public/ paths.
 * Exactly 3 keys — any family name not in this map is rejected before fetch.
 */
const FONT_FILE_MAP: Record<string, string> = {
  'Dancing Script': '/fonts/DancingScript-Regular.ttf',
  'Great Vibes':    '/fonts/GreatVibes-Regular.ttf',
  'Pacifico':       '/fonts/Pacifico-Regular.ttf',
}

/**
 * Module-level byte cache. Populated lazily on first export that uses a given font.
 * NOT React state — avoids re-renders on cache population.
 */
const fontBytesCache = new Map<string, Uint8Array>()

/**
 * Load the TTF bytes for the given font family, with caching.
 *
 * Security: unknown `fontFamily` values throw BEFORE any `fetch()` is called.
 * This prevents path traversal attacks — the fetch URL is always a static
 * allowlisted path, never constructed from user input.
 *
 * @param fontFamily - Font family name (must be a key in FONT_FILE_MAP).
 * @returns Uint8Array of the TTF file bytes.
 * @throws If `fontFamily` is not in the allowlist (security guard, pre-fetch).
 * @throws If the fetch fails (network error, missing file).
 */
export async function loadFontBytes(fontFamily: string): Promise<Uint8Array> {
  // Cache hit — skip network
  if (fontBytesCache.has(fontFamily)) return fontBytesCache.get(fontFamily)!

  // Security gate: throw BEFORE fetch on unknown family (T-04-04 / PRV-02 allowlist)
  const path = FONT_FILE_MAP[fontFamily]
  if (!path) throw new Error(`Unknown font family: "${fontFamily}"`)

  // Same-origin fetch only — path is always from the static allowlist above
  const buffer = await fetch(path).then((r) => r.arrayBuffer())
  const bytes = new Uint8Array(buffer)
  fontBytesCache.set(fontFamily, bytes)
  return bytes
}

/**
 * Exposed for testing — allows clearing the module-level cache between tests
 * so fetch mocks are not bypassed by cached bytes from prior test runs.
 *
 * @internal — do not call from production code.
 */
export function _clearFontBytesCache(): void {
  fontBytesCache.clear()
}
