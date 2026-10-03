import { List, Map as MapIcon, MapPin, Search, SlidersHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { VENUE_TYPES } from '@/shared/domain/venue-types'
import { Button } from '@/shared/ui/button'
import { Chip } from '@/shared/ui/chip'
import { SegmentedControl } from '@/shared/ui/segmented-control'
import { CITIES, isCity, type CityName } from '../model/cities'
import { activeFilterCount, type PlaceFilters, type PlaceScope } from '../model/filters'

/** Floating glass search, scope selector and accent chips (PRD 5.3). */
export function DiscoverTopBar({
  filters,
  onChange,
  onOpenFilters,
  view,
  onToggleView,
  city = null,
  onCityChange,
}: {
  filters: PlaceFilters
  onChange: (patch: Partial<PlaceFilters>) => void
  onOpenFilters: () => void
  view: 'map' | 'list'
  onToggleView: () => void
  /** Chosen city of the real catalogue; `null` hides the selector (illustrated test world). */
  city?: CityName | null
  onCityChange?: (city: CityName) => void
}) {
  const { t } = useTranslation()
  const count = activeFilterCount(filters)
  return (
    <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-20 space-y-2 px-3 pt-3">
      <div className="pointer-events-auto flex gap-2">
        <label className="glass flex h-12 flex-1 items-center gap-2 rounded-full px-4">
          <Search className="size-5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="sr-only">{t('places.search')}</span>
          <input
            type="search"
            value={filters.text}
            onChange={(event) => onChange({ text: event.target.value })}
            placeholder={t('places.search')}
            className="w-full bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
        <Button
          variant="glass"
          size="icon"
          className="relative h-12 w-12"
          aria-label={t('places.filters.title')}
          onClick={onOpenFilters}
        >
          <SlidersHorizontal aria-hidden />
          {count > 0 && (
            <span className="absolute -top-1 -right-1 flex size-5 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
        <Button
          variant="glass"
          size="icon"
          className="h-12 w-12"
          aria-label={view === 'map' ? t('places.listView') : t('places.mapView')}
          onClick={onToggleView}
        >
          {view === 'map' ? <List aria-hidden /> : <MapIcon aria-hidden />}
        </Button>
      </div>
      <div className="pointer-events-auto flex items-center gap-2">
        {city && (
          <label className="glass flex h-10 shrink-0 items-center gap-1 rounded-full pr-2 pl-3">
            <MapPin className="size-4 text-primary" aria-hidden />
            <span className="sr-only">{t('places.city')}</span>
            <select
              value={city}
              onChange={(event) => {
                const next = event.target.value
                if (isCity(next)) onCityChange?.(next)
              }}
              className="bg-transparent text-sm font-medium text-foreground outline-none"
            >
              {CITIES.map((c) => (
                <option key={c.name} value={c.name} className="bg-surface">
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <SegmentedControl<PlaceScope>
          label={t('designKit.segmented.label')}
          value={filters.scope}
          onChange={(scope) => onChange({ scope })}
          options={(['all', 'venues', 'events'] as const).map((value) => ({
            value,
            label: t(`designKit.segmented.${value}`),
          }))}
        />
      </div>
      <div className="pointer-events-auto -mx-3 flex gap-2 overflow-x-auto px-3 pb-1 [scrollbar-width:none]">
        {VENUE_TYPES.map((type) => (
          <Chip
            key={type}
            accent={type}
            selected={filters.types.includes(type)}
            onClick={() =>
              onChange({
                types: filters.types.includes(type)
                  ? filters.types.filter((k) => k !== type)
                  : [...filters.types, type],
              })
            }
          >
            {t(`venueTypes.${type}`)}
          </Chip>
        ))}
      </div>
    </div>
  )
}
