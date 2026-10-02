import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useAccountStatus } from '@/features/moderation/hooks/use-moderation'
import { useOnboardingStatus } from '@/features/onboarding/hooks/use-onboarding-status'

/**
 * The app is only reachable after the mandatory onboarding (PRD 5.2), and a suspended
 * account only sees the explained suspension screen (PRD 6.9). `allowSuspended` keeps
 * the admin panel reachable for the tester who simulates a suspension.
 */
export function RequireOnboarded({
  children,
  allowSuspended = false,
}: {
  children: ReactNode
  allowSuspended?: boolean
}) {
  const { data, isPending } = useOnboardingStatus()
  const status = useAccountStatus()
  if (isPending || (!allowSuspended && status.isPending))
    return <div className="min-h-dvh bg-background" aria-busy="true" />
  if (data !== 'completed') return <Navigate to="/welcome" replace />
  if (!allowSuspended && status.data === 'suspended') return <Navigate to="/suspended" replace />
  return children
}
