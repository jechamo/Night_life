import type { ReactNode } from 'react'
import type { FeatureFlags, FlagKey } from './flags'
import { useFeatureFlags } from './use-feature-flag'

/**
 * Renders children only when a flag has the expected value. While flags load it
 * renders `pending` (not the fallback), so a slow network never flashes a redirect;
 * on error it fails closed and renders `fallback`.
 */
export function FeatureGate<K extends FlagKey>({
  flag,
  is,
  children,
  fallback = null,
  pending = null,
}: {
  flag: K
  is: FeatureFlags[K]
  children: ReactNode
  fallback?: ReactNode
  pending?: ReactNode
}) {
  const { data, isPending } = useFeatureFlags()
  if (isPending) return pending
  return data?.[flag] === is ? children : fallback
}
