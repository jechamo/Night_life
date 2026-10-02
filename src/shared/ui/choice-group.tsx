import { ToggleGroup } from 'radix-ui'
import { cn } from '@/shared/lib/cn'

export interface Choice<T extends string> {
  value: T
  label: string
}

const itemClass =
  'touch-target font-label rounded-full border px-4 text-sm font-medium transition-opacity data-[state=off]:border-border data-[state=off]:bg-surface data-[state=off]:text-foreground data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground'

/** Single choice as pill buttons (radio semantics via Radix ToggleGroup). */
export function SingleChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T | undefined
  options: readonly Choice<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value ?? ''}
      onValueChange={(next) => {
        const option = options.find((o) => o.value === next)
        if (option) onChange(option.value)
      }}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} className={itemClass}>
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}

/** Multiple choice as pill buttons. */
export function MultiChoice<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: readonly T[]
  options: readonly Choice<T>[]
  onChange: (value: T[]) => void
  className?: string
}) {
  return (
    <ToggleGroup.Root
      type="multiple"
      aria-label={label}
      value={[...value]}
      onValueChange={(next) =>
        onChange(options.filter((o) => next.includes(o.value)).map((o) => o.value))
      }
      className={cn('flex flex-wrap gap-2', className)}
    >
      {options.map((o) => (
        <ToggleGroup.Item key={o.value} value={o.value} className={itemClass}>
          {o.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
