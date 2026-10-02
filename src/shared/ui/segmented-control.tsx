import { motion } from 'motion/react'
import { ToggleGroup } from 'radix-ui'
import { useId } from 'react'
import { cn } from '@/shared/lib/cn'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'

export interface SegmentedOption<T extends string> {
  value: T
  label: string
}

/** "Todo / Locales / Eventos" style selector with a sliding indicator (transform only). */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string
  value: T
  options: readonly SegmentedOption<T>[]
  onChange: (value: T) => void
  className?: string
}) {
  const id = useId()
  const tokens = useMotionTokens()
  return (
    <ToggleGroup.Root
      type="single"
      aria-label={label}
      value={value}
      // Radix emits "" when the active item is pressed again; keep one always selected.
      onValueChange={(next) => {
        const option = options.find((o) => o.value === next)
        if (option) onChange(option.value)
      }}
      className={cn('glass inline-flex rounded-full p-1', className)}
    >
      {options.map((option) => (
        <ToggleGroup.Item
          key={option.value}
          value={option.value}
          className={cn(
            'touch-target font-label relative isolate rounded-full px-4 text-sm font-medium transition-opacity',
            option.value === value ? 'text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          {option.value === value && (
            <motion.span
              layoutId={`${id}-indicator`}
              className="absolute inset-0 -z-10 rounded-full bg-primary"
              transition={tokens.spring.snappy}
            />
          )}
          {option.label}
        </ToggleGroup.Item>
      ))}
    </ToggleGroup.Root>
  )
}
