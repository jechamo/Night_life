import {
  ArrowUpRight,
  Bookmark,
  Heart,
  MapPin,
  MessageCircle,
  Moon,
  Sparkles,
  Users,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { FavoriteButton } from '@/features/places/components/FavoriteButton'
import { PlaceCover } from '@/features/places/components/PlaceCover'
import { useExploreCity } from '@/features/places/hooks/use-explore-city'
import { CITIES, isCity } from '@/features/places/model/cities'
import { distanceMeters, formatDistance } from '@/features/places/model/geo'
import type { LatLng, Place } from '@/features/places/model/types'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'
import { cn } from '@/shared/lib/cn'
import { AnimatedCounter } from '@/shared/ui/animated-counter'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { LivePulse } from '@/shared/ui/live-pulse'
import { Skeleton } from '@/shared/ui/skeleton'
import { useDashboard } from './hooks/use-dashboard'

function ZoneTitle({
  icon,
  children,
  trailing,
}: {
  icon: ReactNode
  children: ReactNode
  trailing?: ReactNode
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        {icon}
        {children}
      </h2>
      {trailing}
    </div>
  )
}

export function VenueTile({
  place,
  origin,
  hero = false,
}: {
  place: Place
  origin: LatLng
  hero?: boolean
}) {
  const { t, i18n } = useTranslation()
  return (
    <article
      className={cn(
        'home-venue relative min-w-0 overflow-hidden rounded-theme border bg-surface',
        place.sponsored ? 'border-primary/60' : 'border-border',
      )}
    >
      <Link
        to={`/places/${place.id}`}
        className="block h-full transition-opacity active:opacity-80"
      >
        <PlaceCover
          place={place}
          sizes={hero ? '(min-width: 768px) 400px, 100vw' : '200px'}
          className={cn('rounded-none', hero ? 'h-60 sm:h-full sm:min-h-72' : 'h-24 sm:h-28')}
        />
        <div
          className={cn('bg-surface p-3', hero && 'absolute inset-x-0 bottom-0 bg-surface/95 p-4')}
        >
          {place.sponsored && (
            <span className="mb-1 block font-label text-[0.65rem] font-semibold uppercase tracking-wider text-primary">
              {t('badges.sponsored')}
            </span>
          )}
          <h3 className={cn('truncate font-semibold', hero ? 'text-2xl' : 'text-sm')}>
            {place.name}
          </h3>
          <p className="mt-1 flex items-center gap-1 font-label text-xs text-muted-foreground">
            {formatDistance(distanceMeters(origin, place.location), i18n.language)}
            <span aria-hidden>·</span>
            {t(`venueTypes.${place.type}`)}
            <ArrowUpRight aria-hidden className="ml-auto size-4 shrink-0" />
          </p>
        </div>
      </Link>
      <div className="absolute right-2 top-2">
        <FavoriteButton place={place} />
      </div>
    </article>
  )
}

function ActivityZone({ places, live, city }: { places: Place[]; live?: boolean; city: string }) {
  const { t } = useTranslation()
  const maximum = Math.max(1, ...places.map((p) => (live ? p.stats.people : p.stats.goingTonight)))
  return (
    <section className="home-zone col-span-2 overflow-hidden p-4 sm:col-span-1 lg:col-span-4">
      <ZoneTitle
        icon={
          live ? (
            <LivePulse className="size-2 text-live" />
          ) : (
            <Moon className="size-5 text-secondary" />
          )
        }
      >
        {t(live ? 'home.now' : 'home.tonight')}
      </ZoneTitle>
      <p className="mb-4 font-label text-xs text-muted-foreground">{city}</p>
      {places.length === 0 ? (
        <div className="flex min-h-36 flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          {live ? (
            <Users className="size-10 opacity-40" aria-hidden />
          ) : (
            <Moon className="size-10 opacity-40" aria-hidden />
          )}
          <p className="max-w-48 text-sm">{t(live ? 'home.noActivity' : 'home.noPlans')}</p>
        </div>
      ) : (
        <ol className="space-y-4">
          {places.map((p, i) => {
            const value = live ? p.stats.people : p.stats.goingTonight
            const shown = live && value < 5 ? t('places.lessThan', { count: 5 }) : value
            return (
              <li key={p.id}>
                <Link
                  to={`/places/${p.id}`}
                  className="flex items-center gap-3 transition-opacity active:opacity-75"
                >
                  <div className="relative shrink-0">
                    <PlaceCover place={p} sizes="52px" className="size-13 rounded-2xl" />
                    <span className="absolute -bottom-1 -left-1 flex size-5 items-center justify-center rounded-full bg-surface font-label text-xs text-primary">
                      {i + 1}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{p.name}</span>
                      <span
                        className={cn(
                          'shrink-0 font-label text-sm font-semibold',
                          live ? 'text-live' : 'text-secondary',
                        )}
                      >
                        {shown}
                      </span>
                    </div>
                    <div
                      className="h-1.5 overflow-hidden rounded-full bg-surface-raised"
                      aria-hidden
                    >
                      <div
                        className={cn('h-full rounded-full', live ? 'bg-live' : 'bg-secondary')}
                        style={{ width: `${Math.max(6, (value / maximum) * 100)}%` }}
                      />
                    </div>
                  </div>
                </Link>
              </li>
            )
          })}
        </ol>
      )}
    </section>
  )
}

