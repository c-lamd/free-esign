import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { useDocumentStore } from '../store/documentStore'

/**
 * LandingPage is the pre-router v1.0 full-page landing. It is no longer mounted
 * in the app (the v1.2 router replaced the top-level <LandingPage> with ToolsHub),
 * but these tests still guard its content + the shared sections it composes.
 * HeroSection now navigates via react-router, so LandingPage must render under a
 * Router here. (LandingPage is a candidate for dead-code removal — see the
 * 260622-frp quick-task note.)
 */
async function renderLanding() {
  const { LandingPage } = await import('../components/LandingPage')
  let result!: ReturnType<typeof render>
  await act(async () => {
    result = render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/sign" element={<div>SIGN TOOL PAGE</div>} />
        </Routes>
      </MemoryRouter>,
    )
  })
  return result
}

describe('LandingPage', () => {
  beforeEach(() => {
    cleanup()
    useDocumentStore.getState().goToLanding()
  })

  it('renders an h1', async () => {
    await renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('hero h1 contains the candid copy', async () => {
    await renderLanding()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "I built this because I couldn't find a PDF signer that was actually free.",
    )
  })

  it('privacy heading "Your document never leaves your browser" is present', async () => {
    await renderLanding()
    expect(
      screen.getByText('Your document never leaves your browser'),
    ).toBeInTheDocument()
  })

  it('renders exactly three how-it-works step titles', async () => {
    await renderLanding()
    expect(screen.getByText('Open your document')).toBeInTheDocument()
    expect(screen.getByText('Place your signature')).toBeInTheDocument()
    expect(screen.getByText('Download the signed file')).toBeInTheDocument()
  })

  it('BMC link is well-formed: href present, target=_blank, rel correct', async () => {
    await renderLanding()
    const bmcLink = screen.getByRole('link', { name: /buy me a coffee/i })
    expect((bmcLink as HTMLAnchorElement).href).toMatch(/^https:\/\/www\.buymeacoffee\.com\//)
    expect(bmcLink).toHaveAttribute('target', '_blank')
    expect(bmcLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  // IN-03: Real BMC handle is set in src/config.ts for launch (was PLACEHOLDER during
  // development). This guard stays active to catch any accidental regression to a placeholder.
  it('BUY_ME_A_COFFEE_URL does not contain PLACEHOLDER (un-skip before launch)', async () => {
    const { BUY_ME_A_COFFEE_URL } = await import('../config')
    expect(BUY_ME_A_COFFEE_URL).not.toMatch(/PLACEHOLDER/)
  })

  it('rendered landing page has no <script> or <iframe> elements', async () => {
    const { container } = await renderLanding()
    expect(container.querySelectorAll('script')).toHaveLength(0)
    expect(container.querySelectorAll('iframe')).toHaveLength(0)
  })

  it('clicking the hero CTA navigates to /sign', async () => {
    await renderLanding()
    // The hero CTA is the first of the matching CTAs (the privacy section repeats
    // the same aria-label). HeroSection's CTA now routes to /sign.
    const [cta] = screen.getAllByRole('button', {
      name: /start signing — opens the document uploader/i,
    })
    fireEvent.click(cta)
    expect(screen.getByText('SIGN TOOL PAGE')).toBeInTheDocument()
  })

  // LND-07: GitHub source link must be preserved exactly in the footer
  it('footer GitHub source link is present and well-formed', async () => {
    await renderLanding()
    const githubLink = screen.getByRole('link', { name: /github/i })
    expect((githubLink as HTMLAnchorElement).href).toBe(
      'https://github.com/c-lamd/free-esign',
    )
    expect(githubLink).toHaveAttribute('target', '_blank')
    expect(githubLink).toHaveAttribute('rel', 'noopener noreferrer')
  })

  // LND-07: Footer mono tagline must carry the instrument-panel voice
  it('footer mono tagline "SIGN · PRIVATELY · IN YOUR BROWSER" is present', async () => {
    await renderLanding()
    // Match the tagline tolerating possible node-splitting on · separators
    expect(
      screen.getByText((content) =>
        content.replace(/\s+/g, ' ').includes('SIGN · PRIVATELY · IN YOUR BROWSER'),
      ),
    ).toBeInTheDocument()
  })
})
