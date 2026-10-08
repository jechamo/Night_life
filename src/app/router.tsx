import { lazy, Suspense, type ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import { Skeleton } from '@/shared/ui/skeleton'
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AdminLayout } from '@/features/admin/components/AdminLayout'
import { PublicLayout } from '@/features/public/PublicLayout'
import { AgeVerifiedRoute } from '@/features/verification/components/AgeVerifiedRoute'
import type { AgeGatedAction } from '@/features/verification/model/verification'
import { ScreenErrorBoundary } from '@/shared/errors/ScreenErrorBoundary'
import { AppShell } from './layout/AppShell'
import { NotFoundScreen } from './NotFoundScreen'
import { RequireOnboarded } from './RequireOnboarded'
import { RedirectIfOnboarded } from './RedirectIfOnboarded'
import { RouteErrorScreen } from './RouteErrorScreen'

const AdminDashboardScreen = lazy(() =>
  import('@/features/admin/screens/AdminDashboardScreen').then((module) => ({
    default: module.AdminDashboardScreen,
  })),
)
const AdminFlagsScreen = lazy(() =>
  import('@/features/admin/screens/AdminFlagsScreen').then((module) => ({
    default: module.AdminFlagsScreen,
  })),
)
const AdminPaymentsScreen = lazy(() =>
  import('@/features/admin/screens/AdminPaymentsScreen').then((module) => ({
    default: module.AdminPaymentsScreen,
  })),
)
const AdminSectionScreen = lazy(() =>
  import('@/features/admin/screens/AdminSectionScreen').then((module) => ({
    default: module.AdminSectionScreen,
  })),
)
const AdminSettingsScreen = lazy(() =>
  import('@/features/admin/screens/AdminSettingsScreen').then((module) => ({
    default: module.AdminSettingsScreen,
  })),
)
const AdminTestToolsScreen = lazy(() =>
  import('@/features/admin/screens/AdminTestToolsScreen').then((module) => ({
    default: module.AdminTestToolsScreen,
  })),
)
const AdminVenuePhotosScreen = lazy(() =>
  import('@/features/admin/screens/AdminVenuePhotosScreen').then((module) => ({
    default: module.AdminVenuePhotosScreen,
  })),
)
const AdminPartnersScreen = lazy(() =>
  import('@/features/admin/screens/AdminPartnersScreen').then((module) => ({
    default: module.AdminPartnersScreen,
  })),
)
const InviteLandingScreen = lazy(() =>
  import('@/features/venue-panel/screens/InviteLandingScreen').then((module) => ({
    default: module.InviteLandingScreen,
  })),
)
const RedeemInviteScreen = lazy(() =>
  import('@/features/venue-panel/screens/RedeemInviteScreen').then((module) => ({
    default: module.RedeemInviteScreen,
  })),
)
const AdminVenuesScreen = lazy(() =>
  import('@/features/admin/screens/AdminVenuesScreen').then((module) => ({
    default: module.AdminVenuesScreen,
  })),
)
const SignedDocumentsScreen = lazy(() =>
  import('@/features/legal/screens/SignedDocumentsScreen').then((module) => ({
    default: module.SignedDocumentsScreen,
  })),
)
const ModerationScreen = lazy(() =>
  import('@/features/moderation/screens/ModerationScreen').then((module) => ({
    default: module.ModerationScreen,
  })),
)
const SuspendedScreen = lazy(() =>
  import('@/features/moderation/screens/SuspendedScreen').then((module) => ({
    default: module.SuspendedScreen,
  })),
)
const CheckoutScreen = lazy(() =>
  import('@/features/premium/screens/CheckoutScreen').then((module) => ({
    default: module.CheckoutScreen,
  })),
)
const MySubscriptionScreen = lazy(() =>
  import('@/features/premium/screens/MySubscriptionScreen').then((module) => ({
    default: module.MySubscriptionScreen,
  })),
)
const PaywallScreen = lazy(() =>
  import('@/features/premium/screens/PaywallScreen').then((module) => ({
    default: module.PaywallScreen,
  })),
)
const PurchaseReturnScreen = lazy(() =>
  import('@/features/premium/screens/PurchaseReturnScreen').then((module) => ({
    default: module.PurchaseReturnScreen,
  })),
)
const RedeemScreen = lazy(() =>
  import('@/features/premium/screens/RedeemScreen').then((module) => ({
    default: module.RedeemScreen,
  })),
)
const TestCheckoutScreen = lazy(() =>
  import('@/features/premium/screens/TestCheckoutScreen').then((module) => ({
    default: module.TestCheckoutScreen,
  })),
)
const PrivacyDataScreen = lazy(() =>
  import('@/features/privacy/screens/PrivacyDataScreen').then((module) => ({
    default: module.PrivacyDataScreen,
  })),
)
const ContactScreen = lazy(() =>
  import('@/features/public/screens/ContactScreen').then((module) => ({
    default: module.ContactScreen,
  })),
)
const DeleteAccountInfoScreen = lazy(() =>
  import('@/features/public/screens/DeleteAccountInfoScreen').then((module) => ({
    default: module.DeleteAccountInfoScreen,
  })),
)
const IllegalContentScreen = lazy(() =>
  import('@/features/public/screens/IllegalContentScreen').then((module) => ({
    default: module.IllegalContentScreen,
  })),
)
const LegalDocumentScreen = lazy(() =>
  import('@/features/public/screens/LegalDocumentScreen').then((module) => ({
    default: module.LegalDocumentScreen,
  })),
)
const UserGuideScreen = lazy(() =>
  import('@/features/public/screens/GuideScreen').then((module) => ({
    default: module.UserGuideScreen,
  })),
)
const VenueGuideScreen = lazy(() =>
  import('@/features/public/screens/GuideScreen').then((module) => ({
    default: module.VenueGuideScreen,
  })),
)
const LegalIndexScreen = lazy(() =>
  import('@/features/public/screens/LegalIndexScreen').then((module) => ({
    default: module.LegalIndexScreen,
  })),
)
const SosScreen = lazy(() =>
  import('@/features/safety/screens/SosScreen').then((module) => ({ default: module.SosScreen })),
)
const VenueDetailScreen = lazy(() =>
  import('@/features/venue-panel/screens/VenueDetailScreen').then((module) => ({
    default: module.VenueDetailScreen,
  })),
)
const VenuePanelScreen = lazy(() =>
  import('@/features/venue-panel/screens/VenuePanelScreen').then((module) => ({
    default: module.VenuePanelScreen,
  })),
)
const ChatScreen = lazy(() =>
  import('@/features/chats/ChatScreen').then((module) => ({ default: module.ChatScreen })),
)
const ChatsScreen = lazy(() =>
  import('@/features/chats/ChatsScreen').then((module) => ({ default: module.ChatsScreen })),
)
const CreateEventScreen = lazy(() =>
  import('@/features/events/CreateEventScreen').then((module) => ({
    default: module.CreateEventScreen,
  })),
)
const LikesYouScreen = lazy(() =>
  import('@/features/matching/screens/LikesYouScreen').then((module) => ({
    default: module.LikesYouScreen,
  })),
)
const PersonScreen = lazy(() =>
  import('@/features/matching/screens/PersonScreen').then((module) => ({
    default: module.PersonScreen,
  })),
)
const SwipeScreen = lazy(() =>
  import('@/features/matching/screens/SwipeScreen').then((module) => ({
    default: module.SwipeScreen,
  })),
)
const ConsentsSettingsScreen = lazy(() =>
  import('@/features/consents/ConsentsSettingsScreen').then((module) => ({
    default: module.ConsentsSettingsScreen,
  })),
)
const OnboardingScreen = lazy(() =>
  import('@/features/onboarding/screens/OnboardingScreen').then((module) => ({
    default: module.OnboardingScreen,
  })),
)
const LoginScreen = lazy(() =>
  import('@/features/onboarding/screens/LoginScreen').then((module) => ({
    default: module.LoginScreen,
  })),
)
const WelcomeScreen = lazy(() =>
  import('@/features/onboarding/screens/WelcomeScreen').then((module) => ({
    default: module.WelcomeScreen,
  })),
)
const AgeVerificationScreen = lazy(() =>
  import('@/features/verification/screens/AgeVerificationScreen').then((module) => ({
    default: module.AgeVerificationScreen,
  })),
)
const OptionalVerificationScreen = lazy(() =>
  import('@/features/verification/screens/OptionalVerificationScreen').then((module) => ({
    default: module.OptionalVerificationScreen,
  })),
)
const ProviderSandboxScreen = lazy(() =>
  import('@/features/verification/screens/ProviderSandboxScreen').then((module) => ({
    default: module.ProviderSandboxScreen,
  })),
)
const VerificationCenterScreen = lazy(() =>
  import('@/features/verification/screens/VerificationCenterScreen').then((module) => ({
    default: module.VerificationCenterScreen,
  })),
)
const DesignKitScreen = lazy(() =>
  import('@/features/design-kit/DesignKitScreen').then((module) => ({
    default: module.DesignKitScreen,
  })),
)
const HomeScreen = lazy(() =>
  import('@/features/home/HomeScreen').then((m) => ({ default: m.HomeScreen })),
)
const FavoritesScreen = lazy(() =>
  import('@/features/home/FavoritesScreen').then((m) => ({ default: m.FavoritesScreen })),
)
const PlaceScreen = lazy(() =>
  import('@/features/places/PlaceScreen').then((m) => ({ default: m.PlaceScreen })),
)
const DiscoverScreen = lazy(() =>
  import('@/features/discover/DiscoverScreen').then((module) => ({
    default: module.DiscoverScreen,
  })),
)
const ProfileScreen = lazy(() =>
  import('@/features/profile/ProfileScreen').then((module) => ({ default: module.ProfileScreen })),
)
const SettingsScreen = lazy(() =>
  import('@/features/settings/SettingsScreen').then((module) => ({
    default: module.SettingsScreen,
  })),
)
const ThemesScreen = lazy(() =>
  import('@/features/themes/ThemesScreen').then((module) => ({ default: module.ThemesScreen })),
)
const TonightScreen = lazy(() =>
  import('@/features/tonight/TonightScreen').then((module) => ({ default: module.TonightScreen })),
)

