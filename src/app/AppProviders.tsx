import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { PlatformProvider, type Platform } from '@/platform'
import { MotionPreferencesProvider } from '@/shared/motion/MotionPreferencesProvider'
import { ServicesProvider } from '@/shared/services/ServicesProvider'
import { SessionBridge } from '@/shared/session/SessionBridge'
import type { AppServices } from '@/shared/services/services'
import { ThemeProvider } from '@/shared/theme/ThemeProvider'
import { AppStatus } from '@/shared/pwa/AppStatus'
import type { InitialSettings } from './bootstrap'

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
          <ThemeProvider initialThemeId={settings.themeId}>
            <MotionPreferencesProvider initialReduceMotion={settings.reduceMotion}>
              <AppStatus />
              {children}
            </MotionPreferencesProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </ServicesProvider>
    </PlatformProvider>
  )
}
