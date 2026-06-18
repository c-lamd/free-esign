/**
 * uploadZoneVisual.test.tsx — D-LND-06
 *
 * Visual-frame label assertions for UploadZone's "insert document" empty state.
 * Guards: primary label, browse trigger, status line, privacy line, and file-input
 * accept list (regression guard that the picker contract survived the reskin).
 *
 * Scope: empty-state JSX only. The load path (handleFile, validateFile,
 * drag-drop, file-picker wiring) is owned by uploadFlow.test.tsx — this file
 * must NOT re-assert or duplicate those assertions.
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { UploadZone } from '../components/UploadZone'
import { useDocumentStore } from '../store/documentStore'
import { act } from '@testing-library/react'

afterEach(() => {
  cleanup()
  act(() => {
    useDocumentStore.setState({
      view: 'empty',
      docUrl: null,
      numPages: null,
      errorMessage: null,
      fileName: null,
      originalPdfBytes: null,
      exportError: null,
    })
  })
})

describe('UploadZone empty-state visual frame (D-LND-06)', () => {
  it('renders the primary mono label "▼ INSERT DOCUMENT"', () => {
    render(React.createElement(UploadZone))
    expect(screen.getByText('▼ INSERT DOCUMENT')).toBeDefined()
  })

  it('renders a browse trigger with aria-label "Browse files to open" and visible text containing "BROWSE FILES"', () => {
    render(React.createElement(UploadZone))
    const browseKey = screen.getByRole('button', { name: 'Browse files to open' })
    expect(browseKey).toBeDefined()
    expect(browseKey.textContent).toContain('BROWSE FILES')
  })

  it('renders the status line with FILE — none segment', () => {
    render(React.createElement(UploadZone))
    // Status line text may be split across DOM nodes; use getAllByText with a
    // function matcher to handle middot separators and whitespace splits.
    const container = document.body
    const normalizedText = container.textContent ?? ''
    expect(normalizedText).toContain('FILE — none')
  })

  it('renders the status line with ENGINE — client-side segment', () => {
    render(React.createElement(UploadZone))
    const normalizedText = document.body.textContent ?? ''
    expect(normalizedText).toContain('ENGINE — client-side')
  })

  it('renders the status line with NET — 0 requests segment', () => {
    render(React.createElement(UploadZone))
    const normalizedText = document.body.textContent ?? ''
    expect(normalizedText).toContain('NET — 0 requests')
  })

  it('renders the privacy line verbatim', () => {
    render(React.createElement(UploadZone))
    expect(screen.getByText('Your files never leave your browser.')).toBeDefined()
  })

  it('hidden file input retains accept=".pdf,.jpg,.jpeg,.png" (picker contract regression guard)', () => {
    render(React.createElement(UploadZone))
    const input = document.querySelector('input[type="file"]') as HTMLInputElement | null
    expect(input).not.toBeNull()
    expect(input?.accept).toBe('.pdf,.jpg,.jpeg,.png')
  })
})
