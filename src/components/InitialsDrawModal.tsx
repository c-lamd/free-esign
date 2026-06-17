/**
 * InitialsDrawModal — centered, focus-trapped modal for drawing initials.
 *
 * Mirrors SignatureDrawModal exactly, with these differences:
 *   - Gated on initialsModalOpen (not modalOpen)
 *   - Title: "Draw your initials"
 *   - Canvas hint: "Draw here"
 *   - Primary CTA: "Add initials"
 *   - Canvas aspect ratio 2:1 (padding-top: 50%) vs signature's 3:1
 *   - On confirm: setInitialsDataUrl(dataUrl) then setArmedFieldType('initials')
 *
 * The user draws with mouse/touch on a signature_pad canvas. On confirm:
 *   - Stores transparent-background PNG data URL in useFieldStore (initialsDataUrl)
 *   - Arms initials placement mode (setArmedFieldType('initials'))
 *   - Closes the modal
 *
 * "Discard" and Escape close the modal without saving.
 *
 * Threat model compliance:
 *   T-03-12: Canvas capped by fixed modal max-width (560px); DoS-safe.
 *            pad.off() called on unmount to prevent listener leaks.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import SignaturePad from 'signature_pad'
import { useFieldStore } from '../store/fieldStore'

export function InitialsDrawModal() {
  const initialsModalOpen = useFieldStore((s) => s.initialsModalOpen)
  const closeInitialsModal = useFieldStore((s) => s.closeInitialsModal)
  const setInitialsDataUrl = useFieldStore((s) => s.setInitialsDataUrl)
  const setArmedFieldType = useFieldStore((s) => s.setArmedFieldType)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  // Reference to the element that opened the modal (for focus restore on close)
  const triggerRef = useRef<Element | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)

  const [hasStrokes, setHasStrokes] = useState(false)

  // Capture the triggering element when modal opens so we can restore focus on close
  useEffect(() => {
    if (initialsModalOpen) {
      triggerRef.current = document.activeElement
    }
  }, [initialsModalOpen])

  // Initialize signature_pad when modal opens; destroy on close
  useEffect(() => {
    if (!initialsModalOpen) return

    const canvas = canvasRef.current
    if (!canvas) return

    // High-DPI canvas scaling — MUST be done before creating SignaturePad (Pitfall 3)
    const ratio = Math.max(window.devicePixelRatio || 1, 1)
    canvas.width = canvas.offsetWidth * ratio
    canvas.height = canvas.offsetHeight * ratio
    const ctx = canvas.getContext('2d')
    ctx?.scale(ratio, ratio)

    // Transparent background so exported PNG has no white box (PRV clean overlay)
    padRef.current = new SignaturePad(canvas, {
      penColor: 'rgb(0, 0, 0)',
      backgroundColor: 'rgba(0,0,0,0)',
    })

    const pad = padRef.current

    // Drive hasStrokes state via signature_pad events
    const onUpdate = () => setHasStrokes(!pad.isEmpty())
    pad.addEventListener('beginStroke', onUpdate)
    pad.addEventListener('endStroke', onUpdate)

    // Move focus to the canvas after mount (UI-SPEC focus management)
    canvas.focus()

    return () => {
      pad.removeEventListener('beginStroke', onUpdate)
      pad.removeEventListener('endStroke', onUpdate)
      // T-03-12: remove global event listeners to prevent stale-listener bug
      pad.off()
      padRef.current = null
      setHasStrokes(false)
    }
  }, [initialsModalOpen])

  // Focus trap: intercept Tab to cycle only among modal controls
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        handleDiscard()
        return
      }

      if (e.key === 'Tab') {
        const dialog = dialogRef.current
        if (!dialog) return

        // Include ALL buttons plus canvas (aria-disabled buttons must still be focusable per UI-SPEC)
        const allFocusable = dialog.querySelectorAll<HTMLElement>(
          'button, canvas[tabindex="0"]',
        )
        const nodes = Array.from(allFocusable)
        if (nodes.length === 0) return

        const first = nodes[0]
        const last = nodes[nodes.length - 1]
        const current = document.activeElement

        if (e.shiftKey) {
          if (current === first) {
            e.preventDefault()
            last.focus()
          }
        } else {
          if (current === last) {
            e.preventDefault()
            first.focus()
          }
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [hasStrokes],
  )

  function handleClear() {
    padRef.current?.clear()
    setHasStrokes(false)
  }

  function handleAddInitials() {
    if (!hasStrokes || !padRef.current) return
    const dataUrl = padRef.current.toDataURL('image/png')
    setInitialsDataUrl(dataUrl)
    setArmedFieldType('initials')
    handleClose()
  }

  function handleDiscard() {
    handleClose()
  }

  function handleClose() {
    closeInitialsModal()
    // Restore focus to the triggering element
    if (triggerRef.current && 'focus' in triggerRef.current) {
      ;(triggerRef.current as HTMLElement).focus()
    }
    triggerRef.current = null
  }

  // Render nothing when modal is closed
  if (!initialsModalOpen) return null

  // ── Styles ────────────────────────────────────────────────────────────────

  const scrimStyle: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.45)',
    zIndex: 50,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }

  const dialogStyle: React.CSSProperties = {
    background: 'var(--color-surface-elevated)',
    borderRadius: '12px',
    padding: '24px',
    width: 'calc(100vw - 32px)',
    maxWidth: '560px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
    outline: 'none',
  }

  const titleStyle: React.CSSProperties = {
    fontSize: '20px',
    fontWeight: 600,
    lineHeight: 1.2,
    color: 'var(--color-text-primary)',
    margin: '0 0 16px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  }

  const canvasContainerStyle: React.CSSProperties = {
    position: 'relative',
    width: '100%',
    // 2:1 aspect ratio via padding-top trick (initials are wider than tall, suits "JD" style)
    paddingTop: '50%',
    border: '1px solid var(--color-border)',
    borderRadius: '6px',
    background: '#FFFFFF',
    overflow: 'hidden',
  }

  const canvasStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    touchAction: 'none',
    display: 'block',
  }

  const hintStyle: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '16px',
    fontWeight: 400,
    color: 'var(--color-text-secondary)',
    pointerEvents: 'none',
    userSelect: 'none',
  }

  const controlsRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginTop: '16px',
  }

  const rightGroupStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    gap: '8px',
    alignItems: 'center',
  }

  const ghostButtonStyle: React.CSSProperties = {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 400,
    color: 'var(--color-text-secondary)',
    padding: '8px',
    minHeight: '44px',
    minWidth: '44px',
    borderRadius: '4px',
    fontFamily: 'inherit',
    outline: 'none',
  }

  const accentButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--color-accent)',
    color: '#FFFFFF',
    fontSize: '14px',
    fontWeight: 400,
    padding: '8px 16px',
    borderRadius: '6px',
    border: 'none',
    fontFamily: 'inherit',
    minHeight: '44px',
    minWidth: '44px',
    cursor: hasStrokes ? 'pointer' : 'default',
    opacity: hasStrokes ? 1 : 0.45,
  }

  return (
    <div style={scrimStyle} aria-hidden="false">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="initials-modal-title"
        style={dialogStyle}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <h2 id="initials-modal-title" style={titleStyle}>
          Draw your initials
        </h2>

        {/* Canvas area — 2:1 ratio for initials */}
        <div style={canvasContainerStyle}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label="Initials drawing canvas"
            tabIndex={0}
            style={canvasStyle}
          />
          {/* "Draw here" hint — visible only when canvas is empty */}
          {!hasStrokes && <div style={hintStyle}>Draw here</div>}
        </div>

        {/* Controls */}
        <div style={controlsRowStyle}>
          {/* Left: Clear canvas */}
          <button
            type="button"
            onClick={handleClear}
            style={ghostButtonStyle}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-text-primary)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.color =
                'var(--color-text-secondary)'
            }}
            onFocus={(e) => {
              e.currentTarget.style.outline = '2px solid var(--color-accent)'
              e.currentTarget.style.outlineOffset = '2px'
            }}
            onBlur={(e) => {
              e.currentTarget.style.outline = 'none'
            }}
          >
            Clear canvas
          </button>

          {/* Right: Discard + Add initials */}
          <div style={rightGroupStyle}>
            <button
              type="button"
              onClick={handleDiscard}
              style={ghostButtonStyle}
              onMouseEnter={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color =
                  'var(--color-text-primary)'
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.color =
                  'var(--color-text-secondary)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-accent)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
              }}
            >
              Discard
            </button>

            <button
              type="button"
              onClick={handleAddInitials}
              aria-disabled={!hasStrokes ? 'true' : undefined}
              aria-label={
                !hasStrokes
                  ? 'Add initials — draw initials first'
                  : 'Add initials'
              }
              style={accentButtonStyle}
              onMouseEnter={(e) => {
                if (hasStrokes) {
                  ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                    '#1D4ED8'
                }
              }}
              onMouseLeave={(e) => {
                ;(e.currentTarget as HTMLButtonElement).style.backgroundColor =
                  'var(--color-accent)'
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-accent)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
                e.currentTarget.style.backgroundColor = 'var(--color-accent)'
              }}
            >
              Add initials
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
