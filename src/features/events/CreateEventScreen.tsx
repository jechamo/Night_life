import { ShieldAlert } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { useCreateEvent, usePlaces } from '@/features/places/hooks/use-places'
import { useVerificationSnapshot } from '@/features/verification/hooks/use-verification'
import { canPerform } from '@/features/verification/model/verification'
import { ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { SearchCheck } from 'lucide-react'
import { isEvent } from '@/features/places/model/types'
import type { EventCategory } from '@/features/places/services/places-service'
import { CONFIRMATIONS_NEEDED, CONFIRM_WINDOW_HOURS, MAX_USER_EVENTS_PER_DAY } from './model/events'
import { Button } from '@/shared/ui/button'
import { CheckboxField } from '@/shared/ui/checkbox'
import { SingleChoice } from '@/shared/ui/choice-group'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { TextAreaField, TextField } from '@/shared/ui/text-field'

const CATEGORIES: readonly EventCategory[] = ['party', 'concert', 'meetup', 'other']

function todayAt(time: string, addDayIfBefore?: string): string {
  const [h = 0, m = 0] = time.split(':').map(Number)
  const date = new Date()
  date.setHours(h, m, 0, 0)
  if (addDayIfBefore && time < addDayIfBefore) date.setDate(date.getDate() + 1)
  return date.toISOString()
}

/** Create a user event (PRD 6.7): public place, max 2/day, published as "No confirmado". */
export function CreateEventScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: places = [] } = usePlaces()
  const create = useCreateEvent()
  const venues = places.filter((p) => !isEvent(p))
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<EventCategory>('party')
  const [venueId, setVenueId] = useState('')
  const [start, setStart] = useState('23:00')
  const [end, setEnd] = useState('03:00')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const venue = venues.find((v) => v.id === venueId)
  const error = create.data && !create.data.ok ? create.data.error : null
  const valid = title.trim().length >= 3 && venue && isPublic
  const { data: verification } = useVerificationSnapshot()

  if (verification && !canPerform('create_event', verification)) {
    return (
      <EmptyState
        icon={SearchCheck}
        title={t('verification.gate.title')}
        description={t('verification.gate.body', {
          action: t('verification.gate.actions.create_event'),
        })}
        action={<ButtonLink to="/verification/age">{t('verification.gate.verifyNow')}</ButtonLink>}
      />
    )
  }

  const submit = () => {
    if (!venue) return
    create.mutate(
      {
        title: title.trim(),
        category,
        placeName: venue.name,
        address: venue.address,
        location: venue.location,
        startsAt: todayAt(start),
        endsAt: todayAt(end, start),
        description: description.trim(),
        publicPlaceConfirmed: isPublic,
      },
      {
        onSuccess: (result) =>
          result.ok && void navigate(`/discover?place=${result.value.id}`, { replace: true }),
      },
    )
  }

  return (
    <>
      <ScreenHeader
        title={t('events.create.title')}
        description={t('events.create.body', { max: MAX_USER_EVENTS_PER_DAY })}
        backTo="/discover"
      />
      <div className="px-safe mt-4 space-y-5 pb-6">
        <TextField
          label={t('events.create.name')}
          value={title}
          maxLength={60}
          onChange={(e) => setTitle(e.target.value)}
        />
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">{t('events.create.category')}</legend>
          <SingleChoice<EventCategory>
            label={t('events.create.category')}
            value={category}
            onChange={setCategory}
            options={CATEGORIES.map((c) => ({ value: c, label: t(`events.categories.${c}`) }))}
          />
        </fieldset>
        <div className="space-y-1.5">
          <label htmlFor="event-place" className="text-sm font-medium">
            {t('events.create.place')}
          </label>
          <select
            id="event-place"
            value={venueId}
            onChange={(e) => setVenueId(e.target.value)}
            className="h-12 w-full rounded-2xl border border-border bg-surface px-4 text-base text-foreground"
          >
            <option value="">{t('events.create.placePlaceholder')}</option>
            {venues.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.address}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField
            type="time"
            label={t('events.create.start')}
            value={start}
            onChange={(e) => setStart(e.target.value)}
          />
          <TextField
            type="time"
            label={t('events.create.end')}
            value={end}
            onChange={(e) => setEnd(e.target.value)}
          />
        </div>
        <TextAreaField
          label={t('events.create.description')}
          value={description}
          maxLength={500}
          counter={`${description.length}/500`}
          onChange={(e) => setDescription(e.target.value)}
        />
        <div className="flex gap-2 rounded-2xl border border-warning bg-surface p-3 text-sm">
          <ShieldAlert className="size-5 shrink-0 text-warning" aria-hidden />
          <p>
            {t('events.create.rules', { count: CONFIRMATIONS_NEEDED, hours: CONFIRM_WINDOW_HOURS })}
          </p>
        </div>
        <CheckboxField checked={isPublic} onCheckedChange={setIsPublic}>
          {t('events.create.publicPlace')}
        </CheckboxField>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {t(`events.errors.${error}`)}
          </p>
        )}
        <Button block size="lg" disabled={!valid || create.isPending} onClick={submit}>
          {t('events.create.submit')}
        </Button>
      </div>
    </>
  )
}
