import { useTranslation } from 'react-i18next'
import { Outlet, useMatches } from 'react-router'
import { MatchCelebrationProvider } from '@/features/matching/components/MatchCelebration'
import { AgeGateProvider } from '@/features/verification/hooks/use-age-gate'
import { RealtimeBridge } from '@/shared/realtime/RealtimeBridge'
import { TabBar } from './TabBar'

const isFullBleed = (handle: unknown) =>
  typeof handle === 'object' &&
  handle !== null &&
  (handle as { fullBleed?: boolean }).fullBleed === true

/**
 * App frame: night ambience behind, scrollable content (or a full-bleed screen such
 * as the map), floating tab bar. 100dvh + safe areas: same behaviour in browser,
 * installed PWA and Capacitor WebView (PRD 3.3).
 */
export function AppShell() {
  const { t } = useTranslation()
  const fullBleed = useMatches().some((match) => isFullBleed(match.handle))
  return (
    <MatchCelebrationProvider>
      <RealtimeBridge />
      <div className="relative flex h-dvh flex-col overflow-hidden bg-background">
        <a
          href="#main"
          className="glass fixed top-2 left-2 z-50 -translate-y-24 rounded-full px-4 py-2 focus:translate-y-[env(safe-area-inset-top)]"
        >
          {t('common.skipToContent')}
        </a>
        <NightAmbience />
        <AgeGateProvider>
          {fullBleed ? (
            <main id="main" tabIndex={-1} className="relative flex-1">
              <Outlet />
            </main>
          ) : (
            <main
              id="main"
              tabIndex={-1}
              className="relative flex-1 overflow-y-auto pb-[calc(7rem+env(safe-area-inset-bottom))]"
            >
              <div className="mx-auto w-full max-w-3xl">
                <Outlet />
              </div>
            </main>
          )}
        </AgeGateProvider>
        <TabBar />
      </div>
    </MatchCelebrationProvider>
  )
}

/** Static glows tinted by the theme; decorative only (no animation, no data). */
function NightAmbience() {
  return (
    <div aria-hidden className="nl-ambience pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -top-32 -left-24 size-96 rounded-full bg-primary opacity-[0.14] blur-3xl" />
      <div className="absolute top-1/3 -right-32 size-96 rounded-full bg-secondary opacity-[0.10] blur-3xl" />
      <div className="absolute -bottom-40 left-1/4 size-[28rem] rounded-full bg-accent-event opacity-[0.08] blur-3xl" />
    </div>
  )
}
