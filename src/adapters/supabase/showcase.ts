import { z } from 'zod'
import type { AdminService, AdminVenuePhoto } from '@/features/admin/services/admin-service'
import {
  managedPhotosRawSchema,
  parseNotices,
  PHOTO_STATUSES,
  showcaseRawSchema,
  venueExtrasSchema,
  venueReportSchema,
  type VenuePhotos,
} from '@/features/places/model/showcase'
import type { PlacesService } from '@/features/places/services/places-service'
import type { VenuePanelService } from '@/features/venue-panel/services/venue-panel-service'
import { err, ok } from '@/shared/lib/result'
import type { Db } from './client'
import { errorMessage, must } from './errors'
import { done, refusal } from './business'

/** Roadmap R4: private bucket, short-lived signed URLs (PRD 6.15 D). */
export const VENUE_PHOTO_BUCKET = 'venue-photos'
export const VENUE_PHOTO_URL_SECONDS = 900

const extensionFor = (type: string) =>
  type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp'

async function signPaths(db: Db, paths: readonly string[]): Promise<Map<string, string>> {
  if (paths.length === 0) return new Map()
  const signed = must(
    await db.storage.from(VENUE_PHOTO_BUCKET).createSignedUrls([...paths], VENUE_PHOTO_URL_SECONDS),
  )
  const urls = new Map<string, string>()
  for (const item of signed) if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl)
  return urls
}

async function toVenuePhotos(db: Db, raw: unknown): Promise<VenuePhotos> {
  const data = managedPhotosRawSchema.parse(raw)
  const urls = await signPaths(
    db,
    data.photos.map((p) => p.path),
  )
  return {
    limit: data.limit,
    plan: data.plan,
    photos: data.photos.map(({ path, ...photo }) => ({ ...photo, url: urls.get(path) ?? '' })),
  }
}

export function createShowcasePlaces(
  db: Db,
): Pick<PlacesService, 'showcase' | 'covers' | 'trackView'> {
  return {
    async showcase(placeId) {
      const raw = showcaseRawSchema.parse(
        must(await db.rpc('venue_showcase', { p_venue: placeId })),
      )
      const urls = await signPaths(
        db,
        raw.photos.map((p) => p.path),
      )
      return {
        photos: raw.photos.flatMap((p) => {
          const url = urls.get(p.path)
          return url ? [{ id: p.id, url }] : []
        }),
        details: raw.details,
        notices: parseNotices(raw.notices),
      }
    },
    async covers() {
      const rows = z
        .array(z.object({ venueId: z.string(), path: z.string() }))
        .catch([])
        .parse(must(await db.rpc('venue_covers')))
      const urls = await signPaths(
        db,
        rows.map((r) => r.path),
      )
      const covers: Record<string, string> = {}
      for (const row of rows) {
        const url = urls.get(row.path)
        if (url) covers[row.venueId] = url
      }
      return covers
    },
    async trackView(placeId) {
      done(await db.rpc('place_view', { p_venue: placeId }))
    },
  }
}

type ShowcasePanel = Pick<
  VenuePanelService,
  | 'photos'
  | 'uploadPhoto'
  | 'removePhoto'
  | 'setCoverPhoto'
  | 'saveExtras'
  | 'setNotice'
  | 'clearNotice'
  | 'report'
>

export function createShowcasePanel(db: Db): ShowcasePanel {
  return {
    async photos(placeId) {
      return toVenuePhotos(db, must(await db.rpc('venue_photos_manage', { p_venue: placeId })))
    },
    async uploadPhoto(placeId, blob) {
      const path = `${placeId}/${crypto.randomUUID()}.${extensionFor(blob.type)}`
      const upload = await db.storage
        .from(VENUE_PHOTO_BUCKET)
        .upload(path, blob, { contentType: blob.type || 'image/webp', upsert: false })
      // The Storage policy refuses uploads past twice the plan limit (RLS); others throw.
      if (upload.error) {
        if (/row-level security|unauthorized|403/i.test(errorMessage(upload.error)))
          return err('photo_limit')
        throw upload.error
      }
      const result = await db.rpc('venue_photo_add', { p_venue: placeId, p_path: path })
      if (result.error) {
        await db.storage.from(VENUE_PHOTO_BUCKET).remove([path])
        return err(refusal(result.error, ['photo_limit'] as const))
      }
      return ok(await toVenuePhotos(db, must(result)))
    },
    async removePhoto(placeId, photoId) {
      const path = must(await db.rpc('venue_photo_remove', { p_venue: placeId, p_photo: photoId }))
      // The row is gone first; the object follows (allowed only once nothing points to it).
      await db.storage.from(VENUE_PHOTO_BUCKET).remove([path])
      return toVenuePhotos(db, must(await db.rpc('venue_photos_manage', { p_venue: placeId })))
    },
    async setCoverPhoto(placeId, photoId) {
      return toVenuePhotos(
        db,
        must(await db.rpc('venue_photo_set_cover', { p_venue: placeId, p_photo: photoId })),
      )
    },
    async saveExtras(placeId, extras) {
      return venueExtrasSchema.parse(
        must(await db.rpc('venue_details_save', { p_venue: placeId, p: { ...extras } })),
      )
    },
    async setNotice(placeId, notice) {
      return parseNotices(
        must(
          await db.rpc('venue_notice_set', {
            p_venue: placeId,
            p_kind: notice.kind,
            p_value: notice.kind === 'door' ? notice.value : null,
            p_until: notice.kind === 'door' ? null : notice.until,
          }),
        ),
      )
    },
    async clearNotice(placeId, kind) {
      return parseNotices(
        must(await db.rpc('venue_notice_clear', { p_venue: placeId, p_kind: kind })),
      )
    },
    async report(placeId) {
      return venueReportSchema.parse(must(await db.rpc('venue_report', { p_venue: placeId })))
    },
  }
}

const adminPhotoSchema = z.object({
  id: z.string(),
  venueId: z.string(),
  venueName: z.string(),
  city: z.string(),
  path: z.string(),
  status: z.enum(PHOTO_STATUSES),
  reason: z.string().nullable(),
  isCover: z.boolean(),
  createdAt: z.string(),
  isTest: z.boolean(),
})

export function createShowcaseAdmin(
  db: Db,
): Pick<AdminService, 'venuePhotos' | 'reviewVenuePhoto'> {
  return {
    async venuePhotos(status): Promise<AdminVenuePhoto[]> {
      const rows = z
        .array(adminPhotoSchema)
        .parse(must(await db.rpc('admin_venue_photos', { p_status: status })))
      const urls = await signPaths(
        db,
        rows.map((r) => r.path),
      )
      return rows.map(({ path, ...row }) => ({ ...row, url: urls.get(path) ?? '' }))
    },
    async reviewVenuePhoto(photoId, approve, reason) {
      done(
        await db.rpc('admin_venue_photo_review', {
          p_photo: photoId,
          p_approve: approve,
          p_reason: reason ?? null,
        }),
      )
    },
  }
}
