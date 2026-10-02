import { cn } from '@/shared/lib/cn'
import { LivePulse } from '@/shared/ui/live-pulse'

const HOTSPOTS = [
  { top: '28%', left: '22%', size: 'size-3' },
  { top: '40%', left: '64%', size: 'size-4' },
  { top: '55%', left: '38%', size: 'size-2.5' },
  { top: '20%', left: '74%', size: 'size-2.5' },
  { top: '62%', left: '78%', size: 'size-3' },
] as const

/**
 * Fallback "living city" hero while a theme has no signature image: a street grid
 * with live hotspots, drawn only with theme tokens (works in all 5 themes).
 */
export function LiveCityArt({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
    >
      <div className="absolute inset-0 [background-image:linear-gradient(var(--nl-border)_1px,transparent_1px),linear-gradient(90deg,var(--nl-border)_1px,transparent_1px)] [background-size:44px_44px] opacity-60 [transform:perspective(600px)_rotateX(55deg)_scale(1.6)] [transform-origin:50%_0%]" />
      {HOTSPOTS.map((spot) => (
        <span
          key={`${spot.top}-${spot.left}`}
          className="absolute"
          style={{ top: spot.top, left: spot.left }}
        >
          <span className="absolute -inset-8 rounded-full bg-primary opacity-25 blur-2xl" />
          <LivePulse className={spot.size} />
        </span>
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-background via-background/70 to-transparent" />
    </div>
  )
}