function Metric({
  kind,
  count,
  total,
  locked,
}: {
  kind: 'likes' | 'chats' | 'matches'
  count: number
  total?: number
  locked?: boolean
}) {
  const { t } = useTranslation()
  const icon = kind === 'likes' ? Heart : kind === 'chats' ? MessageCircle : Sparkles
  const Icon = icon
  const route =
    kind === 'likes' ? '/tonight/likes' : kind === 'matches' ? '/tonight#matches' : '/chats'
  const ratio = total ? Math.min(1, count / total) : 0
  return (
    <Link
      to={route}
      className={cn(
        'home-zone relative isolate flex min-h-48 flex-col justify-between overflow-hidden p-4 transition-opacity active:opacity-80',
        kind === 'chats'
          ? 'col-span-2 lg:col-span-6 lg:order-2'
          : kind === 'matches'
            ? 'col-span-1 lg:col-span-3 lg:order-3'
            : 'col-span-1 lg:col-span-3 lg:order-1',
      )}
    >
      <div className="flex items-center gap-2 font-label text-xs text-muted-foreground">
        <Icon className="size-4" aria-hidden />
        {t(`home.${kind}`)}
      </div>
      {kind === 'chats' ? (
        <svg
          className="absolute right-4 top-12 size-28 text-primary"
          viewBox="0 0 100 100"
          aria-hidden
        >
          <circle cx="50" cy="50" r="38" fill="none" stroke="var(--nl-border)" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="38"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${ratio * 239} 239`}
            transform="rotate(-90 50 50)"
          />
          <MessageCircle x="35" y="35" width="30" height="30" strokeWidth="1.5" />
        </svg>
      ) : (
        <div
          className="pointer-events-none absolute -right-3 top-10 -z-10 rotate-[-14deg] text-primary/15"
          aria-hidden
        >
          <Icon className="size-32" strokeWidth="1" />
          {kind === 'matches' && (
            <Heart className="absolute left-2 top-2 size-14 -rotate-12 text-secondary/40" />
          )}
        </div>
      )}
      <div className={kind === 'chats' ? 'pr-32' : ''}>
        <span className="font-display text-5xl font-semibold leading-none tracking-tight">
          <AnimatedCounter value={count} />
        </span>
        {kind === 'chats' && (
          <p className="mt-2 text-sm text-muted-foreground">
            {t('home.chatTotal', { count: total ?? 0 })}
          </p>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span>
          {t(
            kind === 'likes'
              ? locked
                ? 'home.likesLocked'
                : 'home.likesCaption'
              : kind === 'chats'
                ? 'home.chatCaption'
                : 'home.matchesCaption',
          )}
        </span>
        <ArrowUpRight className="size-4 shrink-0" aria-hidden />
      </div>
    </Link>
  )
}

export function HomeScreen() {
  const { t } = useTranslation()
  const { city, origin, centered, selectCity, ready } = useExploreCity()
  const query = useDashboard(city, origin, ready)
  const seeLikes = useEntitlement('see_likes').granted
  return (
    <div className="pb-4">
      <header className="pt-safe px-safe mb-6">
        <div className="flex items-center justify-between gap-3 pt-4">
          <span className="font-label text-xs uppercase tracking-[0.2em] text-primary">
            {t('home.eyebrow')}
          </span>
          <label className="flex min-w-0 items-center gap-1 rounded-full border border-border bg-surface px-3 text-sm">
            <MapPin className="size-4 shrink-0 text-primary" aria-hidden />
            <span className="sr-only">{t('home.city')}</span>
            <select
              className="touch-target min-w-0 max-w-32 bg-transparent font-medium outline-none"
              value={city}
              onChange={(e) => {
                if (isCity(e.target.value)) selectCity(e.target.value)
              }}
            >
              {CITIES.map((c) => (
                <option key={c.name} value={c.name} className="bg-surface text-foreground">
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <h1 className="mt-4 max-w-lg font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl">
          {t('home.title')}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">{t('home.subtitle')}</p>
      </header>
      <div className="px-safe grid grid-cols-2 gap-3 lg:grid-cols-12 lg:gap-4">
        {query.isPending ? (
          <div role="status" className="col-span-2 grid grid-cols-2 gap-3 lg:col-span-12">
            <span className="sr-only">{t('common.loading')}</span>
            <Skeleton className="col-span-2 h-80" />
            <Skeleton className="h-48" />
            <Skeleton className="h-48" />
          </div>
        ) : query.isError ? (
          <div role="alert" className="home-zone col-span-2 p-6 lg:col-span-12">
            <p className="mb-4">{t('errors.generic.title')}</p>
            <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
          </div>
        ) : (
          query.data && (
            <>
              <section
                id="nearby"
                className="home-zone col-span-2 p-3 sm:p-4 lg:col-span-8 lg:row-span-2"
              >
                <ZoneTitle
                  icon={<MapPin className="size-5 text-primary" />}
                  trailing={<Badge>{t('home.localSelection')}</Badge>}
                >
                  {t(centered ? 'home.nearCenter' : 'home.nearby')}
                </ZoneTitle>
                {query.data.nearby.length === 0 ? (
                  <p className="flex min-h-60 items-center justify-center text-center text-muted-foreground">
                    {t('places.emptyCity', { city })}
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:auto-rows-fr">
                    {query.data.nearby.map((p, i) => (
                      <div
                        key={p.id}
                        className={cn('min-w-0', i === 0 && 'col-span-2 sm:row-span-2')}
                      >
                        <VenueTile place={p} origin={origin} hero={i === 0} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <ActivityZone places={query.data.tonight} city={city} />
              <ActivityZone places={query.data.now} city={city} live />
              {query.data.social ? (
                <div className="col-span-2 grid grid-cols-2 gap-3 lg:col-span-12 lg:grid-cols-12 lg:gap-4">
                  <Metric kind="likes" count={query.data.social.newLikes} locked={!seeLikes} />
                  <Metric kind="matches" count={query.data.social.matches} />
                  <Metric
                    kind="chats"
                    count={query.data.social.pendingChats}
                    total={query.data.social.totalChats}
                  />
                </div>
              ) : (
                <Link
                  to="/verification/age"
                  className="home-zone col-span-2 flex items-center gap-4 p-5 lg:col-span-12"
                >
                  <Heart className="size-10 shrink-0 text-primary" aria-hidden />
                  <div className="flex-1">
                    <h2 className="font-semibold">{t('home.socialLocked')}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{t('home.verify')}</p>
                  </div>
                  <ArrowUpRight aria-hidden />
                </Link>
              )}
              <section className="home-zone col-span-2 p-4 lg:col-span-12">
                <ZoneTitle
                  icon={<Bookmark className="size-5 text-secondary" />}
                  trailing={
                    <Link
                      to="/favorites"
                      className="touch-target flex items-center gap-1 text-xs font-semibold text-primary"
                    >
                      {t('home.viewAll', { count: query.data.favoritesTotal })}
                      <ArrowUpRight className="size-4" aria-hidden />
                    </Link>
                  }
                >
                  {t('home.favorites')}
                </ZoneTitle>
                {query.data.favorites.length === 0 ? (
                  <div className="flex items-center gap-4 rounded-2xl border border-dashed border-border p-5">
                    <Bookmark
                      className="size-9 shrink-0 text-secondary"
                      strokeWidth="1"
                      aria-hidden
                    />
                    <p className="max-w-sm text-sm text-muted-foreground">
                      {t('home.noFavorites')}
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {query.data.favorites.map((p) => (
                      <VenueTile key={p.id} place={p} origin={origin} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )
        )}
      </div>
    </div>
  )
}
