import { useDocumentStore } from '../store/documentStore'
import { Wordmark } from './Wordmark'
import { HardwareKey } from './ui/HardwareKey'

export function HeroSection() {
  const startSigning = useDocumentStore((s) => s.startSigning)

  return (
    <section
      aria-labelledby="hero-heading"
      style={{
        backgroundColor: 'var(--color-surface)',
        padding: 'clamp(48px, 8vw, 64px) 16px',
      }}
    >
      {/* Two-column layout: copy left/top, device right/bottom */}
      <div
        style={{
          maxWidth: '960px',
          margin: '0 auto',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '48px',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* ── Copy column ── */}
        <div
          style={{
            flex: '1 1 320px',
            maxWidth: '560px',
          }}
        >
          {/* Decorative brand display — aria-hidden, not in accessible tree */}
          <span
            aria-hidden="true"
            style={{
              display: 'block',
              marginBottom: '8px',
              userSelect: 'none',
            }}
          >
            <Wordmark />
          </span>

          <h1
            id="hero-heading"
            style={{
              fontSize: '36px',
              fontWeight: 600,
              lineHeight: 1.15,
              color: 'var(--color-text-primary)',
              margin: '0 0 24px',
              fontFamily: 'var(--font-sans)',
            }}
          >
            I built this because I couldn&apos;t find a PDF signer that was actually free.
          </h1>

          <p
            style={{
              fontSize: '16px',
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
              margin: '0 0 24px',
            }}
          >
            Every one I tried had a catch: sign up for an account, pay to download your own
            document, or quietly upload your files to a server I&apos;ve never heard of.
          </p>

          <p
            style={{
              fontSize: '16px',
              fontWeight: 400,
              color: 'var(--color-text-secondary)',
              lineHeight: 1.5,
              margin: '0 0 32px',
            }}
          >
            FreeESign does one thing: you drop a PDF, place your signature, and download it
            back — untouched. No server ever sees your document. No account. No paywall. Just
            sign your thing and move on.
          </p>

          {/* Hero CTA — HardwareKey at hero scale, armed = accent filled */}
          <HardwareKey
            armed
            onClick={() => {
              // Keep view === 'empty' (heroSection.test asserts this), then
              // smooth-scroll down to the uploader. The typeof guard keeps the
              // bare-render jsdom test (no #sign-upload in the DOM) from throwing.
              startSigning()
              const el = document.getElementById('sign-upload')
              if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }
            }}
            aria-label="Start signing — opens the document uploader"
            style={{ fontSize: '14px', padding: '10px 20px', minHeight: '44px', minWidth: '160px' }}
          >
            ▶ START SIGNING
          </HardwareKey>

          {/* Mono fineprint */}
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '11px',
              fontWeight: 400,
              color: 'var(--color-ink-faint)',
              letterSpacing: '0.1em',
              marginTop: '12px',
              marginBottom: 0,
            }}
          >
            FREE · NO ACCOUNT · NO UPLOADS
          </p>
        </div>

        {/* ── L3 Device illustration (aria-hidden decorative CSS art) ── */}
        <div aria-hidden="true" data-testid="l3-device" style={{ flexShrink: 0, pointerEvents: 'none' }}>
          <L3Device />
        </div>
      </div>
    </section>
  )
}

// ── L3 Full-Unit Device Illustration ─────────────────────────────────────────
// Pure CSS — no external assets, no images, no fetch. aria-hidden throughout.

