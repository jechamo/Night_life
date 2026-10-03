import { Plus } from 'lucide-react'
import { lazy, Suspense, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { DiscoverTopBar } from '@/features/places/components/DiscoverTopBar'
import { FiltersSheet } from '@/features/places/components/FiltersSheet'
import { MockMap, type MockMapHandle } from '@/features/places/components/MockMap'
import { PlaceCard } from '@/features/places/components/PlaceCard'
import { PlaceDetails } from '@/features/places/components/PlaceDetails'
import { useMapAccess, useMyPosition, usePlaces } from '@/features/places/hooks/use-places'
import { CITIES, cityCenter, DEFAULT_CITY, isCity } from '@/features/places/model/cities'
import { applyFilters, DEFAULT_FILTERS, type PlaceFilters } from '@/features/places/model/filters'
import { distanceMeters } from '@/features/places/model/geo'
import type { LatLng } from '@/features/places/model/types'
import { placeSponsored } from '@/features/places/model/sponsored'
import { useAgeGate } from '@/features/verification/hooks/use-age-gate'
import { MOCK_CENTER } from '@/mocks/world/places.mock'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { Illustration } from '@/shared/images/Illustration'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

const MapboxMap = lazy(() =>
  import('@/features/places/components/MapboxMap').then((mod) => ({ default: mod.MapboxMap })),
)

/** Places further than this from the chosen city centre belong to another city. */
const CITY_RADIUS_M = 40_000

/** Descubre (PRD 5.3): full-screen night map, floating glass UI, live pins and heatmap. */
export function DiscoverScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { guard } = useAgeGate()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('place')
  const cityParam = params.get('city')
  const { position: me, city: consentCity } = useMyPosition()
  const nearCity = me
    ? CITIES.find((c) => distanceMeters(me, c.center) <= CITY_RADIUS_M)
    : undefined
  const city = isCity(cityParam)
    ? cityParam
    : (nearCity?.name ?? (isCity(consentCity) ? consentCity : DEFAULT_CITY))
  const focus = me && nearCity?.name === city ? me : (cityCenter(city) ?? MOCK_CENTER)
  // Where the map is looking (after a pan); venues load around it.
  const [viewed, setViewed] = useState<{ city: string; center: LatLng } | null>(null)
  const { data: places, isPending } = usePlaces(viewed?.city === city ? viewed.center : focus)
  const [filters, setFilters] = useState<PlaceFilters>(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<'map' | 'list'>('map')
  const [mapFailed, setMapFailed] = useState(false)
  const mapRef = useRef<MockMapHandle>(null)
  const access = useMapAccess()
  const realMap = access?.granted === true && !mapFailed

  // The real catalogue is per city; the illustrated test world lives around one district.
  const catalogue = places?.some((p) => p.city !== undefined) ?? false
  const real = catalogue || realMap
  const origin = real ? focus : MOCK_CENTER
  const inCity = useMemo(
    () =>
      real
        ? (places ?? []).filter((p) => distanceMeters(origin, p.location) <= CITY_RADIUS_M)
        : (places ?? []),
    [places, origin, real],
  )
  const results = useMemo(
    () => placeSponsored(applyFilters(inCity, filters, origin)),
    [inCity, filters, origin],
  )
  const selected = places?.find((p) => p.id === selectedId) ?? null

  const updateParams = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params)
    for (const [key, value] of Object.entries(patch)) {
      if (value) next.set(key, value)
      else next.delete(key)
    }
    setParams(next, { replace: true })
  }
  const select = (id: string | null) => {
    updateParams({ place: id })
    if (id && view === 'list' && !desktop) setView('map')
  }

  const list = (
    <ul className="space-y-2">
      {results.map((place) => (
        <li key={place.id}>
          <PlaceCard place={place} origin={origin} onSelect={select} />
        </li>
      ))}
      {results.length === 0 && (
        <li className="py-8 text-center text-muted-foreground">
          {filters.scope === 'events' && <Illustration name="emptyEvents" />}
          <p>
            {real && !isPending && inCity.length === 0
              ? t('places.emptyCity', { city })
              : t('places.noResults')}
          </p>
        </li>
      )}
    </ul>
  )

  const mapProps = {
    ref: mapRef,
    places: results,
    center: origin,
    selectedId,
    onSelect: select,
    focusOffsetY: desktop ? 0 : 360,
  }
  const map =
    access === undefined ? (
      <Skeleton className="absolute inset-0 rounded-none" />
    ) : access.granted && !mapFailed ? (
      <Suspense fallback={<Skeleton className="absolute inset-0 rounded-none" />}>
        <MapboxMap
          {...mapProps}
          me={me}
          onMoveEnd={(center) => setViewed({ city, center })}
          token={access.token}
          onUnavailable={() => setMapFailed(true)}
        />
      </Suspense>
    ) : (
      <MockMap {...mapProps} />
    )
  const fallbackReason = !access
    ? null
    : !access.granted
      ? access.reason
      : mapFailed
        ? 'unavailable'
        : null
  const fallbackNotice =
    fallbackReason && catalogue ? t(`places.map.fallback.${fallbackReason}`) : null

  return (
    <div className="absolute inset-0 lg:grid lg:grid-cols-[1fr_26rem]">
      <div className="relative h-full overflow-hidden">
        {isPending && <Skeleton className="absolute inset-0 rounded-none" />}
        {/* The map stays mounted under the list: each new map instance is a billed load. */}
        {map}
        {view === 'list' && !desktop && (
          <div className="absolute inset-0 z-10 overflow-y-auto bg-background px-3 pt-[calc(11rem+env(safe-area-inset-top))] pb-[calc(8rem+env(safe-area-inset-bottom))]">
            {list}
          </div>
        )}
        {fallbackNotice && view === 'map' && (
          <p className="glass pointer-events-none absolute bottom-[calc(11.5rem+env(safe-area-inset-bottom))] left-3 z-20 max-w-[15rem] rounded-theme px-3 py-2 text-xs text-muted-foreground lg:bottom-20">
            {fallbackNotice}
          </p>
        )}
        <DiscoverTopBar
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onOpenFilters={() => setFiltersOpen(true)}
          view={view}
          onToggleView={() => setView((v) => (v === 'map' ? 'list' : 'map'))}
          city={real ? city : null}
          onCityChange={(next) => updateParams({ city: next, place: null })}
        />
        <Button
          className="absolute bottom-[calc(7.5rem+env(safe-area-inset-bottom))] left-3 z-20 lg:bottom-6"
          onClick={() => guard('create_event') && void navigate('/events/new')}
        >
          <Plus aria-hidden />
          {t('places.createEvent')}
        </Button>
      </div>
      {desktop ? (
        <aside className="glass-strong h-full overflow-y-auto border-y-0 border-r-0 p-4 pb-28">
          {selected ? (
            <>
              <div className="mb-4 flex items-start justify-between gap-2">
                <h2 className="text-2xl font-semibold">{selected.name}</h2>
                <Button variant="ghost" size="sm" onClick={() => select(null)}>
                  {t('common.close')}
                </Button>
              </div>
              <PlaceDetails place={selected} origin={origin} />
            </>
          ) : (
            <>
              <h2 className="mb-3 text-xl font-semibold">{t('places.nearby')}</h2>
              {list}
            </>
          )}
        </aside>
      ) : (
        <BottomSheet
          open={selected !== null}
          onOpenChange={(open) => !open && select(null)}
          title={selected?.name ?? ''}
          description={selected?.address}
          closeLabel={t('common.close')}
          dragHint={t('designKit.sheet.dragHint')}
        >
          {selected && <PlaceDetails place={selected} origin={origin} />}
        </BottomSheet>
      )}
      <FiltersSheet
        open={filtersOpen}
        value={filters}
        onApply={(next) => {
          setFilters(next)
          setFiltersOpen(false)
        }}
        onClose={() => setFiltersOpen(false)}
      />
    </div>
  )
}
