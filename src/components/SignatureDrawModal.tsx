/**
 * SignatureDrawModal — tabbed modal (Saved / Draw / Type) for creating a signature.
 *
 * Phase 4 extends the Phase 2 drawing modal into a three-tab experience:
 *   Saved  — lists saved signatures; click to arm placement; per-item delete
 *   Draw   — existing signature_pad canvas flow (unchanged)
 *   Type   — text input + 3-font picker + live preview; arms armedTypedPayload
 *
 * The modal shell (scrim, dialog dimensions, focus trap, Escape, focus restore)
 * is identical to Phase 2.
 *
 * Threat model compliance:
 *   T-02-04: Canvas capped by fixed modal max-width (560px); DoS-safe.
 *   T-02-06: pad.off() called on unmount to prevent listener leaks.
 *   T-04-08: name input maxLength={100} — prevents DoS via huge preview text.
 *   T-04-09: typedText rendered as JSX text node — never dangerouslySetInnerHTML.
 *   T-04-10: font picker is a fixed 3-option radiogroup; no free-form font path.
 *   T-04-11: addSavedItem failure is non-blocking; UI copy shown on error.
 */

import { useEffect, useRef, useState, useCallback } from 'react'
import SignaturePad from 'signature_pad'
import { useFieldStore, SavedItem } from '../store/fieldStore'
import { SavedItemCard } from './SavedItemCard'

type TabId = 'saved' | 'draw' | 'type'
type FontFamily = 'Dancing Script' | 'Great Vibes' | 'Pacifico'

const FONTS: FontFamily[] = ['Dancing Script', 'Great Vibes', 'Pacifico']

