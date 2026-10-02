import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

export function Section({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('px-safe mt-8', className)}>
      <h2 className="font-label mb-3 text-xs font-semibold tracking-[0.14em] text-muted-foreground uppercase">
        {title}
      </h2>
      {children}
    </section>
  )
}
