import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { createMockServices } from '@/mocks/mock-services'
import { createWebPlatform, detectRuntime } from '@/platform'
import { env } from '@/shared/config/env'
import { initI18n } from '@/i18n'
import { AppProviders } from './app/AppProviders'
import { loadInitialSettings } from './app/bootstrap'
import { createQueryClient } from './app/query-client'
import { createAppRouter } from './app/router'
import './styles/index.css'

// Annex B adds `createNativePlatform()` for runtime === 'native'.
if (detectRuntime() === 'native')
  console.warn('Native runtime detected: using web adapters until Annex B.')

const platform = createWebPlatform({ appUrl: env.appUrl })
const settings = await loadInitialSettings(platform)
await initI18n(settings.language)

// Blocks 1-4: mocked services (PRD 11.1 point 6). Block 5 swaps in Supabase.
const services = createMockServices({ preferences: platform.preferences })

const container = document.getElementById('root')
if (!container) throw new Error('Missing #root element')

createRoot(container).render(
  <StrictMode>
    <AppProviders
      platform={platform}
      services={services}
      queryClient={createQueryClient()}
      settings={settings}
    >
      <RouterProvider router={createAppRouter()} />
    </AppProviders>
  </StrictMode>,
)
