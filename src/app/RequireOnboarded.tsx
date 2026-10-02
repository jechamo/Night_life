import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useOnboardingStatus } from '@/features/onboarding/hooks/use-onboarding-status'

/** The app is only reachable after the mandatory onboarding (PRD 5.2). */
export function RequireOnboarded({ children }: { children: ReactNode }) {
  const { data, isPending } = useOnboardingStatus()
  if (isPending) return <div className="min-h-dvh bg-background" aria-busy="true" />
  if (data !== 'completed') return <Navigate to="/welcome" replace />
  return children
}
