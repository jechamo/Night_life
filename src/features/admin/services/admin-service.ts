import type { FeatureFlags, FlagKey } from '@/shared/flags/flags'
import type { EntitlementKey } from '@/shared/entitlements/entitlements'
import type { Role } from '@/shared/session/roles'

export interface AdminDashboard {
  users: number
  ageVerifiedPercent: number
  matchesToday: number
  pendingReports: number
  pendingVerifications: number
  pendingClaims: number
  openDataRequests: number
  testRevenueCents: number
}

/** Each admin list row is a flat record: id + status + displayable fields. */
export interface AdminRow {
  id: string
  title: string
  subtitle: string
  status: string
  createdAt: string
  /** Extra short facts shown as chips (already safe, non-sensitive text). */
  facts: readonly string[]
}

export const ADMIN_SECTIONS = [
  'users',
  'verifications',
  'reports',
  'appeals',
  'bans',
  'claims',
  'events',
  'sponsorships',
  'subscriptions',
  'entitlements',
  'promoCodes',
  'paymentEvents',
  'dataRequests',
  'legalDocs',
  'audit',
] as const
export type AdminSection = (typeof ADMIN_SECTIONS)[number]

export interface AdminSetting {
  key:
    | 'free_daily_likes'
    | 'age_threshold'
    | 'check_in_radius_m'
    | 'stats_min_people'
    | 'event_confirmations'
    | 'reports_strike_window_h'
  value: number
  min: number
  max: number
}

export type TestTool =
  | 'generate_test_city'
  | 'fill_venue'
  | 'test_like_me'
  | 'send_test_messages'
  | 'simulate_stripe_webhook'
  | 'simulate_yoti_webhook'
  | 'expire_everything'
  | 'reset_likes'
  | 'simulate_suspension'
  | 'purge_test_data'

/**
 * Port for the admin panel (PRD 6.10). Every action is checked server-side (role +
 * MFA, and `test_tools_enabled` for test tools) and written to the audit log.
 */
export interface AdminService {
  dashboard(): Promise<AdminDashboard>
  list(section: AdminSection): Promise<AdminRow[]>
  act(section: AdminSection, id: string, action: string, note?: string): Promise<void>
  setFlag<K extends FlagKey>(key: K, value: FeatureFlags[K]): Promise<void>
  settings(): Promise<AdminSetting[]>
  setSetting(key: AdminSetting['key'], value: number): Promise<void>
  createPromoCode(input: { productCode: string; days: number; maxUses: number }): Promise<string>
  grantEntitlement(input: { user: string; key: EntitlementKey; days: number | null }): Promise<void>
  runTestTool(tool: TestTool): Promise<string>
  setSimulatedRoles(roles: readonly Role[]): Promise<void>
  /** `mock` = simulated back-office (roles can be simulated); `live` = Supabase. */
  readonly mode: 'mock' | 'live'
  /** Second factor (TOTP, PRD 6.12 E): enrolment and the level of this session. */
  mfaStatus(): Promise<{ enrolled: boolean; verified: boolean }>
  enrollMfa(): Promise<{ qrCode: string; secret: string; uri: string }>
  verifyMfa(code: string): Promise<boolean>
}
