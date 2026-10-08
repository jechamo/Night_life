import { Accessibility, Euro, Martini, Shirt, Sun, UserCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/ui/badge'
import { useTrackPlaceView, useVenueShowcase } from '../hooks/use-showcase'
import { formatEuros, hasExtras, type VenueExtras, type VenueNotice } from '../model/showcase'

function useTime() {
  const { i18n } = useTranslation()
  const format = new Intl.DateTimeFormat(i18n.language, { hour: '2-digit', minute: '2-digit' })
  return (iso: string) => format.format(new Date(iso))
}

export function NoticeBadges({ notices }: { notices: readonly VenueNotice[] }) {
  const { t } = useTranslation()
  const time = useTime()
  return (
    <ul className="flex flex-wrap gap-2">
      {notices.map((n) => (
        <li key={n.kind}>
          <Badge tone="live">
            {n.kind === 'door'
              ? t(`places.showcase.door.${n.value}`)
              : t(`places.showcase.offer.${n.kind}`, { time: time(n.until) })}
          </Badge>
        </li>
      ))}
    </ul>
  )
}

function Extra({ icon: Icon, children }: { icon: typeof Shirt; children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      <Icon className="size-4 shrink-0 text-primary" aria-hidden />
      {children}
    </li>
  )
}

function ExtrasList({ extras }: { extras: VenueExtras }) {
  const { t } = useTranslation()
  return (
    <ul aria-label={t('places.showcase.detailsLabel')} className="grid gap-2 text-sm">
      {extras.dressCode && (
        <Extra icon={Shirt}>{t(`places.showcase.dress.${extras.dressCode}`)}</Extra>
      )}
      {extras.minAge !== null && (
        <Extra icon={UserCheck}>{t('places.showcase.minAge', { age: extras.minAge })}</Extra>
      )}
      {extras.entryPriceCents !== null && (
        <Extra icon={Euro}>
          {extras.entryPriceCents === 0
            ? t('places.showcase.entryFree')
            : t('places.showcase.entry', { price: formatEuros(extras.entryPriceCents) })}
        </Extra>
      )}
      {extras.drinkPriceCents !== null && (
        <Extra icon={Martini}>
          {t('places.showcase.drink', { price: formatEuros(extras.drinkPriceCents) })}
        </Extra>
      )}
      {extras.terrace && <Extra icon={Sun}>{t('places.showcase.terrace')}</Extra>}
      {extras.accessible && <Extra icon={Accessibility}>{t('places.showcase.accessible')}</Extra>}
    </ul>
  )
}

/**
 * Roadmap R4: what the venue itself publishes (always labelled as such): door status and
 * offers, its approved photos and extra details. Renders nothing when there is nothing.
 */
export function ShowcaseSection({ placeId, name }: { placeId: string; name: string }) {
  const { t } = useTranslation()
  const { data } = useVenueShowcase(placeId, true)
  useTrackPlaceView(placeId, true)
  if (!data) return null
  const extras = hasExtras(data.details) ? data.details : null
  if (data.notices.length === 0 && data.photos.length === 0 && !extras) return null
  return (
    <section aria-labelledby={`showcase-${placeId}`} className="space-y-3">
      <div>
        <h3 id={`showcase-${placeId}`} className="font-display text-lg font-semibold">
          {t('places.showcase.title')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('places.showcase.hint')}</p>
      </div>
      {data.notices.length > 0 && <NoticeBadges notices={data.notices} />}
      {data.photos.length > 0 && (
        <ul
          aria-label={t('places.showcase.photos')}
          className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto px-1 pb-1"
        >
          {data.photos.map((photo, index) => (
            <li
              key={photo.id}
              className="aspect-[4/3] w-56 shrink-0 snap-start overflow-hidden rounded-theme bg-surface-raised"
            >
              <img
                src={photo.url}
                alt={t('places.showcase.photoAlt', { n: index + 1, name })}
                loading="lazy"
                decoding="async"
                className="size-full object-cover"
              />
            </li>
          ))}
        </ul>
      )}
      {extras && <ExtrasList extras={extras} />}
    </section>
  )
}
