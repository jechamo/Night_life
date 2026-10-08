import type { AdminService } from '@/features/admin/services/admin-service'
import {
  DOOR_NOTICE_MINUTES,
  OFFER_MAX_HOURS,
  PHOTO_LIMIT_FREE,
  PHOTO_LIMIT_PLAN,
  type ManagedPhoto,
  type VenueExtras,
  type VenueNotice,
  type VenuePhotos,
  type VenueReport,
} from '@/features/places/model/showcase'
import type { PlacesService } from '@/features/places/services/places-service'
import type { VenuePanelService } from '@/features/venue-panel/services/venue-panel-service'
import { err, ok } from '@/shared/lib/result'
import type { WorldState } from '../world/world-state'
import { audit, type MockConfig } from './config'
import { contractBenefits, ME } from './partners'

/** Simulated R4 showcase shared by the places, venue panel and admin mocks. */
export interface MockVenuePhoto extends ManagedPhoto {
  venueId: string
}

export interface MockShowcaseState {
  photos: MockVenuePhoto[]
  details: Record<string, VenueExtras>
  notices: Record<string, VenueNotice[]>
  /** venueId → counted views this night (one per simulated person). */
  views: Record<string, number>
}

export const createMockShowcaseState = (): MockShowcaseState => ({
  photos: [],
  details: {},
  notices: {},
  views: {},
})

type Wait = () => Promise<void>

function requireShowcase(config: MockConfig) {
  if (config.flags.venue_showcase_enabled !== 'on') throw new Error('disabled')
}

/** The simulated backend keeps the re-encoded blob in memory (object URL in browsers). */
const photoUrl = (blob: Blob, id: string) =>
  typeof URL.createObjectURL === 'function' ? URL.createObjectURL(blob) : `mock://venue-photo/${id}`

function hasPlan(config: MockConfig, world: WorldState, venueId: string) {
  return (
    contractBenefits(config.partners, venueId).length > 0 ||
    !!world.places.find((p) => p.id === venueId)?.sponsored
  )
}

const limitOf = (config: MockConfig, world: WorldState, venueId: string) =>
  hasPlan(config, world, venueId) ? PHOTO_LIMIT_PLAN : PHOTO_LIMIT_FREE

function visiblePhotos(config: MockConfig, world: WorldState, venueId: string) {
  return config.showcase.photos
    .filter((p) => p.venueId === venueId && p.status === 'approved')
    .sort((a, b) => Number(b.isCover) - Number(a.isCover) || a.createdAt.localeCompare(b.createdAt))
    .slice(0, limitOf(config, world, venueId))
}

const liveNotices = (config: MockConfig, venueId: string) =>
  (config.showcase.notices[venueId] ?? []).filter((n) => Date.parse(n.until) > Date.now())

function managed(config: MockConfig, world: WorldState, venueId: string): VenuePhotos {
  const visible = new Set(visiblePhotos(config, world, venueId).map((p) => p.id))
  return {
    limit: limitOf(config, world, venueId),
    plan: hasPlan(config, world, venueId),
    photos: config.showcase.photos
      .filter((p) => p.venueId === venueId)
      .sort(
        (a, b) => Number(b.isCover) - Number(a.isCover) || a.createdAt.localeCompare(b.createdAt),
      )
      .map(({ venueId: _venue, ...photo }) => ({ ...photo, visible: visible.has(photo.id) })),
  }
}

function requireManager(config: MockConfig, venueId: string) {
  requireShowcase(config)
  const managers = config.partners.managers[venueId] ?? []
  if (!managers.some((m) => m.userId === ME)) throw new Error('forbidden')
}

export function createMockShowcasePlaces(
  config: MockConfig | undefined,
  world: WorldState,
): Pick<PlacesService, 'showcase' | 'covers' | 'trackView'> {
  const on = () => {
    if (!config) throw new Error('disabled')
    requireShowcase(config)
    return config
  }
  return {
    showcase(placeId) {
      const c = on()
      return Promise.resolve({
        photos: visiblePhotos(c, world, placeId).map((p) => ({ id: p.id, url: p.url })),
        details: c.showcase.details[placeId] ?? null,
        notices: liveNotices(c, placeId),
      })
    },
    covers() {
      const c = on()
      const covers: Record<string, string> = {}
      for (const venueId of new Set(c.showcase.photos.map((p) => p.venueId))) {
        const first = visiblePhotos(c, world, venueId)[0]
        if (first) covers[venueId] = first.url
      }
      return Promise.resolve(covers)
    },
    trackView(placeId) {
      const c = on()
      // Managers' own views are not counted (as on the server).
      if (!(c.partners.managers[placeId] ?? []).some((m) => m.userId === ME))
        c.showcase.views[placeId] = (c.showcase.views[placeId] ?? 0) + 1
      return Promise.resolve()
    },
  }
}

const period = (from: string, to: string, views: number, going: number, checkIns: number) => ({
  from,
  to,
  views: views >= 5 ? views : 0,
  going: going >= 5 ? going : 0,
  checkIns: checkIns >= 5 ? checkIns : 0,
  conversion: going >= 5 ? Math.round((100 * Math.min(going, checkIns) * 0.6) / going) : null,
})

const day = (offset: number) =>
  new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10)

export function createMockShowcasePanel(
  config: MockConfig,
  world: WorldState,
  wait: Wait,
): Pick<
  VenuePanelService,
  | 'photos'
  | 'uploadPhoto'
  | 'removePhoto'
  | 'setCoverPhoto'
  | 'saveExtras'
  | 'setNotice'
  | 'clearNotice'
  | 'report'
