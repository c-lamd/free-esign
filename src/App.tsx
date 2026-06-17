import { useEffect } from 'react'
import { useDocumentStore } from './store/documentStore'
import { useFieldStore } from './store/fieldStore'
import { LandingPage } from './components/LandingPage'
import { TopBar } from './components/TopBar'
import { LoadingSpinner } from './components/LoadingSpinner'
import { DocumentViewer } from './components/DocumentViewer'
import { UploadZone } from './components/UploadZone'
import { ErrorBanner } from './components/ErrorBanner'
import { ExportErrorBanner } from './components/ExportErrorBanner'
import { SignatureDrawModal } from './components/SignatureDrawModal'
import { InitialsDrawModal } from './components/InitialsDrawModal'

/**
 * App — view-router wired to the Zustand state machine.
 *
 * State machine: view ∈ { landing | empty | loading | error | loaded }
 *
 * landing → <LandingPage>   — initial view; candid hero + how-it-works + privacy + footer
 * empty   → <UploadZone>    — drag-drop + Browse; validates + loads document
 * loading → <LoadingSpinner> — while pdf.js is parsing the document
 * error   → <ErrorBanner>   — friendly inline error + "Try another file" retry
 * loaded  → <DocumentViewer> — react-pdf canvas; TopBar shows "Open another"
 *
 * The TopBar "Open another" control (visible only in loaded state) is handled
 * inside TopBar.tsx — it revokes the Blob URL and calls reset().
 *
 * onLoadError: DocumentViewer handles load errors internally via the store's
 * setError action (T-01-08), so a corrupt PDF that passes type/size validation
 * still lands in the friendly ErrorBanner state rather than a blank canvas.
 *
 * ExportErrorBanner mounts unconditionally (inside the tool gate) — self-gates
 * on exportError being set. It renders as a sticky banner below the TopBar when
 * an export failure occurs (T-02-02).
 *
 * Both modals are tool-only and mount only when view !== 'landing' (Pitfall 7).
 */
function App() {
  const view = useDocumentStore((s) => s.view)
  const loadSavedItems = useFieldStore((s) => s.loadSavedItems)

  // SIG-04: hydrate saved items from IndexedDB once on mount
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
      {view === 'landing' && <LandingPage />}
      {view !== 'landing' && (
        <>
          <TopBar />
          {/* ExportErrorBanner self-gates on exportError — mounts unconditionally */}
          <ExportErrorBanner />
          {view === 'empty' && <UploadZone />}
          {view === 'loading' && <LoadingSpinner />}
          {view === 'error' && <ErrorBanner />}
          {view === 'loaded' && <DocumentViewer />}
          {/* SignatureDrawModal mounts unconditionally — self-gates on modalOpen */}
          <SignatureDrawModal />
          {/* InitialsDrawModal mounts unconditionally — self-gates on initialsModalOpen */}
          <InitialsDrawModal />
        </>
      )}
    </div>
  )
}

export default App
