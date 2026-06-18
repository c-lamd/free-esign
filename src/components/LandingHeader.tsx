import { useDocumentStore } from '../store/documentStore'
import { Wordmark } from './Wordmark'
import { HardwareKey } from './ui/HardwareKey'

export function LandingHeader() {
  const startSigning = useDocumentStore((s) => s.startSigning)

  return (
    <header
      style={{
        height: '56px',
        backgroundColor: 'var(--color-surface-elevated)',
        borderBottom: '1px solid var(--color-border)',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '0 16px',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>
          <Wordmark />
        </span>

        {/* Secondary CTA — resting key (no armed prop); HardwareKey manages own press/focus */}
        <HardwareKey
          onClick={startSigning}
          aria-label="Sign a document — opens the document uploader"
        >
          SIGN ▶
        </HardwareKey>
      </div>
    </header>
  )
}
