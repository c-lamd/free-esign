/**
 * heroSection.test.tsx — HeroSection structure + copy + CTA preservation guards.
 *
 * HeroSection is the founder-voice note. As of quick 260622-frp it lives on the
 * hub homepage (not /sign) and its CTA navigates to /sign via react-router — so
 * these tests render it under a <MemoryRouter> with a /sign route and assert the
 * CTA performs that navigation (replacing the old view==='empty' transition).
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { HeroSection } from '../components/HeroSection'

afterEach(() => cleanup())

function renderHero() {
  return render(
    <MemoryRouter initialEntries={['/']}>
      <Routes>
        <Route path="/" element={<HeroSection />} />
        <Route path="/sign" element={<div>SIGN TOOL PAGE</div>} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('HeroSection (founder note)', () => {
  it('renders the founder-voice h1 verbatim', () => {
    renderHero()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "I built this because I couldn't find a PDF signer that was actually free.",
    )
  })

  it('renders body paragraph 1 verbatim', () => {
    renderHero()
    expect(
      screen.getByText(
        /Every one I tried had a catch: sign up for an account, pay to download your own document, or quietly upload your files to a server I've never heard of\./,
      ),
    ).toBeInTheDocument()
  })

  it('renders body paragraph 2 starting with "FreeESign does one thing"', () => {
    renderHero()
    expect(screen.getByText(/FreeESign does one thing:/)).toBeInTheDocument()
  })

  it('CTA has the preserved aria-label "Start signing — opens the document uploader"', () => {
    renderHero()
    expect(
      screen.getByRole('button', { name: /start signing — opens the document uploader/i }),
    ).toBeInTheDocument()
  })

  it('CTA label text contains "START SIGNING"', () => {
    renderHero()
    const cta = screen.getByRole('button', {
      name: /start signing — opens the document uploader/i,
    })
    expect(cta.textContent).toMatch(/START SIGNING/i)
  })

  it('clicking the CTA navigates to /sign', () => {
    renderHero()
    const cta = screen.getByRole('button', {
      name: /start signing — opens the document uploader/i,
    })
    fireEvent.click(cta)
    expect(screen.getByText('SIGN TOOL PAGE')).toBeInTheDocument()
  })

  it('mono fineprint "FREE · NO ACCOUNT · NO UPLOADS" is present', () => {
    renderHero()
    expect(screen.getByText(/FREE\s*·\s*NO ACCOUNT\s*·\s*NO UPLOADS/)).toBeInTheDocument()
  })

  it('device illustration container is aria-hidden', () => {
    const { container } = renderHero()
    const device = container.querySelector('[data-testid="l3-device"]')
    expect(device).not.toBeNull()
    expect(device).toHaveAttribute('aria-hidden', 'true')
  })
})