export function SignatureDrawModal() {
  const modalOpen = useFieldStore((s) => s.modalOpen)
  const closeModal = useFieldStore((s) => s.closeModal)
  const setSignatureDataUrl = useFieldStore((s) => s.setSignatureDataUrl)
  const setArmedFieldType = useFieldStore((s) => s.setArmedFieldType)
  const setArmedTypedPayload = useFieldStore((s) => s.setArmedTypedPayload)
  const addSavedItem = useFieldStore((s) => s.addSavedItem)
  const deleteSavedItem = useFieldStore((s) => s.deleteSavedItem)
  const savedItems = useFieldStore((s) => s.savedItems)

  // Signature-kind items only
  const signatureItems = savedItems.filter((i) => i.kind === 'signature')

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const padRef = useRef<SignaturePad | null>(null)
  // Reference to the element that opened the modal (for focus restore on close)
  const triggerRef = useRef<Element | null>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([null, null, null])

  const [hasStrokes, setHasStrokes] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('draw')
  const [typedText, setTypedText] = useState('')
  const [selectedFont, setSelectedFont] = useState<FontFamily>('Dancing Script')
  const [saveForReuse, setSaveForReuse] = useState(true)
  const [selectedSavedId, setSelectedSavedId] = useState<string | null>(null)
  const [saveError, setSaveError] = useState(false)

  // Capture the triggering element when modal opens so we can restore focus on close
  useEffect(() => {
    if (modalOpen) {
      triggerRef.current = document.activeElement
      // Reset state when modal opens
      setActiveTab('draw')
      setTypedText('')
      setSelectedFont('Dancing Script')
      setSaveForReuse(true)
      setSelectedSavedId(null)
      setSaveError(false)
    }
  }, [modalOpen])

  // Initialize signature_pad when modal opens (or when switching to Draw tab); destroy on close
  useEffect(() => {
    if (!modalOpen || activeTab !== 'draw') {
      // Destroy pad when not on draw tab or modal closed
      if (padRef.current) {
        padRef.current.off()
        padRef.current = null
        setHasStrokes(false)
      }
      return
    }

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
      // T-02-06: remove global event listeners to prevent stale-listener bug
      pad.off()
      padRef.current = null
      setHasStrokes(false)
    }
  }, [modalOpen, activeTab])

  // Tab keyboard navigation (Left/Right arrow keys — ARIA tab widget pattern)
  const handleTabKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      const tabOrder: TabId[] = ['saved', 'draw', 'type']
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const nextIdx = (idx + 1) % tabOrder.length
        setActiveTab(tabOrder[nextIdx])
        tabRefs.current[nextIdx]?.focus()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const prevIdx = (idx - 1 + tabOrder.length) % tabOrder.length
        setActiveTab(tabOrder[prevIdx])
        tabRefs.current[prevIdx]?.focus()
      }
    },
    [],
  )

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

        // Include ALL focusable elements including inputs and radios,
        // but exclude those inside hidden tab panels — they aren't reachable
        // (browsers silently drop .focus() on hidden subtrees, breaking wrap).
        const allFocusable = dialog.querySelectorAll<HTMLElement>(
          'button, canvas[tabindex="0"], input, [role="radio"]',
        )
        const nodes = Array.from(allFocusable).filter(
          (el) => !el.closest('[hidden]') && !el.closest('[aria-hidden="true"]'),
        )
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

  async function handleUseSignatureFromDraw() {
    if (!hasStrokes || !padRef.current) return
    const dataUrl = padRef.current.toDataURL('image/png')
    setSignatureDataUrl(dataUrl)
    setArmedFieldType('signature')

    if (saveForReuse) {
      try {
        const item: SavedItem = {
          id: crypto.randomUUID(),
          kind: 'signature',
          source: 'drawn',
          dataUrl,
          createdAt: Date.now(),
        }
        await addSavedItem(item)
      } catch {
        setSaveError(true)
        // Non-blocking — still proceed to close
      }
    }

    handleClose()
  }

  async function handleUseSignatureFromType() {
    if (!typedText) return

    const item: SavedItem = {
      id: crypto.randomUUID(),
      kind: 'signature',
      source: 'typed',
      text: typedText,
      fontFamily: selectedFont,
      createdAt: Date.now(),
    }

    if (saveForReuse) {
      try {
        await addSavedItem(item)
      } catch {
        setSaveError(true)
        // Non-blocking — still proceed
      }
    }

    setArmedTypedPayload({ text: typedText, fontFamily: selectedFont, kind: 'signature' })
    setArmedFieldType('signature')
    handleClose()
  }

  async function handleUseSignatureFromSaved() {
    if (!selectedSavedId) return
    const item = signatureItems.find((i) => i.id === selectedSavedId)
    if (!item) return

    if (item.dataUrl) {
      setSignatureDataUrl(item.dataUrl)
      setArmedFieldType('signature')
    } else if (item.text && item.fontFamily) {
      setArmedTypedPayload({ text: item.text, fontFamily: item.fontFamily, kind: 'signature' })
      setArmedFieldType('signature')
    }

    handleClose()
  }

  function handleDiscard() {
    handleClose()
  }

  function handleClose() {
    closeModal()
    // Restore focus to the triggering element
    if (triggerRef.current && 'focus' in triggerRef.current) {
      ;(triggerRef.current as HTMLElement).focus()
    }
    triggerRef.current = null
  }

  // Render nothing when modal is closed
  if (!modalOpen) return null

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
    // 3:1 aspect ratio via padding-top trick
    paddingTop: '33.33%',
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
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
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

  const saveForReuseRowStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
    minHeight: '44px',
  }

  const tabBarStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'row',
    borderBottom: '1px solid var(--color-border)',
    marginBottom: '16px',
  }

  const tabOrder: TabId[] = ['saved', 'draw', 'type']
  const tabLabels: Record<TabId, string> = { saved: 'Saved', draw: 'Draw', type: 'Type' }

  function getTabStyle(tab: TabId): React.CSSProperties {
    const isActive = activeTab === tab
    return {
      background: 'none',
      border: 'none',
      borderBottom: isActive ? '2px solid var(--color-accent)' : '2px solid transparent',
      color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
      fontSize: '14px',
      fontWeight: 400,
      padding: '8px 16px',
      minHeight: '44px',
      cursor: 'pointer',
      fontFamily: 'inherit',
      outline: 'none',
    }
  }

  function getAccentButtonStyle(enabled: boolean): React.CSSProperties {
    return {
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
      cursor: enabled ? 'pointer' : 'default',
      opacity: enabled ? 1 : 0.45,
      outline: 'none',
    }
  }

  // ── Save for reuse row (shared between Draw and Type panels) ──────────────

  const saveForReuseRow = (
    <div style={saveForReuseRowStyle}>
      <input
        id="sig-save-for-reuse"
        type="checkbox"
        checked={saveForReuse}
        onChange={(e) => setSaveForReuse(e.target.checked)}
      />
      <label
        htmlFor="sig-save-for-reuse"
        style={{
          fontSize: '14px',
          fontWeight: 400,
          color: 'var(--color-text-primary)',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        Save for reuse
      </label>
    </div>
  )

  // ── Panels ────────────────────────────────────────────────────────────────

  // Draw panel
  const drawPanel = (
    <div
      role="tabpanel"
      id="sig-panel-draw"
      aria-labelledby="sig-tab-draw"
      hidden={activeTab !== 'draw'}
    >
      {/* Canvas area */}
      <div style={canvasContainerStyle}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Signature drawing canvas"
          tabIndex={0}
          style={canvasStyle}
        />
        {/* "Sign here" hint — visible only when canvas is empty */}
        {!hasStrokes && <div style={hintStyle}>Sign here</div>}
      </div>

      {saveForReuseRow}

      {/* Controls */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '16px',
          marginTop: '12px',
        }}
      >
        {/* Left: Clear canvas */}
        <button
          type="button"
          onClick={handleClear}
          style={ghostButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)'
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

        {/* Right: Discard + Use signature */}
        <div style={{ display: 'flex', flexDirection: 'row', gap: '8px', alignItems: 'center' }}>
          <button
            type="button"
            onClick={handleDiscard}
            style={ghostButtonStyle}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--color-text-primary)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--color-text-secondary)'
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
            onClick={handleUseSignatureFromDraw}
            aria-disabled={!hasStrokes ? 'true' : undefined}
            aria-label={
              !hasStrokes
                ? 'Use signature — draw a signature first'
                : 'Use signature'
            }
            style={getAccentButtonStyle(hasStrokes)}
            onMouseEnter={(e) => {
              if (hasStrokes) {
                e.currentTarget.style.backgroundColor = '#1D4ED8'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--color-accent)'
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
            Use signature
          </button>
        </div>
      </div>
    </div>
  )

  // Type panel
  const typePanel = (
    <div
      role="tabpanel"
      id="sig-panel-type"
      aria-labelledby="sig-tab-type"
      hidden={activeTab !== 'type'}
    >
      {/* Name input */}
      <input
        type="text"
        aria-label="Your name for signature"
        placeholder="Your name"
        maxLength={100}
        value={typedText}
        onChange={(e) => setTypedText(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 12px',
          fontSize: '16px',
          fontWeight: 400,
          fontFamily: 'inherit',
          color: 'var(--color-text-primary)',
          background: 'var(--color-surface-elevated)',
          border: '1px solid var(--color-border)',
          borderRadius: '6px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-accent)'
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'var(--color-border)'
        }}
      />

      {/* Font picker */}
      <div
        role="radiogroup"
        aria-label="Choose script font"
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: '8px',
          flexWrap: 'wrap',
          marginTop: '12px',
        }}
      >
        {FONTS.map((font) => {
          const isActive = selectedFont === font
          return (
            <div
              key={font}
              role="radio"
              aria-checked={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => setSelectedFont(font)}
              onKeyDown={(e) => {
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault()
                  setSelectedFont(font)
                }
              }}
              style={{
                flex: 1,
                minWidth: 0,
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer',
                minHeight: '44px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                background: 'var(--color-surface-elevated)',
                border: isActive ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'rgba(0,0,0,0.3)'
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.borderColor = 'var(--color-border)'
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-accent)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
                e.currentTarget.style.outlineOffset = '0'
              }}
            >
              {/* Font name in script font */}
              <span style={{ fontFamily: font, fontSize: '20px', color: 'var(--color-text-primary)' }}>
                {font}
              </span>
              {/* System-ui label below */}
              <span style={{ fontSize: '14px', color: 'var(--color-text-secondary)', fontFamily: 'inherit' }}>
                {font}
              </span>
            </div>
          )
        })}
      </div>

      {/* Live preview */}
      <div
        aria-label="Signature preview"
        aria-live="polite"
        style={{
          marginTop: '12px',
          padding: '12px 16px',
          background: 'var(--color-surface)',
          borderRadius: '6px',
          minHeight: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            fontFamily: selectedFont,
            fontSize: 'clamp(24px, 8vw, 56px)',
            color: typedText ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
            opacity: typedText ? 1 : 0.6,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            maxWidth: '100%',
          }}
        >
          {typedText || 'Your name'}
        </span>
      </div>

      {saveForReuseRow}

      {/* Save error message (non-blocking, per UI-SPEC) */}
      {saveError && (
        <div
          role="alert"
          style={{ fontSize: '14px', color: 'var(--color-text-secondary)', marginTop: '8px' }}
        >
          Couldn't save this for reuse, but it's ready to place now.
        </div>
      )}

      {/* Controls */}
      <div style={controlsRowStyle}>
        <button
          type="button"
          onClick={handleDiscard}
          style={ghostButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)'
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
          onClick={handleUseSignatureFromType}
          aria-disabled={!typedText ? 'true' : undefined}
          aria-label={
            !typedText
              ? 'Use signature — type your name first'
              : 'Use signature'
          }
          style={getAccentButtonStyle(!!typedText)}
          onMouseEnter={(e) => {
            if (typedText) {
              e.currentTarget.style.backgroundColor = '#1D4ED8'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-accent)'
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
          Use signature
        </button>
      </div>
    </div>
  )

  // Saved panel
  const savedPanel = (
    <div
      role="tabpanel"
      id="sig-panel-saved"
      aria-labelledby="sig-tab-saved"
      hidden={activeTab !== 'saved'}
    >
      {signatureItems.length === 0 ? (
        // Empty state
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '120px',
            textAlign: 'center',
            gap: '8px',
          }}
        >
          <div
            style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-text-primary)' }}
          >
            No saved signatures yet
          </div>
          <div style={{ fontSize: '16px', color: 'var(--color-text-secondary)' }}>
            Create a signature in the Draw or Type tab, check 'Save for reuse', and it will
            appear here.
          </div>
        </div>
      ) : (
        // Saved items grid
        <div
          role="radiogroup"
          aria-label="Saved signatures"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))',
            gap: '8px',
          }}
        >
          {signatureItems.map((item) => (
            <SavedItemCard
              key={item.id}
              item={item}
              isSelected={selectedSavedId === item.id}
              onSelect={setSelectedSavedId}
              onDelete={deleteSavedItem}
              deleteAriaLabel="Delete saved signature"
            />
          ))}
        </div>
      )}

      {/* Controls */}
      <div style={{ ...controlsRowStyle, marginTop: '16px' }}>
        <button
          type="button"
          onClick={handleDiscard}
          style={ghostButtonStyle}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--color-text-primary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--color-text-secondary)'
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
          onClick={handleUseSignatureFromSaved}
          aria-disabled={!selectedSavedId ? 'true' : undefined}
          aria-label={
            !selectedSavedId
              ? 'Use signature — select a saved signature first'
              : 'Use signature'
          }
          style={getAccentButtonStyle(!!selectedSavedId)}
          onMouseEnter={(e) => {
            if (selectedSavedId) {
              e.currentTarget.style.backgroundColor = '#1D4ED8'
            }
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-accent)'
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
          Use signature
        </button>
      </div>
    </div>
  )

  return (
    <div style={scrimStyle} aria-hidden="false">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        style={dialogStyle}
        onKeyDown={handleKeyDown}
        tabIndex={-1}
      >
        <h2 id="modal-title" style={titleStyle}>
          Create signature
        </h2>

        {/* Tab bar */}
        <div role="tablist" aria-label="Signature creation methods" style={tabBarStyle}>
          {tabOrder.map((tab, idx) => (
            <button
              key={tab}
              ref={(el) => { tabRefs.current[idx] = el }}
              role="tab"
              id={`sig-tab-${tab}`}
              aria-controls={`sig-panel-${tab}`}
              aria-selected={activeTab === tab}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => setActiveTab(tab)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
              style={getTabStyle(tab)}
              onMouseEnter={(e) => {
                if (activeTab !== tab) {
                  e.currentTarget.style.color = 'var(--color-text-primary)'
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab) {
                  e.currentTarget.style.color = 'var(--color-text-secondary)'
                }
              }}
              onFocus={(e) => {
                e.currentTarget.style.outline = '2px solid var(--color-accent)'
                e.currentTarget.style.outlineOffset = '2px'
              }}
              onBlur={(e) => {
                e.currentTarget.style.outline = 'none'
                e.currentTarget.style.outlineOffset = '0'
              }}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Panels */}
        {drawPanel}
        {typePanel}
        {savedPanel}
      </div>
    </div>
  )
}
