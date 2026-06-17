const steps = [
  {
    number: 1,
    title: 'Open your document',
    description: 'Drop a PDF or image into the app. It stays on your device — nothing is uploaded.',
  },
  {
    number: 2,
    title: 'Place your signature',
    description:
      'Draw your signature or type it in a script font. Drag it wherever it needs to go.',
  },
  {
    number: 3,
    title: 'Download the signed file',
    description:
      'Your original document is preserved exactly. We append your signature — we never re-encode or alter what was already there.',
  },
]

export function HowItWorksSection() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      style={{
        backgroundColor: 'var(--color-surface-elevated)',
        padding: 'clamp(32px, 6vw, 48px) 16px',
      }}
    >
      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
        }}
      >
        <h2
          id="how-it-works-heading"
          style={{
            fontSize: '20px',
            fontWeight: 600,
            lineHeight: 1.2,
            color: 'var(--color-text-primary)',
            textAlign: 'center',
            marginBottom: '32px',
            margin: '0 0 32px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          }}
        >
          How it works
        </h2>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
          }}
        >
          {steps.map((step) => (
            <div
              key={step.number}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '16px',
                padding: '20px',
                backgroundColor: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: '8px',
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '50%',
                  border: '2px solid var(--color-border)',
                  backgroundColor: 'var(--color-surface-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--color-text-primary)',
                  flexShrink: 0,
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                }}
              >
                {step.number}
              </div>
              <div style={{ flex: 1 }}>
                <h3
                  style={{
                    fontSize: '20px',
                    fontWeight: 600,
                    lineHeight: 1.2,
                    color: 'var(--color-text-primary)',
                    marginBottom: '4px',
                    margin: '0 0 4px',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
                  }}
                >
                  {step.title}
                </h3>
                <p
                  style={{
                    fontSize: '16px',
                    fontWeight: 400,
                    color: 'var(--color-text-secondary)',
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
