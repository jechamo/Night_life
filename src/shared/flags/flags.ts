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
  verification_mode: z.enum(['sandbox', 'live']),
  test_tools_enabled: onOff,
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
  verification_mode: 'live',
  test_tools_enabled: 'off',
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
  verification_mode: 'sandbox',
  test_tools_enabled: 'on',
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
