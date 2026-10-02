import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('rounded-theme border border-border bg-surface p-4 text-foreground', className)}
      {...props}
    />
  )
}

/** Floating glass card (PRD 8.1: the UI floats over the map in glass layers). */
export function GlassCard({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('glass rounded-theme p-4 text-foreground', className)} {...props} />
}
