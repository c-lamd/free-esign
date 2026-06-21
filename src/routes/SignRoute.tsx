import { useEffect } from 'react'
import { useDocumentStore } from '../store/documentStore'
import { ToolFrame } from '../components/ToolFrame'
import { TopBar } from '../components/TopBar'
import { LoadingSpinner } from '../components/LoadingSpinner'
import { DocumentViewer } from '../components/DocumentViewer'
import { UploadZone } from '../components/UploadZone'
import { HeroSection } from '../components/HeroSection'
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
 *   empty   → founder-voice <HeroSection> + <UploadZone> — the `/sign` landing
 *             content + drag-drop/Browse uploader
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
 *      uploader/session, never the old full-page landing. (The HeroSection CTA's
 *      startSigning() wiring still works — it's a no-op once already 'empty'.)
 *
 *  (b) The signing chrome is wrapped in <ToolFrame> (SUITE-05) so the suite has a
 *      shared back-to-hub header. The existing signing <TopBar> (Wordmark reset +
 *      OPEN/EXPORT/zoom/undo action keys) renders as the tool's own header inside
 *      the frame, preserving EVERY aria-label and handler verbatim (PAR-04 /
 *      PAR-01). ToolFrame's slim bar carries only the back-to-tools Link; the two
 *      bars read as a single stacked instrument panel, not two competing brands.
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

  // (a) Entering /sign IS the landing → empty transition. One-time on mount:
  // if the store is still in its construction-time 'landing' default, move it to
  // the signing uploader so the route never shows the old full-page landing.
  useEffect(() => {
    if (useDocumentStore.getState().view === 'landing') {
      startSigning()
    }
  }, [startSigning])

  return (
    <ToolFrame>
      {/* Signing tool header — Wordmark reset + OPEN/EXPORT/zoom/undo keys (verbatim) */}
      <TopBar />
      {/* ExportErrorBanner self-gates on exportError — mounts unconditionally */}
      <ExportErrorBanner />
      {view === 'empty' && (
        <>
          {/* Founder-voice signing hero — reachable under /sign (SUITE-04) */}
          <HeroSection />
          <UploadZone />
        </>
      )}
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
