import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PlatformProvider, type Platform } from '@/platform'
import { MotionPreferencesProvider } from '@/shared/motion/MotionPreferencesProvider'
import { ServicesProvider } from '@/shared/services/ServicesProvider'
import { SessionBridge } from '@/shared/session/SessionBridge'
import type { AppServices } from '@/shared/services/services'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'
import { AppStatus } from '@/shared/pwa/AppStatus'
import { BiometricLockProvider } from '@/shared/security/BiometricLockProvider'
import type { InitialSettings } from './bootstrap'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'

function AppTheme({ settings, children }: { settings: InitialSettings; children: ReactNode }) {
  const { granted } = useEntitlement('premium_themes')
  return (
    <ThemeProvider initialThemeId={settings.themeId} premiumAllowed={granted}>
      {children}
    </ThemeProvider>
  )
}

export function AppProviders({
  platform,
  services,
  queryClient,
  settings,
  children,
}: {
  platform: Platform
  services: AppServices
  queryClient: QueryClient
  settings: InitialSettings
  children: ReactNode
}) {
  return (
    <PlatformProvider platform={platform}>
      <ServicesProvider services={services}>
        <QueryClientProvider client={queryClient}>
          <SessionBridge />
          <AppTheme settings={settings}>
            <MotionPreferencesProvider initialReduceMotion={settings.reduceMotion}>
              <BiometricLockProvider initialEnabled={settings.biometricLock}>
                <AppStatus />
                {children}
              </BiometricLockProvider>
            </MotionPreferencesProvider>
          </AppTheme>
        </QueryClientProvider>
      </ServicesProvider>
    </PlatformProvider>
  )
}
