import type { FeatureFlags, FlagKey } from '@/shared/flags/flags'
import type { EntitlementKey } from '@/shared/entitlements/entitlements'
import type { Role } from '@/shared/session/roles'
import type { ProviderQuota, ProviderQuotaChange } from '../model/provider-quota'
import type { CatalogueRow } from '../model/venue-csv'
import type { AdminVenue, VenueInput } from '../model/venue'
import type {
  ContractInput,
  Invitation,
  PartnerAccount,
  PartnerInput,
} from '@/features/venue-panel/model/partners'
import type { PhotoStatus } from '@/features/places/model/showcase'
import type { Result } from '@/shared/lib/result'

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
  'escalations',
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
    | 'sponsorship_slots'
  value: number
  min: number
  max: number
}

export interface OsmImportResult {
  found: number
  added: number
  updated: number
  /** Edited in Admin, so left untouched. */
  kept: number
  skipped: number
}

export interface CatalogueImportResult {
  added: number
  updated: number
  skipped: number
}

export type TestTool =
  | 'generate_test_city'
  | 'fill_venue'
  | 'test_like_me'
  | 'send_test_messages'
  | 'simulate_stripe_webhook'
  | 'simulate_yoti_webhook'
  | 'expire_everything'
  | 'import_events'
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
  providerQuotas(): Promise<ProviderQuota[]>
  configureProvider(change: ProviderQuotaChange): Promise<void>
  /** Stores the public Mapbox token (pk.*, URL-restricted) server-side; '' clears it. */
  setMapToken(token: string): Promise<void>
  runTestTool(tool: TestTool): Promise<string>
  /** Own catalogue (Block 7): venues are created and edited here, never copied from Google. */
  venues(query?: string): Promise<AdminVenue[]>
  /** Imports a city's bars, pubs and clubs from OpenStreetMap (ODbL); manual edits are kept. */
  importOsmVenues(city: string): Promise<OsmImportResult>
  /** Adds or updates rows from an editorial CSV. Never deletes. Google links are not accepted. */
  importCatalogue(rows: readonly CatalogueRow[]): Promise<CatalogueImportResult>
  deleteVenue(id: string): Promise<void>
  createVenue(input: VenueInput): Promise<string>
  updateVenue(id: string, input: VenueInput): Promise<void>
  /** Test fixtures (is_test): demo venues per city, fake crowd and imported events. */
  seedTestVenues(): Promise<number>
  fillTestVenue(id: string, count: number): Promise<number>
  importTestEvents(city: string, count: number): Promise<number>
  setSimulatedRoles(roles: readonly Role[]): Promise<void>
  /** Roadmap R3: partner companies, offline contracts, invitations and venue managers. */
  partners(): Promise<PartnerAccount[]>
  savePartner(input: PartnerInput): Promise<Result<string, 'duplicate_tax_id' | 'invalid'>>
  linkPartnerVenue(
    accountId: string,
    venueId: string,
    link: boolean,
  ): Promise<Result<void, 'linked_elsewhere' | 'already_sponsored'>>
  createContract(input: ContractInput): Promise<Result<string, 'duplicate_reference' | 'invalid'>>
  contractAction(
    contractId: string,
    action: 'activate' | 'end',
  ): Promise<Result<void, 'already_sponsored' | 'invalid_state'>>
  inviteVenueOwner(venueId: string): Promise<Invitation>
  revokeInvitation(inviteId: string): Promise<void>
  removeManager(venueId: string, userId: string): Promise<void>
  // Roadmap R4: moderation of venue photos (role + aal2, audited).
  venuePhotos(status: PhotoStatus): Promise<AdminVenuePhoto[]>
  reviewVenuePhoto(photoId: string, approve: boolean, reason?: string): Promise<void>
  /** `mock` = simulated back-office (roles can be simulated); `live` = Supabase. */
  readonly mode: 'mock' | 'live'
  /** Second factor (TOTP, PRD 6.12 E): enrolment and the level of this session. */
  mfaStatus(): Promise<{ enrolled: boolean; verified: boolean }>
  enrollMfa(): Promise<{ qrCode: string; secret: string; uri: string }>
  verifyMfa(code: string): Promise<boolean>
}

export interface AdminVenuePhoto {
  id: string
  venueId: string
  venueName: string
  city: string
  url: string
  status: PhotoStatus
  reason: string | null
  isCover: boolean
  createdAt: string
  isTest: boolean
}
