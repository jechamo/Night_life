import { useRoles } from '@/shared/session/use-roles'
import { resolvePaywallState, type PaywallState } from './paywall'
import { useFeatureFlags } from './use-feature-flag'

export function usePaywallState(): PaywallState {
  const { data: flags } = useFeatureFlags()
  const roles = useRoles()
  return flags ? resolvePaywallState(flags, roles) : 'hidden'
}
