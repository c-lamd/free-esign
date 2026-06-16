import { useDocumentStore } from './store/documentStore'
import { TopBar } from './components/TopBar'
import { LoadingSpinner } from './components/LoadingSpinner'
import { DocumentViewer } from './components/DocumentViewer'

function EmptyState() {
  const loadDocument = useDocumentStore((s) => s.loadDocument)
  const setError = useDocumentStore((s) => s.setError)
  const setView = useDocumentStore((s) => s.setView)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    // Validate file type
    const accepted = ['application/pdf', 'image/jpeg', 'image/jpg', 'image/png']
    if (!accepted.includes(file.type)) {
      setError('Only PDF, JPG, and PNG files are supported. Try another file.')
      return
    }

    // Validate file size (100 MB limit)
    if (file.size > 100 * 1024 * 1024) {
      setError(
        'This file is too large to open in the browser. Try a smaller file.',
      )
      return
    }

    setView('loading')
    const blobUrl = URL.createObjectURL(file)
    loadDocument(blobUrl)
  }

  return (
    <div
      style={{
        minHeight: 'calc(100dvh - 56px)',
        backgroundColor: 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          padding: '0 16px',
        }}
      >
        {/* Upload icon */}
        <svg
          width="48"
          height="48"
          viewBox="0 0 48 48"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{
            display: 'inline-block',
            marginBottom: '16px',
            color: 'var(--color-text-secondary)',
          }}
          aria-hidden="true"
        >
          <path
            d="M24 8L24 32M24 8L16 16M24 8L32 16"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 36V40H40V36"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>

        <h1
          style={{
            fontSize: '20px',
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'var(--color-text-primary)',
            margin: '0 0 8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          Drop your document here
        </h1>

        <p
          style={{
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            margin: '0 0 12px',
          }}
        >
          or
        </p>

        <label
          style={{
            display: 'inline-block',
            backgroundColor: 'var(--color-accent)',
            color: '#FFFFFF',
            fontSize: '14px',
            fontWeight: 400,
            padding: '10px 16px',
            borderRadius: '6px',
            cursor: 'pointer',
            minHeight: '44px',
            lineHeight: '24px',
          }}
        >
          Browse files
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0 }}
            onChange={handleFileChange}
            aria-label="Browse files"
          />
        </label>

        <p
          style={{
            fontSize: '16px',
            fontWeight: 400,
            color: 'var(--color-text-secondary)',
            marginTop: '24px',
          }}
        >
          Your files never leave your browser.
        </p>
      </div>
    </div>
  )
}

function ErrorState() {
  const errorMessage = useDocumentStore((s) => s.errorMessage)
  const reset = useDocumentStore((s) => s.reset)

  return (
    <div
      role="alert"
      style={{
        minHeight: 'calc(100dvh - 56px)',
        backgroundColor: 'var(--color-surface)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        style={{
          backgroundColor: 'var(--color-surface-elevated)',
          borderLeft: '4px solid var(--color-destructive)',
          borderRadius: '6px',
          padding: '16px',
          maxWidth: '480px',
          width: '100%',
        }}
      >
        <h2
          style={{
            fontSize: '20px',
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'var(--color-text-primary)',
            margin: '0 0 8px',
          }}
        >
          Could not open file
        </h2>
        <p
          style={{
            fontSize: '16px',
            color: 'var(--color-text-primary)',
            margin: '0 0 12px',
          }}
        >
          {errorMessage ??
            'This file could not be read. It may be corrupt or password-protected. Try another file.'}
        </p>
        <button
          onClick={reset}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            color: 'var(--color-accent)',
            textDecoration: 'underline',
            padding: 0,
          }}
        >
          Try another file
        </button>
      </div>
    </div>
  )
}

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
      {view === 'empty' && <EmptyState />}
      {view === 'loading' && <LoadingSpinner />}
      {view === 'error' && <ErrorState />}
      {view === 'loaded' && <DocumentViewer />}
    </div>
  )
}

export default App
