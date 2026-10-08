import { z } from 'zod'

/**
 * Roadmap R5 (flag `venue_bookings_enabled`): table/bottle reservations without payment and
 * guest lists with a QR code. The venue only sees the profile name, party and time.
 */
export const RESERVATION_KINDS = ['table', 'bottle'] as const
export type ReservationKind = (typeof RESERVATION_KINDS)[number]

export const RESERVATION_STATUSES = [
  'requested',
  'accepted',
  'rejected',
  'cancelled',
  'expired',
] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]

/** Server rules mirrored for the forms (the server checks them again). */
export const MAX_ACTIVE_RESERVATIONS = 3
export const BOOKING_MIN_MINUTES_AHEAD = 30
export const BOOKING_MAX_DAYS_AHEAD = 14
export const GUESTLIST_MAX_HOURS = 12
export const GUESTLIST_MAX_CAPACITY = 500
export const REJECT_REASON_MAX = 200

export const reservationSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  placeName: z.string().optional(),
  name: z.string().optional(),
  arriveAt: z.string(),
  party: z.number().int(),
  kind: z.enum(RESERVATION_KINDS),
  status: z.enum(RESERVATION_STATUSES),
  reason: z.string().nullable(),
})
export type Reservation = z.infer<typeof reservationSchema>

export const GUEST_STATUSES = ['confirmed', 'cancelled', 'checked_in'] as const
export type GuestStatus = (typeof GUEST_STATUSES)[number]

export const guestEntrySchema = z.object({
  id: z.string(),
  listId: z.string(),
  placeId: z.string(),
  placeName: z.string(),
  title: z.string(),
  validUntil: z.string(),
  night: z.string(),
  status: z.enum(GUEST_STATUSES),
  code: z.string().nullable(),
})
export type GuestEntry = z.infer<typeof guestEntrySchema>

export const bookingOptionsSchema = z.object({
  reservations: z.boolean(),
  maxParty: z.number().int(),
  ageVerified: z.boolean(),
  ownVenue: z.boolean(),
  guestlist: z
    .object({ id: z.string(), title: z.string(), validUntil: z.string(), full: z.boolean() })
    .nullable(),
  myEntry: guestEntrySchema.nullable(),
  myReservations: z.array(reservationSchema),
})
export type BookingOptions = z.infer<typeof bookingOptionsSchema>

export const myBookingsSchema = z.object({
  reservations: z.array(reservationSchema),
  entries: z.array(guestEntrySchema),
})
export type MyBookings = z.infer<typeof myBookingsSchema>

export const bookingSettingsSchema = z.object({
  reservations: z.boolean(),
  guestlists: z.boolean(),
  maxParty: z.number().int(),
})
export type BookingSettings = z.infer<typeof bookingSettingsSchema>

export const venueReservationsSchema = z.object({
  settings: bookingSettingsSchema,
  items: z.array(reservationSchema),
})
export type VenueReservations = z.infer<typeof venueReservationsSchema>

export const venueGuestlistSchema = z.object({
  settings: bookingSettingsSchema,
  list: z
    .object({
      id: z.string(),
      title: z.string(),
      validUntil: z.string(),
      capacity: z.number().int(),
      status: z.enum(['open', 'closed']),
      entries: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          status: z.enum(GUEST_STATUSES),
          checkedInAt: z.string().nullable(),
        }),
      ),
    })
    .nullable(),
})
export type VenueGuestlist = z.infer<typeof venueGuestlistSchema>

export const doorResultSchema = z.object({
  result: z.enum(['ok', 'already_used']),
  name: z.string(),
  checkedInAt: z.string().nullable(),
})
export type DoorResult = z.infer<typeof doorResultSchema>

export type ReservationError =
  'not_available' | 'own_venue' | 'booking_limit' | 'already_booked' | 'age_required' | 'invalid'
export type GuestlistError = 'not_available' | 'own_venue' | 'list_full' | 'age_required'

/** 10 hex characters shown as NL-XXXXX-XXXXX; the QR carries NL:XXXXXXXXXX. */
export const formatGuestCode = (code: string) => `NL-${code.slice(0, 5)}-${code.slice(5, 10)}`
export const guestQrPayload = (code: string) => `NL:${code}`

/** Accepts what a door scan or a person types: QR text, dashes, spaces, lower case. */
export function normalizeGuestCode(input: string): string | null {
  const hex = input
    .toUpperCase()
    .replace(/^NL[:-]?/, '')
    .replace(/[^0-9A-F]/g, '')
  return /^[0-9A-F]{10}$/.test(hex) ? hex : null
}

/** A reservation still counts while it is requested or accepted and not in the past. */
export const isActiveReservation = (r: Reservation, now = Date.now()) =>
  (r.status === 'requested' || r.status === 'accepted') && Date.parse(r.arriveAt) > now
