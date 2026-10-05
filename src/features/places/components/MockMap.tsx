import { Minus, Plus, LocateFixed } from 'lucide-react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { forwardRef, useCallback, useEffect, useImperativeHandle } from 'react'
import { useTranslation } from 'react-i18next'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { Button } from '@/shared/ui/button'
import { project, WORLD_SIZE } from '../model/projection'
import type { LatLng, Place } from '../model/types'
import { HeatmapLayer } from './HeatmapLayer'
import { MockMapArtwork } from './MockMapArtwork'
import { MAP_TILT_DEG, PlacePin } from './PlacePin'

const MIN_SCALE = 0.6
const MAX_SCALE = 2.2
const FOCUS_SCALE = 1.35
const PAN_LIMIT = WORLD_SIZE / 2
const COS_TILT = Math.cos((MAP_TILT_DEG * Math.PI) / 180)

export interface MockMapHandle {
  flyTo: (place: Place) => void
  recenter: () => void
}

/**
 * Mock 3D night map for Blocks 3-6 (Mapbox Standard "night" arrives in Block 7).
 * Camera = translate + scale of a tilted plane, animated with springs (transform only,
 * PRD 3.2). Pan by dragging, zoom with buttons; every pin is a real button.
 */
export const MockMap = forwardRef<
  MockMapHandle,
  {
    places: readonly Place[]
    center: LatLng
    selectedId: string | null
    onSelect: (id: string | null) => void
    /** Pixels of the screen bottom covered by the sheet, so the focused pin stays visible. */
    focusOffsetY?: number
  }
>(function MockMap({ places, center, selectedId, onSelect, focusOffsetY = 0 }, ref) {
  const { t } = useTranslation()
  const tokens = useMotionTokens()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const inverseScale = useTransform(scale, (s) => 1 / s)

  const camera = useCallback(
    (target: { x: number; y: number; scale: number }) => {
      const transition = tokens.reduced ? { duration: 0 } : tokens.spring.sheet
      void animate(x, target.x, transition)
      void animate(y, target.y, transition)
      void animate(scale, target.scale, transition)
    },
    [x, y, scale, tokens],
  )

  const flyTo = useCallback(
    (place: Place) => {
      // Camera flight (PRD 8.4 signature moment): bring the pin to the visible centre.
      const p = project(place.location, center)
      const s = Math.max(scale.get(), FOCUS_SCALE)
      camera({
        x: -(p.x - WORLD_SIZE / 2) * s,
        y: -(p.y - WORLD_SIZE / 2) * s * COS_TILT - focusOffsetY / 2,
        scale: s,
      })
    },
    [camera, center, focusOffsetY, scale],
  )

  useImperativeHandle(ref, () => ({ flyTo, recenter: () => camera({ x: 0, y: 0, scale: 1 }) }), [
    flyTo,
    camera,
  ])

  // Fly when the selection changes from outside (list, search, deep link).
  useEffect(() => {
    const place = places.find((p) => p.id === selectedId)
    if (place) flyTo(place)
    // Only react to selection changes, not to live stats updates of the same place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  const zoom = (factor: number) =>
    camera({
      x: x.get(),
      y: y.get(),
      scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.get() * factor)),
    })

  return (
    <div
      className="absolute inset-0 overflow-hidden bg-background [perspective:1400px]"
      role="application"
      aria-label={t('places.mapLabel')}
    >
      <motion.div
        // preserve-3d lets the pins counter-rotate and stand upright on the tilted plane.
        className="absolute top-1/2 left-1/2 cursor-grab touch-none [transform-style:preserve-3d] active:cursor-grabbing"
        style={{
          width: WORLD_SIZE,
          height: WORLD_SIZE,
          marginLeft: -WORLD_SIZE / 2,
          marginTop: -WORLD_SIZE / 2,
          x,
          y,
          scale,
          rotateX: MAP_TILT_DEG,
        }}
        drag
        dragMomentum
        dragConstraints={{ left: -PAN_LIMIT, right: PAN_LIMIT, top: -PAN_LIMIT, bottom: PAN_LIMIT }}
      >
        <MockMapArtwork />
        <HeatmapLayer places={places} center={center} />
        {places.map((place) => {
          const p = project(place.location, center)
          return (
            <PlacePin
              key={place.id}
              place={place}
              x={p.x}
              y={p.y}
              inverseScale={inverseScale}
              selected={place.id === selectedId}
              onSelect={(id) => onSelect(id)}
            />
          )
        })}
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
      <div className="absolute right-3 bottom-[calc(7.5rem+var(--nl-safe-area-bottom))] flex flex-col gap-2 lg:bottom-6">
        <Button
          variant="glass"
          size="icon"
          aria-label={t('places.zoomIn')}
          onClick={() => zoom(1.3)}
        >
          <Plus aria-hidden />
        </Button>
        <Button
          variant="glass"
          size="icon"
          aria-label={t('places.zoomOut')}
          onClick={() => zoom(1 / 1.3)}
        >
          <Minus aria-hidden />
        </Button>
        <Button
          variant="glass"
          size="icon"
          aria-label={t('places.recenter')}
          onClick={() => camera({ x: 0, y: 0, scale: 1 })}
        >
          <LocateFixed aria-hidden />
        </Button>
      </div>
    </div>
  )
})
