import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDocumentStore } from '../store/documentStore'
import { ToolFrame } from '../components/ToolFrame'
import { TopBar } from '../components/TopBar'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { DocumentViewer } from '../components/DocumentViewer'
import { UploadZone } from '../components/UploadZone'
import { ErrorBanner } from '../components/ErrorBanner'
import { ExportErrorBanner } from '../components/ExportErrorBanner'
import { SignatureDrawModal } from '../components/SignatureDrawModal'
import { InitialsDrawModal } from '../components/InitialsDrawModal'

/**
 * SignRoute — the signing tool, mounted at `/sign`.
 *
 * This is the verbatim relocation of the former non-landing branch of App.tsx
 * (SUITE-04 / PAR-04). The Zustand `view` state machine and ALL signing
 * components are unchanged:
 *
 *   empty   → <UploadZone> — drag-drop/Browse uploader (the founder-voice hero
 *             now lives on the hub homepage, not the sign tool)
 *   loading → <LoadingSpinner> — async image-wrap gap before docUrl exists
 *   error   → <ErrorBanner>   — friendly inline error + retry
 *   loaded  → <DocumentViewer> — react-pdf canvas; TopBar shows OPEN/EXPORT keys
 *
 * Two route-world reconciliations, no behavior change:
 *
 *  (a) Entering `/sign` IS the old landing → empty transition. Previously the
 *      LandingPage CTAs called startSigning() to move `view` from 'landing' to
 *      'empty'. Now a one-time mount effect does it: if view === 'landing',
 *      call startSigning() so the route always lands on the signing
 *      uploader/session, never the old full-page landing.
 *
 *  (b) The signing tool supplies its OWN full header (<TopBar>: Wordmark +
 *      OPEN/EXPORT/zoom/undo keys), so it mounts <ToolFrame chrome={false}> — the
 *      frame's wrapper/<main> WITHOUT its back-to-hub bar. Rendering both stacked
 *      two sticky headers at top:0, and the controls bar hid behind the frame bar
 *      on scroll/zoom. The brand routes home via TopBar's onHome (reset +
 *      navigate('/')); EVERY signing aria-label/handler stays verbatim (PAR-04 /
 *      PAR-01).
 *
 * ExportErrorBanner / SignatureDrawModal / InitialsDrawModal mount unconditionally
 * and self-gate on their store flags (verbatim from old App.tsx).
 *
 * coordinateMapper.ts and exportPdf.ts are NOT touched by this relocation —
 * EXP-02 byte-identity is preserved (PAR-04).
 */
export function SignRoute() {
  const view = useDocumentStore((s) => s.view)
  const startSigning = useDocumentStore((s) => s.startSigning)
  const reset = useDocumentStore((s) => s.reset)
  const navigate = useNavigate()

  // (a) Entering /sign IS the landing → empty transition. One-time on mount:
  // if the store is still in its construction-time 'landing' default, move it to
  // the signing uploader so the route never shows the old full-page landing.
  useEffect(() => {
    if (useDocumentStore.getState().view === 'landing') {
      startSigning()
    }
  }, [startSigning])

  return (
    // chrome={false}: the signing tool renders its own full <TopBar> header, so
    // ToolFrame must NOT also render its back-to-hub bar (two stacked sticky bars
    // fought for top:0 and the controls bar hid on scroll/zoom).
    <ToolFrame chrome={false}>
      {/* Signing tool header — Wordmark + OPEN/EXPORT/zoom/undo keys (verbatim).
          onHome routes the brand to the tools hub (and clears the session) now
          that ToolFrame's back link is no longer rendered. */}
      <TopBar
        onHome={() => {
          reset()
          navigate('/')
        }}
      />
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
    </ToolFrame>
  )
}
