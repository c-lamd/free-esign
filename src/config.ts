/**
 * Buy Me a Coffee support link.
 * Real handle set for launch (2026-06-18). This is a plain navigation <a> href —
 * no BMC script or widget is loaded, preserving the zero-third-party-request
 * guarantee (PRV-03). The apex (buymeacoffee.com/clamd24e) and www host both
 * resolve to the same page; www is used so the landingPage.test.tsx href
 * assertion stays exact.
 */
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/clamd24e'

/**
 * Canonical production origin (no trailing slash). Used to build absolute
 * canonical + Open Graph URLs in <Seo> (src/components/Seo.tsx). www is the
 * canonical host, matching the deployed domain. A bare string constant with no
 * asset-loading wrapper — so, like BUY_ME_A_COFFEE_URL above, it does NOT trip
 * the PRV-03 privacy guard (no <link href>/<script src>/url()/fetch() match).
 */
export const SITE_URL = 'https://www.free-esign.com'
