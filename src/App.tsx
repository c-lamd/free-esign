import { useDocumentStore } from './store/documentStore'
import { TopBar } from './components/TopBar'
import { LoadingSpinner } from './components/LoadingSpinner'
import { DocumentViewer } from './components/DocumentViewer'
import { UploadZone } from './components/UploadZone'
import { ErrorBanner } from './components/ErrorBanner'
import { ExportErrorBanner } from './components/ExportErrorBanner'
import { SignatureDrawModal } from './components/SignatureDrawModal'

/**
 * App — view-router wired to the Zustand state machine.
 *
 * State machine: view ∈ { empty | loading | error | loaded }
 *
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
 * ExportErrorBanner mounts unconditionally — self-gates on exportError being set.
 * It renders as a sticky banner below the TopBar when an export failure occurs (T-02-02).
 */
function App() {
  const view = useDocumentStore((s) => s.view)

  return (
    <div
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        minHeight: '100dvh',
        backgroundColor: 'var(--color-surface)',
      }}
    >
      <TopBar />
      {/* ExportErrorBanner self-gates on exportError — mounts unconditionally */}
      <ExportErrorBanner />
      {view === 'empty' && <UploadZone />}
      {view === 'loading' && <LoadingSpinner />}
      {view === 'error' && <ErrorBanner />}
      {view === 'loaded' && <DocumentViewer />}
      {/* SignatureDrawModal mounts unconditionally — self-gates on modalOpen */}
      <SignatureDrawModal />
    </div>
  )
}

export default App
