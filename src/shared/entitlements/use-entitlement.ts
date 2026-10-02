import { useQuery } from '@tanstack/react-query'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { useServices } from '@/shared/services/ServicesProvider'
import { hasEntitlement, type EntitlementKey } from './entitlements'

export const entitlementsQueryKey = ['entitlements', 'mine'] as const

/**
 * "Does the user have advantage X?" (PRD 6.13). Denied while loading, on error
 * or when `premium_enabled` is off. This only shapes the UI; the server enforces
 * the same rule with `has_entitlement()`.
 */
export function useEntitlement(key: EntitlementKey): { granted: boolean; isLoading: boolean } {
  const { entitlements } = useServices()
  const premiumEnabled = useFeatureFlag('premium_enabled') === 'on'
  const { data, isLoading } = useQuery({
    queryKey: entitlementsQueryKey,
    queryFn: () => entitlements.getMine(),
  })
  return {
    granted: premiumEnabled && !!data && hasEntitlement(data, key, new Date()),
    isLoading,
  }
}
