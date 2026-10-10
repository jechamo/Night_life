import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router/dom'
import { env } from '@/shared/config/env'
import { initI18n } from '@/i18n'
import { AppProviders } from './app/AppProviders'
import { loadInitialSettings } from './app/bootstrap'
import { createPlatform } from './app/create-platform'
import { connectNativeBridge } from './app/native-bridge'
import { createQueryClient } from './app/query-client'
import { createAppRouter } from './app/router'
import { createAppServices } from './app/services'
import './styles/index.css'

const platform = await createPlatform({ appUrl: env.appUrl })
// Web: service worker only in production. Native: connection state only.
if (platform.runtime === 'native' || import.meta.env.PROD) platform.appUpdates.start()
const settings = await loadInitialSettings(platform)
await initI18n(settings.language)

// Supabase when VITE_SUPABASE_* are set (ADR 0009); full mock otherwise.
const services = createAppServices(platform)
const router = createAppRouter()
connectNativeBridge(platform, router)

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
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
