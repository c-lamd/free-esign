import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useFieldStore } from './store/fieldStore'
import { liveTools } from './tools/registry'
import { ToolsHub } from './components/ToolsHub'
import { ToolsListing } from './components/ToolsListing'

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
      {/* Tools-hub homepage + tools-listing — both registry-driven (10-02). */}
      <Route path="/" element={<ToolsHub />} />
      <Route path="/tools" element={<ToolsListing />} />

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
 *   /        → tools-hub homepage (ToolsHub, 10-02)
 *   /tools   → tools-listing      (ToolsListing, 10-02)
 *   /sign    → the signing tool   (SignRoute, via the registry)
 *   *        → catch-all redirect to / (SUITE-01)
 *
 * The route table is generated from the tool registry (SUITE-03): every `live`
 * tool becomes a <Route>. Adding a tool = adding one registry entry.
 *
 * BrowserRouter gives clean URLs; the existing vercel.json SPA rewrite
 * (`/(.*) → /index.html`) makes deep links (e.g. /sign) resolve in prod with no
 * server (PAR-07). The body font wrapper uses var(--font-sans), which 10-03
 * points at self-hosted Space Grotesk (TYPE-01).
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
        fontFamily: 'var(--font-sans)',
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

export default App
