import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import React from 'react'
import { useDocumentStore } from '../store/documentStore'

describe('LandingPage', () => {
  beforeEach(() => {
    cleanup()
    useDocumentStore.getState().goToLanding()
  })

  it('renders an h1 when view === landing', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    await act(async () => {
      render(React.createElement(LandingPage))
    })
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('hero h1 contains the candid copy', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    await act(async () => {
      render(React.createElement(LandingPage))
    })
    expect(
      screen.getByRole('heading', { level: 1 }),
    ).toHaveTextContent("I built this because I couldn't find a PDF signer that was actually free.")
  })

  it('privacy heading "Your document never leaves your browser" is present', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    await act(async () => {
      render(React.createElement(LandingPage))
    })
    expect(
      screen.getByText('Your document never leaves your browser'),
    ).toBeInTheDocument()
  })

  it('renders exactly three how-it-works step titles', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    await act(async () => {
      render(React.createElement(LandingPage))
    })
    expect(screen.getByText('Open your document')).toBeInTheDocument()
    expect(screen.getByText('Place your signature')).toBeInTheDocument()
    expect(screen.getByText('Download the signed file')).toBeInTheDocument()
  })

  it('BMC link is well-formed: href present, target=_blank, rel correct', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    await act(async () => {
      render(React.createElement(LandingPage))
    })
    const bmcLink = screen.getByRole('link', { name: /buy me a coffee/i })
    // href must be present and point at buymeacoffee.com
    expect((bmcLink as HTMLAnchorElement).href).toMatch(/^https:\/\/www\.buymeacoffee\.com\//)
    // Must open in a new tab
    expect(bmcLink).toHaveAttribute('target', '_blank')
    // Must have the correct security attributes for external links
    expect(bmcLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  // TODO (IN-03): Before shipping, replace BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/PLACEHOLDER'
  // in src/config.ts with the real handle. The test below is intentionally skipped while
  // the placeholder is in place during development. Un-skip it (change it.skip → it) before launch.
  it.skip('BUY_ME_A_COFFEE_URL does not contain PLACEHOLDER (un-skip before launch)', async () => {
    const { BUY_ME_A_COFFEE_URL } = await import('../config')
    expect(BUY_ME_A_COFFEE_URL).not.toMatch(/PLACEHOLDER/)
  })

  it('rendered landing page has no <script> or <iframe> elements', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    let container!: HTMLElement
    await act(async () => {
      const result = render(React.createElement(LandingPage))
      container = result.container
    })
    expect(container.querySelectorAll('script')).toHaveLength(0)
    expect(container.querySelectorAll('iframe')).toHaveLength(0)
  })

  it('clicking the hero CTA button transitions view to empty', async () => {
    const { LandingPage } = await import('../components/LandingPage')
    await act(async () => {
      render(React.createElement(LandingPage))
    })
    // Both the hero CTA and the privacy section CTA have the same aria-label — pick the first
    const [cta] = screen.getAllByRole('button', {
      name: /start signing — opens the document uploader/i,
    })
    fireEvent.click(cta)
    expect(useDocumentStore.getState().view).toBe('empty')
  })
})
