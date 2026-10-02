import { useQuery } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import { SAFE_FLAG_DEFAULTS, type FeatureFlags, type FlagKey } from './flags'

export const featureFlagsQueryKey = ['feature-flags'] as const

export function useFeatureFlags() {
  const { flags } = useServices()
  return useQuery({
    queryKey: featureFlagsQueryKey,
    queryFn: () => flags.getAll(),
    staleTime: 60_000,
  })
}

/**
 * The only way UI code reads a flag (PRD 3.2). While loading or on error it
 * returns the SAFE default, so gated features stay closed until proven open.
 */
export function useFeatureFlag<K extends FlagKey>(key: K): FeatureFlags[K] {
  const { data } = useFeatureFlags()
  return (data ?? SAFE_FLAG_DEFAULTS)[key]
}
