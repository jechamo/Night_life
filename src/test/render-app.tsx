import { render } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/AppProviders'
import type { InitialSettings } from '@/app/bootstrap'
import { createQueryClient } from '@/app/query-client'
import { routes } from '@/app/router'
import { createMockServices, type MockServiceOptions } from '@/mocks/mock-services'
import { createFakePlatform } from '@/platform/testing'
import type { AppServices } from '@/shared/services/services'

/** Renders the real route tree with a fake platform and mocked services. */
export function renderApp(
  path: string,
  options: {
    services?: MockServiceOptions
    settings?: Partial<InitialSettings>
    platform?: Parameters<typeof createFakePlatform>[0]
    serviceOverrides?: Partial<AppServices>
  } = {},
) {
  const platform = createFakePlatform(options.platform)
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  const queryClient = createQueryClient()
  queryClient.setDefaultOptions({ queries: { retry: false } })
  const settings: InitialSettings = {
    themeId: 'neon-noir',
    reduceMotion: false,
    language: 'es',
    ...options.settings,
  }
  const services = {
    ...createMockServices({
      latencyMs: 0,
      realtime: false,
      preferences: platform.preferences,
      ...options.services,
      state: { onboarded: true, ...options.services?.state },
    }),
    ...options.serviceOverrides,
  }
  const utils = render(
    <AppProviders
      platform={platform}
      services={services}
      queryClient={queryClient}
      settings={settings}
    >
      <RouterProvider router={router} />
    </AppProviders>,
  )
  return { ...utils, platform, router, services, queryClient }
}
