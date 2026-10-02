import { Switch as SwitchPrimitive } from 'radix-ui'
import type { ComponentProps } from 'react'
import { cn } from '@/shared/lib/cn'

/** Accessible switch. Wrap it in a <label> row so the whole row is the touch target. */
export function Switch({ className, ...props }: ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      className={cn(
        'relative inline-flex h-8 w-14 shrink-0 items-center rounded-full border border-border bg-surface-raised',
        'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
        className,
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        className={cn(
          'block size-6 translate-x-1 rounded-full bg-foreground transition-transform duration-200',
          'data-[state=checked]:translate-x-[1.6rem] data-[state=checked]:bg-primary-foreground',
        )}
      />
    </SwitchPrimitive.Root>
  )
}