> {
  const state = config.showcase
  return {
    async photos(placeId) {
      await wait()
      requireManager(config, placeId)
      return managed(config, world, placeId)
    },
    async uploadPhoto(placeId, blob) {
      await wait()
      requireManager(config, placeId)
      const used = state.photos.filter((p) => p.venueId === placeId && p.status !== 'rejected')
      if (used.length >= limitOf(config, world, placeId)) return err('photo_limit')
      const id = `vp-${crypto.randomUUID()}`
      state.photos.push({
        id,
        venueId: placeId,
        url: photoUrl(blob, id),
        status: 'pending',
        reason: null,
        isCover: false,
        createdAt: new Date().toISOString(),
        visible: false,
      })
      return ok(managed(config, world, placeId))
    },
    async removePhoto(placeId, photoId) {
      await wait()
      requireManager(config, placeId)
      state.photos = state.photos.filter((p) => !(p.id === photoId && p.venueId === placeId))
      return managed(config, world, placeId)
    },
    async setCoverPhoto(placeId, photoId) {
      await wait()
      requireManager(config, placeId)
      const photo = state.photos.find((p) => p.id === photoId && p.venueId === placeId)
      if (photo?.status !== 'approved') throw new Error('invalid photo')
      for (const p of state.photos) if (p.venueId === placeId) p.isCover = p.id === photoId
      return managed(config, world, placeId)
    },
    async saveExtras(placeId, extras) {
      await wait()
      requireManager(config, placeId)
      state.details[placeId] = { ...extras }
      return { ...extras }
    },
    async setNotice(placeId, notice) {
      await wait()
      requireManager(config, placeId)
      const until =
        notice.kind === 'door'
          ? new Date(Date.now() + DOOR_NOTICE_MINUTES * 60_000).toISOString()
          : notice.until
      if (
        notice.kind !== 'door' &&
        (Date.parse(until) <= Date.now() ||
          Date.parse(until) > Date.now() + OFFER_MAX_HOURS * 3_600_000)
      )
        throw new Error('invalid notice')
      const next: VenueNotice =
        notice.kind === 'door'
          ? { kind: 'door', value: notice.value, until }
          : { kind: notice.kind, until }
      state.notices[placeId] = [
        ...(state.notices[placeId] ?? []).filter((n) => n.kind !== notice.kind),
        next,
      ].sort((a, b) => a.kind.localeCompare(b.kind))
      return liveNotices(config, placeId)
    },
    async clearNotice(placeId, kind) {
      await wait()
      requireManager(config, placeId)
      state.notices[placeId] = (state.notices[placeId] ?? []).filter((n) => n.kind !== kind)
      return liveNotices(config, placeId)
    },
    async report(placeId): Promise<VenueReport> {
      await wait()
      requireManager(config, placeId)
      const place = world.places.find((p) => p.id === placeId)
      const base = Math.max(place?.stats.people ?? 0, 8)
      const views = base * 9 + (state.views[placeId] ?? 0)
      const pro = contractBenefits(config.partners, placeId).some((b) => b.key === 'pro_stats')
      const benefit = contractBenefits(config.partners, placeId).find((b) =>
        b.key.startsWith('sponsor_'),
      )
      return {
        pro,
        summary: period(day(-29), day(0), views, base * 3, base * 4),
        previous: pro
          ? period(day(-59), day(-30), Math.round(views * 0.8), base * 2, base * 3)
          : null,
        daily: pro
          ? Array.from({ length: 30 }, (_, i) => ({
              night: day(i - 29),
              views: i % 7 >= 4 ? base * 2 : 0,
              checkIns: i % 7 >= 4 ? base : 0,
            }))
          : null,
        sponsorships: benefit
          ? [
              {
                tier: benefit.key.replace('sponsor_', '') as 'featured' | 'featured_plus' | 'top',
                from: benefit.from ?? day(-10),
                to: benefit.until ?? day(20),
                during: period(benefit.from ?? day(-10), day(0), views, base * 3, base * 4),
                before: period(day(-60), day(-31), Math.round(views * 0.7), base * 2, base * 3),
              },
            ]
          : [],
        flashes: [],
      }
    },
  }
}

export function createMockShowcaseAdmin(
  config: MockConfig,
  world: WorldState,
  wait: Wait,
): Pick<AdminService, 'venuePhotos' | 'reviewVenuePhoto'> {
  return {
    async venuePhotos(status) {
      await wait()
      return config.showcase.photos
        .filter((p) => p.status === status)
        .map((p) => {
          const place = world.places.find((x) => x.id === p.venueId)
          return {
            id: p.id,
            venueId: p.venueId,
            venueName: place?.name ?? p.venueId,
            city: place?.city ?? '',
            url: p.url,
            status: p.status,
            reason: p.reason,
            isCover: p.isCover,
            createdAt: p.createdAt,
            isTest: false,
          }
        })
    },
    async reviewVenuePhoto(photoId, approve, reason) {
      await wait()
      const photo = config.showcase.photos.find((p) => p.id === photoId)
      if (!photo) throw new Error('not found')
      const text = reason?.trim() ?? ''
      if (!approve && (text.length < 3 || text.length > 200)) throw new Error('invalid review')
      photo.status = approve ? 'approved' : 'rejected'
      photo.reason = approve ? null : text
      photo.isCover = photo.isCover && approve
      audit(config, approve ? 'venue_photo.approve' : 'venue_photo.reject', photoId)
    },
  }
}
