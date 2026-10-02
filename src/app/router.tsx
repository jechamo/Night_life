import type { ComponentType } from 'react'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AdminLayout } from '@/features/admin/components/AdminLayout'
import { AdminDashboardScreen } from '@/features/admin/screens/AdminDashboardScreen'
import { AdminFlagsScreen } from '@/features/admin/screens/AdminFlagsScreen'
import { AdminPaymentsScreen } from '@/features/admin/screens/AdminPaymentsScreen'
import { AdminSectionScreen } from '@/features/admin/screens/AdminSectionScreen'
import { AdminSettingsScreen } from '@/features/admin/screens/AdminSettingsScreen'
import { AdminTestToolsScreen } from '@/features/admin/screens/AdminTestToolsScreen'
import { SignedDocumentsScreen } from '@/features/legal/screens/SignedDocumentsScreen'
import { ModerationScreen } from '@/features/moderation/screens/ModerationScreen'
import { SuspendedScreen } from '@/features/moderation/screens/SuspendedScreen'
import { CheckoutScreen } from '@/features/premium/screens/CheckoutScreen'
import { MySubscriptionScreen } from '@/features/premium/screens/MySubscriptionScreen'
import { PaywallScreen } from '@/features/premium/screens/PaywallScreen'
import { PurchaseReturnScreen } from '@/features/premium/screens/PurchaseReturnScreen'
import { RedeemScreen } from '@/features/premium/screens/RedeemScreen'
import { TestCheckoutScreen } from '@/features/premium/screens/TestCheckoutScreen'
import { PrivacyDataScreen } from '@/features/privacy/screens/PrivacyDataScreen'
import { PublicLayout } from '@/features/public/PublicLayout'
import { ContactScreen } from '@/features/public/screens/ContactScreen'
import { DeleteAccountInfoScreen } from '@/features/public/screens/DeleteAccountInfoScreen'
import { IllegalContentScreen } from '@/features/public/screens/IllegalContentScreen'
import { LegalDocumentScreen } from '@/features/public/screens/LegalDocumentScreen'
import { LegalIndexScreen } from '@/features/public/screens/LegalIndexScreen'
import { SosScreen } from '@/features/safety/screens/SosScreen'
import { VenueDetailScreen } from '@/features/venue-panel/screens/VenueDetailScreen'
import { VenuePanelScreen } from '@/features/venue-panel/screens/VenuePanelScreen'
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
  // Public legal website: no login, outside the app shell (PRD 5.1).
  {
    path: 'legal',
    element: <PublicLayout />,
    errorElement: <RouteErrorScreen />,
    children: [
      { index: true, element: screen(LegalIndexScreen) },
      { path: 'delete-account', element: screen(DeleteAccountInfoScreen) },
      { path: 'illegal-content', element: screen(IllegalContentScreen) },
      { path: 'contact', element: screen(ContactScreen) },
      { path: ':slug', element: screen(LegalDocumentScreen) },
    ],
  },
  { path: 'suspended', element: screen(SuspendedScreen), errorElement: <RouteErrorScreen /> },
  {
    path: 'suspended/moderation',
    element: screen(ModerationScreen),
    errorElement: <RouteErrorScreen />,
  },
  {
    path: 'admin',
    element: (
      <RequireOnboarded allowSuspended>
        <AdminLayout />
      </RequireOnboarded>
    ),
    errorElement: <RouteErrorScreen />,
    children: [
      { index: true, element: screen(AdminDashboardScreen) },
      { path: 's/:section', element: screen(AdminSectionScreen) },
      { path: 'flags', element: screen(AdminFlagsScreen) },
      { path: 'payments', element: screen(AdminPaymentsScreen) },
      { path: 'test-tools', element: screen(AdminTestToolsScreen) },
      { path: 'settings', element: screen(AdminSettingsScreen) },
    ],
  },
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
      { path: 'profile/privacy', element: screen(PrivacyDataScreen) },
      { path: 'profile/documents', element: screen(SignedDocumentsScreen) },
      { path: 'profile/moderation', element: screen(ModerationScreen) },
      { path: 'profile/sos', element: screen(SosScreen) },
      { path: 'premium', element: screen(PaywallScreen) },
      { path: 'premium/checkout/:code', element: screen(CheckoutScreen) },
      { path: 'premium/test-checkout/:code', element: screen(TestCheckoutScreen) },
      { path: 'premium/return', element: screen(PurchaseReturnScreen) },
      { path: 'premium/subscription', element: screen(MySubscriptionScreen) },
      { path: 'premium/redeem', element: screen(RedeemScreen) },
      { path: 'venue', element: screen(VenuePanelScreen) },
      { path: 'venue/:placeId', element: screen(VenueDetailScreen) },
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
