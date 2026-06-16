export function LoadingSpinner() {
  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: 'calc(100dvh - 56px)' }}
      role="status"
      aria-label="Loading document"
    >
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        style={{ animation: 'spin 1s linear infinite' }}
      >
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="var(--color-accent)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="56"
          strokeDashoffset="20"
        />
      </svg>
      <span className="sr-only">Loading document…</span>
    </div>
  )
}
