import { cn } from '@/shared/lib/cn'

/** "En directo" pulse (PRD 8.1). Pure CSS; degrades to a fade when motion is reduced. */
export function LivePulse({ className }: { className?: string }) {
  return (
    <span className={cn('relative inline-flex size-2.5 shrink-0', className)} aria-hidden>
      <span className="nl-live-ring absolute inset-0 rounded-full bg-live" />
      <span className="relative inline-flex size-full rounded-full bg-live" />
    </span>
  )
}
