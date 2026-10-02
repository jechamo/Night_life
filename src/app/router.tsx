import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { ChatsScreen } from '@/features/chats/ChatsScreen'
import { DesignKitScreen } from '@/features/design-kit/DesignKitScreen'
import { DiscoverScreen } from '@/features/discover/DiscoverScreen'
import { ProfileScreen } from '@/features/profile/ProfileScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { ThemesScreen } from '@/features/themes/ThemesScreen'
import { TonightScreen } from '@/features/tonight/TonightScreen'
import { ScreenErrorBoundary } from '@/shared/errors/ScreenErrorBoundary'
import { AppShell } from './layout/AppShell'
import { NotFoundScreen } from './NotFoundScreen'
import { RouteErrorScreen } from './RouteErrorScreen'

/** Every screen gets its own error boundary (PRD 3.4). */
const screen = (Screen: ComponentType) => (
  <ScreenErrorBoundary>
    <Screen />
  </ScreenErrorBoundary>
)

// Pure SPA routes (no SSR), WebView-compatible (PRD 3.3 point 2).
export const routes: RouteObject[] = [
  {
    element: <AppShell />,
    errorElement: <RouteErrorScreen />,
    children: [
      { index: true, element: <Navigate to="/discover" replace /> },
      { path: 'discover', element: screen(DiscoverScreen) },
      { path: 'tonight', element: screen(TonightScreen) },
      { path: 'chats', element: screen(ChatsScreen) },
      { path: 'profile', element: screen(ProfileScreen) },
      { path: 'profile/themes', element: screen(ThemesScreen) },
      { path: 'profile/settings', element: screen(SettingsScreen) },
      { path: 'dev/kit', element: screen(DesignKitScreen) },
    ],
  },
  { path: '*', element: <NotFoundScreen /> },
]

export const createAppRouter = () => createBrowserRouter(routes)
