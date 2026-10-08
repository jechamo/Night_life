import { z } from 'zod'

/**
 * Feature flags stored in `app_settings` (PRD 6.13, 6.14). Each flag has its own
 * schema and a SAFE default. "Safe" means fail-closed (PRD 6.15 A10): if flags
 * cannot be loaded or a value is invalid, payments are off, test tools are off
 * and verification runs in live mode (never a sandbox bypass).
 */
const onOff = z.enum(['on', 'off'])

export const FLAG_SCHEMAS = {
  payments_mode: z.enum(['disabled', 'test', 'live']),
  payments_audience: z.enum(['none', 'testers', 'all']),
  paywall_visibility: z.enum(['hidden', 'coming_soon', 'visible']),
  premium_enabled: onOff,
  paid_dm_enabled: onOff,
  sponsorship_self_service_enabled: onOff,
  flash_alerts_push_enabled: onOff,
  flash_alcohol_allowed: onOff,
  verification_mode: z.enum(['sandbox', 'live']),
  verification_provider: z.enum(['veriff', 'yoti', 'simulator']),
  test_tools_enabled: onOff,
  // ADR 0008: store billing, sponsored swipe cards and travel mode (Block 11).
  store_payments_enabled: onOff,
  sponsored_cards_enabled: onOff,
  travel_mode_enabled: onOff,
  // Roadmap 2026-10 R1: returning users sign in with an email code instead of SMS.
  email_login_enabled: onOff,
  // Roadmap 2026-10 R2: «Cómo está ahora» (crowd, queue and music voted with check-in).
  live_status_enabled: onOff,
  // Roadmap 2026-10 R3: partner companies, contracts, invitations and venue teams.
  venue_partners_enabled: onOff,
  venue_showcase_enabled: onOff,
  venue_bookings_enabled: onOff,
} as const

export type FlagKey = keyof typeof FLAG_SCHEMAS
export type FeatureFlags = { [K in FlagKey]: z.infer<(typeof FLAG_SCHEMAS)[K]> }
export const FLAG_KEYS = Object.keys(FLAG_SCHEMAS) as FlagKey[]

export const SAFE_FLAG_DEFAULTS: Readonly<FeatureFlags> = {
  payments_mode: 'disabled',
  payments_audience: 'none',
  paywall_visibility: 'hidden',
  premium_enabled: 'off',
  paid_dm_enabled: 'off',
  sponsorship_self_service_enabled: 'off',
  flash_alerts_push_enabled: 'off',
  flash_alcohol_allowed: 'off',
  verification_mode: 'live',
  verification_provider: 'simulator',
  test_tools_enabled: 'off',
  store_payments_enabled: 'off',
  sponsored_cards_enabled: 'off',
  travel_mode_enabled: 'off',
  email_login_enabled: 'off',
  live_status_enabled: 'off',
  venue_partners_enabled: 'off',
  venue_showcase_enabled: 'off',
  venue_bookings_enabled: 'off',
}

/** Initial values from PRD 6.13 (what the admin seeds in `app_settings`). */
export const INITIAL_FLAG_VALUES: Readonly<FeatureFlags> = {
  payments_mode: 'test',
  payments_audience: 'testers',
  paywall_visibility: 'coming_soon',
  premium_enabled: 'on',
  paid_dm_enabled: 'off',
  sponsorship_self_service_enabled: 'off',
  flash_alerts_push_enabled: 'off',
  flash_alcohol_allowed: 'off',
  verification_mode: 'sandbox',
  verification_provider: 'veriff',
  test_tools_enabled: 'on',
  store_payments_enabled: 'off',
  sponsored_cards_enabled: 'off',
  travel_mode_enabled: 'off',
  email_login_enabled: 'off',
  live_status_enabled: 'off',
  venue_partners_enabled: 'off',
  venue_showcase_enabled: 'off',
  venue_bookings_enabled: 'off',
}

/**
 * Validates untrusted flag data key by key: one bad value only resets that flag
 * to its safe default instead of discarding the whole set.
 */
export function parseFlags(raw: unknown): FeatureFlags {
  const source = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {}
  const result: Record<string, unknown> = {}
  for (const key of FLAG_KEYS) {
    const parsed = FLAG_SCHEMAS[key].safeParse(source[key])
    result[key] = parsed.success ? parsed.data : SAFE_FLAG_DEFAULTS[key]
  }
  return result as FeatureFlags
}
