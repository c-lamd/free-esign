/**
 * heroSection.test.tsx — HeroSection structure + copy + CTA preservation guards (08-01)
 *
 * Asserts:
 *  - Founder-voice h1 copy preserved verbatim
 *  - Both body paragraphs present verbatim
 *  - Hero CTA button has the correct aria-label and contains "START SIGNING"
 *  - Clicking the CTA transitions view to 'empty'
 *  - Mono fineprint "FREE · NO ACCOUNT · NO UPLOADS" is present
 *  - Device illustration container is aria-hidden (data-testid="l3-device")
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'
import { useDocumentStore } from '../store/documentStore'

describe('HeroSection', () => {
  beforeEach(() => {
    cleanup()
    useDocumentStore.getState().goToLanding()
  })

  it('renders the founder-voice h1 verbatim', async () => {
    const { HeroSection } = await import('../components/HeroSection')
    await act(async () => {
      render(React.createElement(HeroSection))
    })
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "I built this because I couldn't find a PDF signer that was actually free.",
    )
  })

  it('renders body paragraph 1 verbatim', async () => {
    const { HeroSection } = await import('../components/HeroSection')
    await act(async () => {
      render(React.createElement(HeroSection))
    })
    expect(
      screen.getByText(
        /Every one I tried had a catch: sign up for an account, pay to download your own document, or quietly upload your files to a server I've never heard of\./,
      ),
    ).toBeInTheDocument()
  })

  it('renders body paragraph 2 starting with "FreeESign does one thing"', async () => {
    const { HeroSection } = await import('../components/HeroSection')
    await act(async () => {
      render(React.createElement(HeroSection))
    })
    expect(
      screen.getByText(/FreeESign does one thing:/),
    ).toBeInTheDocument()
  })

  it('CTA has the preserved aria-label "Start signing — opens the document uploader"', async () => {
    const { HeroSection } = await import('../components/HeroSection')
    await act(async () => {
      render(React.createElement(HeroSection))
    })
    const cta = screen.getByRole('button', {
      name: /start signing — opens the document uploader/i,
    })
    expect(cta).toBeInTheDocument()
  })

  it('CTA label text contains "START SIGNING"', async () => {
    const { HeroSection } = await import('../components/HeroSection')
    await act(async () => {
      render(React.createElement(HeroSection))
    })
    const cta = screen.getByRole('button', {
      name: /start signing — opens the document uploader/i,
    })
    expect(cta.textContent).toMatch(/START SIGNING/i)
  })

  it('clicking the hero CTA transitions view to "empty"', async () => {
    const { HeroSection } = await import('../components/HeroSection')
    await act(async () => {
      render(React.createElement(HeroSection))
    })
    const cta = screen.getByRole('button', {
      name: /start signing — opens the document uploader/i,
    })
    fireEvent.click(cta)
    expect(useDocumentStore.getState().view).toBe('empty')
  })

  it('mono fineprint "FREE · NO ACCOUNT · NO UPLOADS" is present', async () => {
    const { HeroSection } = await import('../components/HeroSection')
    await act(async () => {
      render(React.createElement(HeroSection))
    })
    expect(
      screen.getByText(/FREE\s*·\s*NO ACCOUNT\s*·\s*NO UPLOADS/),
    ).toBeInTheDocument()
  })

  it('device illustration container is aria-hidden', async () => {
    const { HeroSection } = await import('../components/HeroSection')
    let container!: HTMLElement
    await act(async () => {
      const result = render(React.createElement(HeroSection))
      container = result.container
    })
    const device = container.querySelector('[data-testid="l3-device"]')
    expect(device).not.toBeNull()
    expect(device).toHaveAttribute('aria-hidden', 'true')
  })
})
