import { Check } from 'lucide-react'
import { Checkbox as CheckboxPrimitive } from 'radix-ui'
import { useId, type ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Labelled checkbox. Never pre-checked by default (PRD 6.1): `checked` is always
 * controlled by the caller and starts false. The whole row is the touch target.
 */
export function CheckboxField({
  checked,
  onCheckedChange,
  children,
  className,
}: {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  children: ReactNode
  className?: string
}) {
  const id = useId()
  return (
    <div className={cn('flex min-h-11 items-start gap-3', className)}>
      <CheckboxPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="touch-target group flex shrink-0 items-center justify-center rounded-md"
      >
        <span className="flex size-6 items-center justify-center rounded-md border-2 border-muted-foreground bg-surface group-data-[state=checked]:border-primary group-data-[state=checked]:bg-primary">
          <CheckboxPrimitive.Indicator className="text-primary-foreground">
            <Check className="size-4" strokeWidth={3} aria-hidden />
          </CheckboxPrimitive.Indicator>
        </span>
      </CheckboxPrimitive.Root>
      <label htmlFor={id} className="min-h-11 flex-1 cursor-pointer py-2.5 text-sm leading-6">
        {children}
      </label>
    </div>
  )
}
