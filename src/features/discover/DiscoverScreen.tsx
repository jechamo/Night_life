import { Plus } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { DiscoverTopBar } from '@/features/places/components/DiscoverTopBar'
import { FiltersSheet } from '@/features/places/components/FiltersSheet'
import { MockMap, type MockMapHandle } from '@/features/places/components/MockMap'
import { PlaceCard } from '@/features/places/components/PlaceCard'
import { PlaceDetails } from '@/features/places/components/PlaceDetails'
import { usePlaces } from '@/features/places/hooks/use-places'
import { applyFilters, DEFAULT_FILTERS, type PlaceFilters } from '@/features/places/model/filters'
import { placeSponsored } from '@/features/places/model/sponsored'
import { useAgeGate } from '@/features/verification/hooks/use-age-gate'
import { MOCK_CENTER } from '@/mocks/world/places.mock'
import { useMediaQuery } from '@/shared/lib/use-media-query'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'

/** Descubre (PRD 5.3): full-screen night map, floating glass UI, live pins and heatmap. */
export function DiscoverScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { guard } = useAgeGate()
  const desktop = useMediaQuery('(min-width: 1024px)')
  const { data: places, isPending } = usePlaces()
  const [params, setParams] = useSearchParams()
  const selectedId = params.get('place')
  const [filters, setFilters] = useState<PlaceFilters>(DEFAULT_FILTERS)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [view, setView] = useState<'map' | 'list'>('map')
  const mapRef = useRef<MockMapHandle>(null)

  // User location arrives with Mapbox/geolocation in Block 7; the mock uses the district centre.
  const origin = MOCK_CENTER
  const results = useMemo(
    () => placeSponsored(applyFilters(places ?? [], filters, origin)),
    [places, filters, origin],
  )
  const selected = places?.find((p) => p.id === selectedId) ?? null

  const select = (id: string | null) => {
    setParams(id ? { place: id } : {}, { replace: true })
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
        <p className="py-8 text-center text-muted-foreground">{t('places.noResults')}</p>
      )}
    </ul>
  )

  return (
    <div className="absolute inset-0 lg:grid lg:grid-cols-[1fr_26rem]">
      <div className="relative h-full overflow-hidden">
        {isPending && <Skeleton className="absolute inset-0 rounded-none" />}
        {view === 'map' || desktop ? (
          <MockMap
            ref={mapRef}
            places={results}
            center={MOCK_CENTER}
            selectedId={selectedId}
            onSelect={select}
            focusOffsetY={desktop ? 0 : 360}
          />
        ) : (
          <div className="absolute inset-0 overflow-y-auto px-3 pt-[calc(11rem+env(safe-area-inset-top))] pb-[calc(8rem+env(safe-area-inset-bottom))]">
            {list}
          </div>
        )}
        <DiscoverTopBar
          filters={filters}
          onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
          onOpenFilters={() => setFiltersOpen(true)}
          view={view}
          onToggleView={() => setView((v) => (v === 'map' ? 'list' : 'map'))}
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
