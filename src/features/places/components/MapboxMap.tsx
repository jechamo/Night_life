import type { FeatureCollection, Point } from 'geojson'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { LocateFixed, Minus, Plus } from 'lucide-react'
import { useMotionValue } from 'motion/react'
import { forwardRef, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { useTranslation } from 'react-i18next'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { useTheme } from '@/shared/theme/ThemeProvider'
import type { ThemeDefinition } from '@/shared/theme/themes'
import { Button } from '@/shared/ui/button'
import type { LatLng, Place } from '../model/types'
import type { MockMapHandle } from './MockMap'
import { PlacePin } from './PlacePin'

const HEAT_SOURCE = 'nl-heat'
const HEAT_LAYER = 'nl-heatmap'
const CITY_ZOOM = 13
const FOCUS_ZOOM = 15

function heatData(places: readonly Place[]): FeatureCollection<Point> {
  return {
    type: 'FeatureCollection',
    features: places.map((p) => ({
      type: 'Feature',
      properties: { people: p.stats.people },
      geometry: { type: 'Point', coordinates: [p.location.lng, p.location.lat] },
    })),
  }
}

function MeDot({ label }: { label: string }) {
  return (
    <span
      role="img"
      aria-label={label}
      className="relative flex size-6 items-center justify-center"
    >
      <span className="nl-live-ring absolute inset-0 rounded-full bg-primary/60" />
      <span className="relative size-4 rounded-full border-2 border-foreground bg-primary shadow-[0_0_18px_var(--color-primary)]" />
    </span>
  )
}

function applyTheme(map: mapboxgl.Map, theme: ThemeDefinition) {
  map.setConfigProperty('basemap', 'lightPreset', theme.map.lightPreset)
  map.setConfigProperty('basemap', 'theme', theme.map.theme)
  if (!map.getLayer(HEAT_LAYER)) return
  const [c0, c1, c2, c3, c4] = theme.heatmap
  map.setPaintProperty(HEAT_LAYER, 'heatmap-color', [
    'interpolate',
    ['linear'],
    ['heatmap-density'],
    0,
    c0,
    0.25,
    c1,
    0.5,
    c2,
    0.75,
    c3,
    1,
    c4,
  ])
}

/**
 * Mapbox Standard map (Block 7, ADR 0010). Only our catalogue is drawn: pins are React
 * DOM nodes inside markers (never `setHTML`) and the heatmap is a GeoJSON layer painted
 * with the theme ramp. The token arrives only after a map load was reserved on the server.
 */
export const MapboxMap = forwardRef<
  MockMapHandle,
  {
    token: string
    places: readonly Place[]
    center: LatLng
    selectedId: string | null
    onSelect: (id: string | null) => void
    focusOffsetY?: number
    /** The user's own position (device only, with consent). */
    me?: LatLng | null
    onUnavailable: () => void
  }
>(function MapboxMap(
  { token, places, center, selectedId, onSelect, focusOffsetY = 0, me = null, onUnavailable },
  ref,
) {
  const { t } = useTranslation()
  const { theme } = useTheme()
  const tokens = useMotionTokens()
  const hostRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const loadedRef = useRef(false)
  const markersRef = useRef(new Map<string, { marker: mapboxgl.Marker; root: Root }>())
  const meRef = useRef<{ marker: mapboxgl.Marker; root: Root } | null>(null)
  const inverseScale = useMotionValue(1)
  const latest = useRef({ places, theme, onSelect, onUnavailable, reduced: tokens.reduced })
  useLayoutEffect(() => {
    latest.current = { places, theme, onSelect, onUnavailable, reduced: tokens.reduced }
  })

  const fly = (target: LatLng, zoom: number, offsetY: number) => {
    const map = mapRef.current
    if (!map) return
    map.flyTo({
      center: [target.lng, target.lat],
      zoom,
      offset: [0, -offsetY / 2],
      duration: latest.current.reduced ? 0 : 400,
      essential: false,
    })
  }

  useImperativeHandle(ref, () => ({
    flyTo: (place) =>
      fly(place.location, Math.max(mapRef.current?.getZoom() ?? 0, FOCUS_ZOOM), focusOffsetY),
    recenter: () => fly(center, CITY_ZOOM, 0),
  }))

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let map: mapboxgl.Map
    try {
      map = new mapboxgl.Map({
        accessToken: token,
        container: host,
        style: 'mapbox://styles/mapbox/standard',
        config: {
          basemap: {
            lightPreset: latest.current.theme.map.lightPreset,
            theme: latest.current.theme.map.theme,
            showPointOfInterestLabels: false,
          },
        },
        center: [center.lng, center.lat],
        zoom: CITY_ZOOM,
        pitch: 45,
        attributionControl: true,
      })
    } catch {
      latest.current.onUnavailable()
      return
    }
    mapRef.current = map
    const markers = markersRef.current
    map.on('load', () => {
      loadedRef.current = true
      map.addSource(HEAT_SOURCE, { type: 'geojson', data: heatData(latest.current.places) })
      map.addLayer({
        id: HEAT_LAYER,
        type: 'heatmap',
        source: HEAT_SOURCE,
        paint: {
          // Every venue keeps a dim glow on the dark basemap; crowds make it brighter.
          'heatmap-weight': ['interpolate', ['linear'], ['get', 'people'], 0, 0.35, 40, 1],
          'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 11, 22, 16, 60],
          'heatmap-opacity': 0.75,
        },
      })
      applyTheme(map, latest.current.theme)
    })
    map.on('error', (event) => {
      // Tile hiccups after a successful load are tolerated; a failed start falls back.
      if (!loadedRef.current || (event.error as { status?: number } | undefined)?.status === 401) {
        latest.current.onUnavailable()
      }
    })
    return () => {
      markers.forEach(({ marker, root }) => {
        marker.remove()
        queueMicrotask(() => root.unmount())
      })
      markers.clear()
      const meEntry = meRef.current
      if (meEntry) {
        meEntry.marker.remove()
        queueMicrotask(() => meEntry.root.unmount())
        meRef.current = null
      }
      loadedRef.current = false
      mapRef.current = null
      map.remove()
    }
    // One map instance per reserved load; centre changes fly the camera instead.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  useEffect(() => {
    const map = mapRef.current
    if (map && loadedRef.current) applyTheme(map, theme)
  }, [theme])

  useEffect(() => {
    fly(center, CITY_ZOOM, 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource<mapboxgl.GeoJSONSource>(HEAT_SOURCE)
    source?.setData(heatData(places))
    const markers = markersRef.current
    const next = new Set(places.map((p) => p.id))
    markers.forEach((entry, id) => {
      if (next.has(id)) return
      entry.marker.remove()
      queueMicrotask(() => entry.root.unmount())
      markers.delete(id)
    })
    for (const place of places) {
      let entry = markers.get(place.id)
      if (!entry) {
        const element = document.createElement('div')
        entry = {
          marker: new mapboxgl.Marker({ element, anchor: 'bottom' })
            .setLngLat([place.location.lng, place.location.lat])
            .addTo(map),
          root: createRoot(element),
        }
        markers.set(place.id, entry)
      } else {
        entry.marker.setLngLat([place.location.lng, place.location.lat])
      }
      entry.root.render(
        <PlacePin
          place={place}
          x={0}
          y={0}
          flat
          inverseScale={inverseScale}
          selected={place.id === selectedId}
          onSelect={(id) => latest.current.onSelect(id)}
        />,
      )
    }
  }, [places, selectedId, inverseScale])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (!me) {
      const entry = meRef.current
      if (entry) {
        entry.marker.remove()
        queueMicrotask(() => entry.root.unmount())
        meRef.current = null
      }
      return
    }
    if (!meRef.current) {
      const element = document.createElement('div')
      const root = createRoot(element)
      meRef.current = {
        marker: new mapboxgl.Marker({ element }).setLngLat([me.lng, me.lat]).addTo(map),
        root,
      }
    } else {
      meRef.current.marker.setLngLat([me.lng, me.lat])
    }
    meRef.current.root.render(<MeDot label={t('places.youAreHere')} />)
  }, [me, t, token])

  useEffect(() => {
    const place = latest.current.places.find((p) => p.id === selectedId)
    if (place)
      fly(place.location, Math.max(mapRef.current?.getZoom() ?? 0, FOCUS_ZOOM), focusOffsetY)
    // Only react to selection, not to live stats of the same place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId])

  return (
    <div
      className="absolute inset-0 bg-background"
      role="application"
      aria-label={t('places.mapLabel')}
    >
      {/* mapbox-gl.css forces `position: relative` on its container and beats layered utilities. */}
      <div ref={hostRef} className="h-full w-full" />
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-background to-transparent" />
      <div className="absolute right-3 bottom-[calc(7.5rem+env(safe-area-inset-bottom))] flex flex-col gap-2 lg:bottom-10">
        <Button
          variant="glass"
          size="icon"
          aria-label={t('places.zoomIn')}
          onClick={() => mapRef.current?.zoomIn({ duration: tokens.reduced ? 0 : 200 })}
        >
          <Plus aria-hidden />
        </Button>
        <Button
          variant="glass"
          size="icon"
          aria-label={t('places.zoomOut')}
          onClick={() => mapRef.current?.zoomOut({ duration: tokens.reduced ? 0 : 200 })}
        >
          <Minus aria-hidden />
        </Button>
        <Button
          variant="glass"
          size="icon"
          aria-label={t('places.recenter')}
          onClick={() => fly(center, CITY_ZOOM, 0)}
        >
          <LocateFixed aria-hidden />
        </Button>
      </div>
    </div>
  )
})
