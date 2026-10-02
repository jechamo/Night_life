import { GenericErrorFallback } from '@/shared/errors/ScreenErrorBoundary'

/** Router-level error element: generic message only (PRD 6.15 A10). */
export function RouteErrorScreen() {
  return (
    <div className="pt-safe flex min-h-dvh items-center justify-center">
      <GenericErrorFallback onRetry={() => window.location.reload()} />
    </div>
  )
}
