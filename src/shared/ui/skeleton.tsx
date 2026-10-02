import { cn } from '@/shared/lib/cn'

/** Loading placeholder with a shimmer (transform only; fades when motion is reduced). */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('nl-shimmer relative overflow-hidden rounded-xl bg-surface-raised', className)}
    />
  )
}
