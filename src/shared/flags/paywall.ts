import { hasRole, type Role } from '@/shared/session/roles'
import type { FeatureFlags } from './flags'

/**
 * What the paywall shows (PRD 6.13 point 6):
 * - `hidden`: no premium UI at all.
 * - `coming_soon`: "Próximamente" (+ optional "Avísame" with commercial consent).
 * - `checkout`: real Stripe checkout (test or live keys, chosen by the server).
 */
export type PaywallState = 'hidden' | 'coming_soon' | 'checkout'

export function canPurchase(flags: FeatureFlags, roles: readonly Role[]): boolean {
  if (flags.premium_enabled !== 'on' || flags.payments_mode === 'disabled') return false
  switch (flags.payments_audience) {
    case 'all':
      return true
    case 'testers':
      return hasRole(roles, 'tester')
    case 'none':
      return false
  }
}

export function resolvePaywallState(flags: FeatureFlags, roles: readonly Role[]): PaywallState {
  if (flags.premium_enabled !== 'on') return 'hidden'
  if (canPurchase(flags, roles)) return 'checkout'
  // A visible paywall without a way to buy would be a dead end (and "audience = none"
  // means nobody sees payment), so it degrades to "coming soon".
  return flags.paywall_visibility === 'hidden' ? 'hidden' : 'coming_soon'
}
