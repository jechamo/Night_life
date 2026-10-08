import { z } from 'zod'

/**
 * Roadmap R4 «Escaparate del local» (flag `venue_showcase_enabled`): the venue's own
 * photos (moderated), extra details, what the venue says right now and its results report.
 * Server payloads carry storage paths; adapters turn them into short-lived signed URLs.
 */
export const DRESS_CODES = ['none', 'casual', 'smart', 'elegant'] as const
export type DressCode = (typeof DRESS_CODES)[number]

export const DOOR_STATES = ['no_queue', 'short_queue', 'long_queue', 'almost_full', 'full'] as const
export type DoorState = (typeof DOOR_STATES)[number]

export const OFFER_KINDS = ['free_entry', 'happy_hour'] as const
export type OfferKind = (typeof OFFER_KINDS)[number]
export type NoticeKind = 'door' | OfferKind

/** Free venues: cover + 2. With a plan (sponsorship or Pro): up to 10. */
export const PHOTO_LIMIT_FREE = 3
export const PHOTO_LIMIT_PLAN = 10
/** Door status lasts 90 minutes; offers end at most 8 hours ahead (server rules). */
export const DOOR_NOTICE_MINUTES = 90
export const OFFER_MAX_HOURS = 8
/** Below this every report figure comes as 0 and is shown as «menos de 5» (PRD 4.3). */
export const REPORT_THRESHOLD = 5

const nullableInt = z.number().int().nullable().catch(null)
const nullableBool = z.boolean().nullable().catch(null)

export const venueExtrasSchema = z.object({
  dressCode: z.enum(DRESS_CODES).nullable().catch(null),
  minAge: nullableInt,
  entryPriceCents: nullableInt,
  drinkPriceCents: nullableInt,
  terrace: nullableBool,
  accessible: nullableBool,
})
export type VenueExtras = z.infer<typeof venueExtrasSchema>

export const EMPTY_EXTRAS: VenueExtras = {
  dressCode: null,
  minAge: null,
  entryPriceCents: null,
  drinkPriceCents: null,
  terrace: null,
  accessible: null,
}

export const hasExtras = (extras: VenueExtras | null): extras is VenueExtras =>
  !!extras && Object.values(extras).some((value) => value !== null)

const noticeSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('door'), value: z.enum(DOOR_STATES), until: z.string() }),
  z.object({ kind: z.enum(OFFER_KINDS), value: z.null().optional(), until: z.string() }),
])
export type VenueNotice =
  | { kind: 'door'; value: DoorState; until: string }
  | {
      kind: OfferKind
      until: string
    }

/** Unknown or malformed notices are dropped instead of failing the whole page. */
export function parseNotices(raw: unknown): VenueNotice[] {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item): VenueNotice[] => {
    const parsed = noticeSchema.safeParse(item)
    if (!parsed.success) return []
    const n = parsed.data
    return n.kind === 'door'
      ? [{ kind: 'door', value: n.value, until: n.until }]
      : [{ kind: n.kind, until: n.until }]
  })
}

export const showcaseRawSchema = z.object({
  photos: z.array(z.object({ id: z.string(), path: z.string() })).catch([]),
  details: venueExtrasSchema.nullable().catch(null),
  notices: z.unknown(),
})

export interface ShowcasePhoto {
  id: string
  url: string
}

export interface VenueShowcase {
  photos: ShowcasePhoto[]
  details: VenueExtras | null
  notices: VenueNotice[]
}

export const PHOTO_STATUSES = ['pending', 'approved', 'rejected'] as const
export type PhotoStatus = (typeof PHOTO_STATUSES)[number]

export const managedPhotosRawSchema = z.object({
  limit: z.number().int(),
  plan: z.boolean(),
  photos: z.array(
    z.object({
      id: z.string(),
      path: z.string(),
      status: z.enum(PHOTO_STATUSES),
      reason: z.string().nullable(),
      isCover: z.boolean(),
      createdAt: z.string(),
      visible: z.boolean(),
    }),
  ),
})

export interface ManagedPhoto {
  id: string
  url: string
  status: PhotoStatus
  reason: string | null
  isCover: boolean
  createdAt: string
  /** Approved and within the current plan's limit. */
  visible: boolean
}

export interface VenuePhotos {
  limit: number
  plan: boolean
  photos: ManagedPhoto[]
}

/** Photos that still count towards the limit (rejected ones do not). */
export const usedPhotoSlots = (photos: readonly ManagedPhoto[]) =>
  photos.filter((p) => p.status !== 'rejected').length

const periodSchema = z.object({
  from: z.string(),
  to: z.string(),
  views: z.number(),
  going: z.number(),
  checkIns: z.number(),
  conversion: z.number().nullable(),
})
export type ReportPeriod = z.infer<typeof periodSchema>

export const venueReportSchema = z.object({
  pro: z.boolean(),
  summary: periodSchema,
  previous: periodSchema.nullable(),
  daily: z
    .array(z.object({ night: z.string(), views: z.number(), checkIns: z.number() }))
    .nullable(),
  sponsorships: z.array(
    z.object({
      tier: z.enum(['featured', 'featured_plus', 'top']),
      from: z.string(),
      to: z.string(),
      during: periodSchema,
      before: periodSchema,
    }),
  ),
  flashes: z.array(
    z.object({
      title: z.string(),
      startsAt: z.string(),
      endsAt: z.string(),
      checkIns: z.number(),
      weekBefore: z.number(),
    }),
  ),
})
export type VenueReport = z.infer<typeof venueReportSchema>

/** Whole euros or euros with cents, from 0 to the server maximum. */
export function parseEuros(text: string, maxCents: number): number | null | 'invalid' {
  const trimmed = text.trim().replace(',', '.')
  if (trimmed === '') return null
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(trimmed)) return 'invalid'
  const cents = Math.round(Number(trimmed) * 100)
  return cents > maxCents ? 'invalid' : cents
}

export const formatEuros = (cents: number) =>
  cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2).replace('.', ',')

export const MAX_ENTRY_CENTS = 50_000
export const MAX_DRINK_CENTS = 10_000

/** Relative change between two thresholded figures; null when either is below 5. */
export function change(current: number, before: number): number | null {
  if (current < REPORT_THRESHOLD || before < REPORT_THRESHOLD) return null
  return Math.round(((current - before) / before) * 100)
}
