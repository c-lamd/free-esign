import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useFieldStore } from './store/fieldStore'
import { liveTools } from './tools/registry'

/**
 * AppRoutes — the registry-driven route table (SUITE-01 / SUITE-03).
 *
 * Exported separately from <App> so tests can mount it under a <MemoryRouter>
 * with deterministic `initialEntries` (deep-link + catch-all proofs) without a
 * server. In production it renders inside <App>'s <BrowserRouter>.
 */
export function AppRoutes() {
  return (
    <Routes>
      {/* Hub + listing placeholders — replaced by the real ToolsHub / ToolsListing in 10-02. */}
      <Route path="/" element={<HubStub />} />
      <Route path="/tools" element={<ToolsListingStub />} />

      {/* Tool routes generated from the registry (SUITE-03). */}
      {liveTools().map((t) => (
        <Route key={t.id} path={t.route} element={t.element} />
      ))}

      {/* Catch-all → / (SUITE-01). */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

/**
 * App — the router shell (SUITE-01).
 *
 * Replaces the old top-level Zustand `view` switch between <LandingPage> and the
 * signing tool. Top-level navigation now lives in react-router-dom routes:
 *
 *   /        → tools-hub homepage (inline stub here; real ToolsHub in 10-02)
 *   /tools   → tools-listing      (inline stub here; real ToolsListing in 10-02)
 *   /sign    → the signing tool   (SignRoute, via the registry)
 *   *        → catch-all redirect to / (SUITE-01)
 *
 * The route table is generated from the tool registry (SUITE-03): every `live`
 * tool becomes a <Route>. Adding a tool = adding one registry entry.
 *
 * BrowserRouter gives clean URLs; the existing vercel.json SPA rewrite
 * (`/(.*) → /index.html`) makes deep links (e.g. /sign) resolve in prod with no
 * server (PAR-07). The font wrapper stays the inline -apple-system stack for now
 * (10-03 owns the --font-sans / Space Grotesk token).
 */
function App() {
  const loadSavedItems = useFieldStore((s) => s.loadSavedItems)

  // SIG-04: hydrate saved items from IndexedDB once on mount (unchanged).
  useEffect(() => {
    loadSavedItems()
  }, [loadSavedItems])

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100dvh',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </div>
  )
}

/**
 * HubStub — temporary `/` placeholder (10-02 replaces it with the real
 * instrument-panel tools-hub homepage + vestaboard hero). Kept intentionally
 * minimal so the router is complete now.
 */
function HubStub() {
  return (
    <main data-testid="hub-stub" style={{ padding: '48px 16px' }}>
      <h1>FreeESign tools</h1>
    </main>
  )
}

/**
 * ToolsListingStub — temporary `/tools` placeholder (10-02 replaces it with the
 * real tools-listing view derived from the registry).
 */
function ToolsListingStub() {
  return (
    <main data-testid="tools-listing-stub" style={{ padding: '48px 16px' }}>
      <h1>All tools</h1>
    </main>
  )
}

export default App
