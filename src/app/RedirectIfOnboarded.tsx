import type { ReactNode } from 'react'
import { Navigate } from 'react-router'
import { useOnboardingStatus } from '@/features/onboarding/hooks/use-onboarding-status'
import { GenericErrorFallback } from '@/shared/errors/ScreenErrorBoundary'

/** Keep the phone form mounted while Auth refreshes the onboarding query. */
export function RedirectIfOnboarded({ children }: { children: ReactNode }) {
  const { data, isPending, isError, refetch } = useOnboardingStatus()
  if (data === 'completed' && !isError) return <Navigate to="/home" replace />
  return (
    <>
      {isPending && <div className="min-h-dvh bg-background" aria-busy="true" />}
      {isError && <GenericErrorFallback onRetry={() => void refetch()} />}
      <div hidden={isPending || isError}>{children}</div>
    </>
  )
}