function ScreenLoading() {
  const { t } = useTranslation()
  return (
    <div role="status" className="p-6">
      <span className="sr-only">{t('common.loading')}</span>
      <Skeleton className="h-32 w-full" />
    </div>
  )
}

/** Every screen gets its own error boundary (PRD 3.4). */
const screen = (Screen: ComponentType) => (
  <ScreenErrorBoundary>
    <Suspense fallback={<ScreenLoading />}>
      <Screen />
    </Suspense>
  </ScreenErrorBoundary>
)
const PhotoVerification = () => <OptionalVerificationScreen level="photo" />
const IdentityVerification = () => <OptionalVerificationScreen level="identity" />
const verifiedScreen = (Screen: ComponentType, action: AgeGatedAction) => (
  <AgeVerifiedRoute action={action}>{screen(Screen)}</AgeVerifiedRoute>
)

// Pure SPA routes (no SSR), WebView-compatible (PRD 3.3 point 2).
export const routes: RouteObject[] = [
  {
    path: 'welcome',
    element: <RedirectIfOnboarded>{screen(WelcomeScreen)}</RedirectIfOnboarded>,
    errorElement: <RouteErrorScreen />,
  },
  {
    path: 'onboarding',
    element: <RedirectIfOnboarded>{screen(OnboardingScreen)}</RedirectIfOnboarded>,
    errorElement: <RouteErrorScreen />,
  },
  {
    path: 'login',
    element: <RedirectIfOnboarded>{screen(LoginScreen)}</RedirectIfOnboarded>,
    errorElement: <RouteErrorScreen />,
  },
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
  // Public guides for people and venues (roadmap R1): no login, same public frame.
  {
    path: 'guia',
    element: <PublicLayout />,
    errorElement: <RouteErrorScreen />,
    children: [
      { index: true, element: screen(UserGuideScreen) },
      { path: 'locales', element: screen(VenueGuideScreen) },
    ],
  },
  // Venue invitation links (roadmap R3): public, nothing is redeemed before signing in.
  {
    path: 'invitacion/:code',
    element: <PublicLayout />,
    errorElement: <RouteErrorScreen />,
    children: [{ index: true, element: screen(InviteLandingScreen) }],
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
      { path: 'venues', element: screen(AdminVenuesScreen) },
      { path: 'partners', element: screen(AdminPartnersScreen) },
      { path: 'venue-photos', element: screen(AdminVenuePhotosScreen) },
      { path: 'settings', element: screen(AdminSettingsScreen) },
    ],
  },
  {
    element: (
      <RequireOnboarded allowSuspended>
        <AppShell />
      </RequireOnboarded>
    ),
    errorElement: <RouteErrorScreen />,
    children: [
      { path: 'profile/verification', element: screen(VerificationCenterScreen) },
      { path: 'verification/age', element: screen(AgeVerificationScreen) },
      { path: 'verification/photo', element: screen(PhotoVerification) },
      { path: 'verification/identity', element: screen(IdentityVerification) },
      { path: 'verification/sandbox', element: screen(ProviderSandboxScreen) },
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
      { index: true, element: <Navigate to="/home" replace /> },
      { path: 'home', element: screen(HomeScreen), handle: { wide: true } },
      { path: 'favorites', element: screen(FavoritesScreen) },
      { path: 'places/:placeId', element: screen(PlaceScreen) },
      { path: 'discover', element: screen(DiscoverScreen), handle: { fullBleed: true } },
      { path: 'tonight', element: screen(TonightScreen) },
      { path: 'tonight/swipe', element: verifiedScreen(SwipeScreen, 'view_profiles') },
      { path: 'tonight/swipe/:placeId', element: verifiedScreen(SwipeScreen, 'view_profiles') },
      { path: 'tonight/likes', element: verifiedScreen(LikesYouScreen, 'view_profiles') },
      { path: 'people/:personId', element: verifiedScreen(PersonScreen, 'view_profiles') },
      { path: 'chats', element: verifiedScreen(ChatsScreen, 'chat') },
      { path: 'chats/:matchId', element: verifiedScreen(ChatScreen, 'chat') },
      { path: 'events/new', element: verifiedScreen(CreateEventScreen, 'create_event') },
      { path: 'profile', element: screen(ProfileScreen) },
      { path: 'profile/themes', element: screen(ThemesScreen) },
      { path: 'profile/settings', element: screen(SettingsScreen) },
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
      { path: 'venue/invitacion', element: screen(RedeemInviteScreen) },
      { path: 'venue/:placeId', element: screen(VenueDetailScreen) },
      { path: 'dev/kit', element: screen(DesignKitScreen) },
    ],
  },
  { path: '*', element: <NotFoundScreen /> },
]

export const createAppRouter = () => createBrowserRouter(routes)
