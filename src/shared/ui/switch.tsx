import { Switch as SwitchPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/cn'

/** Accessible switch. Wrap it in a <label> row so the whole row is the touch target. */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'touch-target group relative inline-flex h-11 w-14 shrink-0 items-center rounded-full',
        className,
      )}
      {...props}
    >
      <span
        aria-hidden
        className="absolute inset-x-0 inset-y-1.5 rounded-full border border-border bg-surface-raised group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary"
      />
      <SwitchPrimitive.Thumb
        className={cn(
          'relative block size-6 translate-x-1 rounded-full bg-foreground transition-transform duration-200',
          'data-[state=checked]:translate-x-[1.6rem] data-[state=checked]:bg-primary-foreground',
        )}
      />
    </SwitchPrimitive.Root>
  )
}
