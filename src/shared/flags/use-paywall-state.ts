import { usePlatform } from '@/platform'
import { useRoles } from '@/shared/session/use-roles'
import { resolvePaywallState, type PaywallState } from './paywall'
import { useFeatureFlags } from './use-feature-flag'

export function usePaywallState(): PaywallState {
  const { data: flags } = useFeatureFlags()
  const roles = useRoles()
  const { runtime } = usePlatform()
  if (!flags) return 'hidden'
  const state = resolvePaywallState(flags, roles)
  // Block 11b: inside the native app digital benefits are only sold through the stores
  // (never Stripe). Without store payments the app shows "coming soon" instead.
  if (runtime === 'native' && state === 'checkout' && flags.store_payments_enabled !== 'on')
    return 'coming_soon'
  return state
}
