import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ACCENT_KEYS } from '@/shared/domain/venue-types'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'
import { Chip } from '@/shared/ui/chip'
import { SingleChoice } from '@/shared/ui/choice-group'
import { RangeSlider } from '@/shared/ui/range-slider'
import { Switch } from '@/shared/ui/switch'
import { DEFAULT_FILTERS, type PlaceFilters, type PlaceSort } from '../model/filters'

const SORTS: readonly PlaceSort[] = [
  'distance',
  'most_people',
  'least_people',
  'average_age',
  'rating',
]
const PEOPLE = ['0', '10', '25', '50'] as const
const GREEN = ['0', '25', '50', '75'] as const
const DISTANCE = ['any', '0.5', '1', '2'] as const
const PRICE = ['1', '2', '3', '4'] as const

/** All filters are free (PRD 6.5). Applied only when pressing "Ver resultados". */
export function FiltersSheet({
  open,
  value,
  onApply,
  onClose,
}: {
  open: boolean
  value: PlaceFilters
  onApply: (filters: PlaceFilters) => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState(value)
  const set = (patch: Partial<PlaceFilters>) => setDraft((d) => ({ ...d, ...patch }))
  const label = (key: 'types' | 'minPeople' | 'green' | 'distance' | 'price' | 'sort') => (
    <p className="mb-2 text-sm font-medium">{t(`places.filters.${key}`)}</p>
  )

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (next) setDraft(value)
        else onClose()
      }}
      title={t('places.filters.title')}
      closeLabel={t('common.close')}
      dragHint={t('designKit.sheet.dragHint')}
    >
      <div className="space-y-5">
        <div>
          {label('types')}
          <div className="flex flex-wrap gap-2">
            {ACCENT_KEYS.map((key) => (
              <Chip
                key={key}
                accent={key}
                selected={draft.types.includes(key)}
                onClick={() =>
                  set({
                    types: draft.types.includes(key)
                      ? draft.types.filter((k) => k !== key)
                      : [...draft.types, key],
                  })
                }
              >
                {t(`venueTypes.${key}`)}
              </Chip>
            ))}
          </div>
        </div>
        <div>
          {label('minPeople')}
          <SingleChoice
            label={t('places.filters.minPeople')}
            value={String(draft.minPeople) as (typeof PEOPLE)[number]}
            options={PEOPLE.map((v) => ({
              value: v,
              label: v === '0' ? t('places.filters.any') : `+${v}`,
            }))}
            onChange={(v) => set({ minPeople: Number(v) })}
          />
        </div>
        <div className="space-y-2">
          <label className="flex items-center justify-between gap-3 text-sm font-medium">
            {t('places.filters.averageAge')}
            <Switch
              checked={draft.ageRange !== null}
              onCheckedChange={(on) => set({ ageRange: on ? [22, 40] : null })}
              aria-label={t('places.filters.averageAge')}
            />
          </label>
          {draft.ageRange && (
            <RangeSlider
              label={t('places.filters.averageAge')}
              thumbLabels={[t('onboarding.preferences.ageMin'), t('onboarding.preferences.ageMax')]}
              min={18}
              max={60}
              value={[draft.ageRange[0], draft.ageRange[1]]}
              onChange={(v) => set({ ageRange: v })}
              formatValue={(n) => (n >= 60 ? '60+' : String(n))}
            />
          )}
        </div>
        <div>
          {label('green')}
          <SingleChoice
            label={t('places.filters.green')}
            value={String(draft.minGreenPercent) as (typeof GREEN)[number]}
            options={GREEN.map((v) => ({
              value: v,
              label: v === '0' ? t('places.filters.any') : `${v}%+`,
            }))}
            onChange={(v) => set({ minGreenPercent: Number(v) })}
          />
        </div>
        <div>
          {label('distance')}
          <SingleChoice
            label={t('places.filters.distance')}
            value={
              (draft.maxDistanceKm === null
                ? 'any'
                : String(draft.maxDistanceKm)) as (typeof DISTANCE)[number]
            }
            options={DISTANCE.map((v) => ({
              value: v,
              label: v === 'any' ? t('places.filters.any') : `${v} km`,
            }))}
            onChange={(v) => set({ maxDistanceKm: v === 'any' ? null : Number(v) })}
          />
        </div>
        <div>
          {label('price')}
          <SingleChoice
            label={t('places.filters.price')}
            value={String(draft.maxPrice) as (typeof PRICE)[number]}
            options={PRICE.map((v) => ({ value: v, label: '€'.repeat(Number(v)) }))}
            onChange={(v) => set({ maxPrice: Number(v) as PlaceFilters['maxPrice'] })}
          />
        </div>
        <label className="flex items-center justify-between gap-3 text-sm font-medium">
          {t('places.filters.openNow')}
          <Switch
            checked={draft.openNow}
            onCheckedChange={(on) => set({ openNow: on })}
            aria-label={t('places.filters.openNow')}
          />
        </label>
        <div>
          {label('sort')}
          <SingleChoice<PlaceSort>
            label={t('places.filters.sort')}
            value={draft.sort}
            options={SORTS.map((s) => ({ value: s, label: t(`places.filters.sorts.${s}`) }))}
            onChange={(v) => set({ sort: v })}
          />
        </div>
        <div className="grid grid-cols-2 gap-3 pt-2">
          <Button
            variant="outline"
            onClick={() => setDraft({ ...DEFAULT_FILTERS, text: draft.text, scope: draft.scope })}
          >
            {t('places.filters.reset')}
          </Button>
          <Button onClick={() => onApply(draft)}>{t('places.filters.apply')}</Button>
        </div>
      </div>
    </BottomSheet>
  )
}
