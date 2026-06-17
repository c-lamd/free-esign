import { LandingHeader } from './LandingHeader'
import { HeroSection } from './HeroSection'
import { HowItWorksSection } from './HowItWorksSection'
import { PrivacySection } from './PrivacySection'
import { LandingFooter } from './LandingFooter'

export function LandingPage() {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-surface)',
        minHeight: '100dvh',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <LandingHeader />
      <main>
        <HeroSection />
        <HowItWorksSection />
        <PrivacySection />
      </main>
      <LandingFooter />
    </div>
  )
}
