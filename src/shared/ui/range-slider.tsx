import { Slider } from 'radix-ui'

/** Two-thumb range slider. Each 28 px visual thumb has a real 44 px hit area. */
export function RangeSlider({
  label,
  thumbLabels,
  min,
  max,
  value,
  onChange,
  formatValue = String,
}: {
  label: string
  thumbLabels: [string, string]
  min: number
  max: number
  value: [number, number]
  onChange: (value: [number, number]) => void
  formatValue?: (n: number) => string
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-display text-lg font-semibold text-primary">
          {formatValue(value[0])} – {formatValue(value[1])}
        </span>
      </div>
      <Slider.Root
        min={min}
        max={max}
        step={1}
        minStepsBetweenThumbs={1}
        value={value}
        onValueChange={(next) => onChange([next[0] ?? min, next[1] ?? max])}
        className="relative flex h-11 touch-none items-center select-none"
      >
        <Slider.Track className="relative h-1.5 grow rounded-full bg-surface-raised">
          <Slider.Range className="absolute h-full rounded-full bg-primary" />
        </Slider.Track>
        {thumbLabels.map((thumbLabel, index) => (
          <Slider.Thumb
            key={thumbLabel}
            aria-label={thumbLabel}
            aria-valuetext={formatValue(value[index] ?? min)}
            className="flex size-11 items-center justify-center rounded-full"
          >
            <span
              aria-hidden
              className="block size-7 rounded-full border-2 border-primary bg-foreground shadow-[0_0_16px_var(--nl-glow)]"
            />
          </Slider.Thumb>
        ))}
      </Slider.Root>
    </div>
  )
}