function L3Device() {
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, #f1ece1, #e6e0d3)',
        border: '1px solid var(--color-line-strong)',
        borderRadius: '24px',
        boxShadow: 'inset 0 1px 0 #fff, 0 30px 60px -34px rgba(40,32,20,.55)',
        width: 'clamp(240px, 30vw, 300px)',
        padding: '20px',
        boxSizing: 'border-box',
      }}
    >
      {/* Hand-strap — top bar protruding above chassis */}
      <div
        style={{
          position: 'absolute',
          top: '-10px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '40px',
          height: '20px',
          background: 'var(--color-line-strong)',
          borderRadius: '2px',
        }}
      />

      {/* Corner screws × 4 */}
      <Screw position={{ top: '10px', left: '10px' }} />
      <Screw position={{ top: '10px', right: '10px' }} />
      <Screw position={{ bottom: '10px', left: '10px' }} />
      <Screw position={{ bottom: '10px', right: '10px' }} />

      {/* Inset screen */}
      <div
        style={{
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-line-strong)',
          borderRadius: '5px',
          boxShadow: 'inset 0 2px 6px rgba(0,0,0,0.3)',
          height: 'clamp(120px, 18vw, 160px)',
          width: '100%',
          boxSizing: 'border-box',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          overflow: 'hidden',
        }}
      >
        {/* Static document illustration — grey text rows + signature accent */}
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            style={{
              height: '6px',
              borderRadius: '2px',
              background: i === 4 ? 'var(--color-accent)' : 'var(--color-border)',
              width: i === 2 ? '70%' : i === 4 ? '50%' : '100%',
              opacity: i === 4 ? 0.85 : 0.5,
            }}
          />
        ))}
      </div>

      {/* Deck — LCD + knob + keypad */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '8px',
          marginBottom: '8px',
        }}
      >
        {/* LCD facsimile */}
        <div
          style={{
            flex: '2 1 0',
            background: 'var(--color-lcd-bg)',
            borderRadius: '5px',
            padding: '6px 10px',
            boxShadow: 'inset 0 2px 6px rgba(0,0,0,.65), inset 0 0 0 1px #000',
          }}
        >
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              color: 'var(--color-accent)',
              letterSpacing: '0.12em',
              textShadow: '0 0 7px color-mix(in srgb, var(--color-accent) 65%, transparent)',
              lineHeight: 1.6,
            }}
          >
            ● SIGNED
          </div>
          <div
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '8px',
              color: 'var(--color-accent)',
              letterSpacing: '0.12em',
              textShadow: '0 0 7px color-mix(in srgb, var(--color-accent) 65%, transparent)',
              lineHeight: 1.6,
            }}
          >
            ENGINE: LOCAL
          </div>
        </div>

        {/* Knob facsimile */}
        <div
          style={{
            flex: '0 0 24px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            background: 'radial-gradient(circle at 38% 34%, #ddd5c4, #9a917e)',
            border: '1px solid var(--color-line-strong)',
            flexShrink: 0,
          }}
        />

        {/* Keypad facsimile 3×2 */}
        <div
          style={{
            flex: '2 1 0',
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 10px)',
            gridTemplateRows: 'repeat(2, 10px)',
            gap: '3px',
            justifyContent: 'end',
          }}
        >
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              style={{
                width: '10px',
                height: '10px',
                borderRadius: '3px',
                background: 'var(--color-key)',
                border: '1px solid var(--color-line-strong)',
              }}
            />
          ))}
        </div>
      </div>

      {/* Model badge */}
      <div
        style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: '9px',
          color: 'var(--color-ink-faint)',
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          marginTop: '4px',
        }}
      >
        {'free'}
        <span style={{ color: 'var(--color-accent)' }}>·</span>
        {'esign — model ES·1 · rev.A'}
      </div>

      {/* Rubber feet × 2 */}
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          left: '16px',
          width: '8px',
          height: '6px',
          borderRadius: '3px',
          background: '#8A8078',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: '8px',
          right: '16px',
          width: '8px',
          height: '6px',
          borderRadius: '3px',
          background: '#8A8078',
        }}
      />
    </div>
  )
}

// Corner screw sub-component
function Screw({ position }: { position: React.CSSProperties }) {
  return (
    <div
      style={{
        position: 'absolute',
        width: '13px',
        height: '13px',
        borderRadius: '50%',
        background:
          'radial-gradient(circle at 38% 34%, #fff, #ddd5c4 45%, #b3aa98 78%, #9a917e)',
        ...position,
      }}
    >
      {/* Cross-head slot lines via pseudo-element simulation with nested divs */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          margin: 'auto',
          width: '8px',
          height: '1.6px',
          background: 'rgba(60,52,40,0.5)',
          transform: 'rotate(42deg)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          margin: 'auto',
          width: '8px',
          height: '1.6px',
          background: 'rgba(60,52,40,0.5)',
          transform: 'rotate(-48deg)',
        }}
      />
    </div>
  )
}
