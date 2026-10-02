import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { ChatScreen } from '@/features/chats/ChatScreen'
import { ChatsScreen } from '@/features/chats/ChatsScreen'
import { CreateEventScreen } from '@/features/events/CreateEventScreen'
import { LikesYouScreen } from '@/features/matching/screens/LikesYouScreen'
import { PersonScreen } from '@/features/matching/screens/PersonScreen'
import { SwipeScreen } from '@/features/matching/screens/SwipeScreen'
import { ConsentsSettingsScreen } from '@/features/consents/ConsentsSettingsScreen'
import { OnboardingScreen } from '@/features/onboarding/screens/OnboardingScreen'
import { WelcomeScreen } from '@/features/onboarding/screens/WelcomeScreen'
import { AgeVerificationScreen } from '@/features/verification/screens/AgeVerificationScreen'
import { OptionalVerificationScreen } from '@/features/verification/screens/OptionalVerificationScreen'
import { ProviderSandboxScreen } from '@/features/verification/screens/ProviderSandboxScreen'
import { VerificationCenterScreen } from '@/features/verification/screens/VerificationCenterScreen'
import { DesignKitScreen } from '@/features/design-kit/DesignKitScreen'
import { DiscoverScreen } from '@/features/discover/DiscoverScreen'
import { ProfileScreen } from '@/features/profile/ProfileScreen'
import { SettingsScreen } from '@/features/settings/SettingsScreen'
import { ThemesScreen } from '@/features/themes/ThemesScreen'
import { TonightScreen } from '@/features/tonight/TonightScreen'
import { ScreenErrorBoundary } from '@/shared/errors/ScreenErrorBoundary'
import { AppShell } from './layout/AppShell'
import { NotFoundScreen } from './NotFoundScreen'
import { RequireOnboarded } from './RequireOnboarded'
import { RouteErrorScreen } from './RouteErrorScreen'

/** Every screen gets its own error boundary (PRD 3.4). */
const screen = (Screen: ComponentType) => (
  <ScreenErrorBoundary>
    <Screen />
  </ScreenErrorBoundary>
)
const PhotoVerification = () => <OptionalVerificationScreen level="photo" />
const IdentityVerification = () => <OptionalVerificationScreen level="identity" />

// Pure SPA routes (no SSR), WebView-compatible (PRD 3.3 point 2).
export const routes: RouteObject[] = [
  { path: 'welcome', element: screen(WelcomeScreen), errorElement: <RouteErrorScreen /> },
  { path: 'onboarding', element: screen(OnboardingScreen), errorElement: <RouteErrorScreen /> },
  {
    element: (
      <RequireOnboarded>
        <AppShell />
      </RequireOnboarded>
    ),
    errorElement: <RouteErrorScreen />,
    children: [
      { index: true, element: <Navigate to="/discover" replace /> },
      { path: 'discover', element: screen(DiscoverScreen), handle: { fullBleed: true } },
      { path: 'tonight', element: screen(TonightScreen) },
      { path: 'tonight/swipe', element: screen(SwipeScreen) },
      { path: 'tonight/swipe/:placeId', element: screen(SwipeScreen) },
      { path: 'tonight/likes', element: screen(LikesYouScreen) },
      { path: 'people/:personId', element: screen(PersonScreen) },
      { path: 'chats', element: screen(ChatsScreen) },
      { path: 'chats/:matchId', element: screen(ChatScreen) },
      { path: 'events/new', element: screen(CreateEventScreen) },
      { path: 'profile', element: screen(ProfileScreen) },
      { path: 'profile/themes', element: screen(ThemesScreen) },
      { path: 'profile/settings', element: screen(SettingsScreen) },
      { path: 'profile/verification', element: screen(VerificationCenterScreen) },
      { path: 'profile/consents', element: screen(ConsentsSettingsScreen) },
      { path: 'verification/age', element: screen(AgeVerificationScreen) },
      { path: 'verification/photo', element: screen(PhotoVerification) },
      { path: 'verification/identity', element: screen(IdentityVerification) },
      { path: 'verification/sandbox', element: screen(ProviderSandboxScreen) },
      { path: 'dev/kit', element: screen(DesignKitScreen) },
    ],
  },
  { path: '*', element: <NotFoundScreen /> },
]

export const createAppRouter = () => createBrowserRouter(routes)
