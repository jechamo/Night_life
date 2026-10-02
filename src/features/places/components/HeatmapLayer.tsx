import { memo } from 'react'
import { project } from '../model/projection'
import type { LatLng, Place } from '../model/types'

/**
 * Live heatmap (PRD 5.3, 8.1): one glow per place, sized by crowd and painted with
 * the theme heatmap ramp. It "breathes" with an opacity-only loop.
 */
export const HeatmapLayer = memo(function HeatmapLayer({
  places,
  center,
}: {
  places: readonly Place[]
  center: LatLng
}) {
  return (
    // Subtle on purpose (PRD 8.1: no loud neon); the pins carry the information.
    <div aria-hidden className="pointer-events-none absolute inset-0 opacity-50 mix-blend-screen">
      {places
        .filter((p) => p.stats.people > 0)
        .map((place, i) => {
          const { x, y } = project(place.location, center)
          const size = 70 + Math.sqrt(place.stats.people) * 16
          return (
            <span
              key={place.id}
              className="nl-breathe absolute rounded-full"
              style={{
                left: x - size / 2,
                top: y - size / 2,
                width: size,
                height: size,
                animationDelay: `${(i % 5) * 0.6}s`,
                background:
                  'radial-gradient(circle, var(--nl-heatmap-3) 0%, var(--nl-heatmap-2) 30%, var(--nl-heatmap-1) 55%, var(--nl-heatmap-0) 70%)',
              }}
            />
          )
        })}
    </div>
  )
})
