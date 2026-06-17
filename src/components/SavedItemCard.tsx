/**
 * SavedItemCard — compact thumbnail card for a saved signature or initials item.
 *
 * Used in the Saved panel of SignatureDrawModal / InitialsDrawModal.
 *
 * Security:
 *   T-04-09: item.text rendered as a React text node (JSX interpolation) — never
 *            dangerouslySetInnerHTML. XSS-safe on screen.
 */

import { SavedItem } from '../store/fieldStore'

interface SavedItemCardProps {
  item: SavedItem
  isSelected: boolean
  onSelect: (id: string) => void
  onDelete: (id: string) => void
  /** aria-label for the delete button — e.g. "Delete saved signature" */
  deleteAriaLabel: string
}

export function SavedItemCard({
  item,
  isSelected,
  onSelect,
  onDelete,
  deleteAriaLabel,
}: SavedItemCardProps) {
  function handleDeleteClick(e: React.MouseEvent) {
    e.stopPropagation() // prevent card activation on delete (UI-SPEC)
    onDelete(item.id)
  }

  const cardStyle: React.CSSProperties = {
    position: 'relative',
    borderRadius: '8px',
    padding: '8px',
    cursor: 'pointer',
    minHeight: '80px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    background: 'var(--color-surface)',
    border: isSelected ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
    outline: 'none',
    boxSizing: 'border-box',
  }

  const thumbnailContainerStyle: React.CSSProperties = {
    width: '100%',
    flexShrink: 0,
  }

  const captionStyle: React.CSSProperties = {
    fontSize: '14px',
    color: 'var(--color-text-secondary)',
    lineHeight: 1.4,
  }

  const deleteButtonStyle: React.CSSProperties = {
    position: 'absolute',
    top: '4px',
    right: '4px',
    width: '20px',
    height: '20px',
    backgroundColor: 'var(--color-destructive)',
    color: 'white',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    fontWeight: 600,
    padding: '6px',
    boxSizing: 'content-box',
    outline: 'none',
  }

  return (
    <div
      role="radio"
      aria-checked={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => onSelect(item.id)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault() // prevent Space from scrolling the page
          onSelect(item.id)
        }
      }}
      style={cardStyle}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'rgba(0,0,0,0.3)'
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
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
      {/* Thumbnail area */}
      <div style={thumbnailContainerStyle}>
        {item.dataUrl ? (
          // Drawn item — image thumbnail
          <img
            src={item.dataUrl}
            alt="Saved signature"
            style={{ width: '100%', height: '56px', objectFit: 'contain', display: 'block' }}
          />
        ) : item.text && item.fontFamily ? (
          // Typed item — text in script font (T-04-09: text node, not dangerouslySetInnerHTML)
          <div
            style={{
              fontFamily: item.fontFamily,
              fontSize: '20px',
              color: 'var(--color-text-primary)',
              textAlign: 'center',
              height: '56px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}
          >
            {item.text}
          </div>
        ) : null}
      </div>

      {/* Caption */}
      <div style={captionStyle}>{item.source === 'drawn' ? 'Drawn' : 'Typed'}</div>

      {/* Delete button */}
      <button
        type="button"
        aria-label={deleteAriaLabel}
        onClick={handleDeleteClick}
        style={deleteButtonStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#B91C1C'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'var(--color-destructive)'
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
        ×
        <span className="sr-only">{deleteAriaLabel}</span>
      </button>
    </div>
  )
}
