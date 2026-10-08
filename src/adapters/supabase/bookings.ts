import {
  bookingOptionsSchema,
  bookingSettingsSchema,
  doorResultSchema,
  guestEntrySchema,
  myBookingsSchema,
  reservationSchema,
  venueGuestlistSchema,
  venueReservationsSchema,
} from '@/features/bookings/model/bookings'
import type { PlacesService } from '@/features/places/services/places-service'
import type { VenuePanelService } from '@/features/venue-panel/services/venue-panel-service'
import { err, ok } from '@/shared/lib/result'
import { refusal } from './business'
import type { Db } from './client'
import { must } from './errors'

/** Roadmap R5: reservations without payment and guest lists (server checks the flag). */
export function createBookingPlaces(
  db: Db,
): Pick<
  PlacesService,
  | 'bookingOptions'
  | 'requestReservation'
  | 'cancelReservation'
  | 'joinGuestlist'
  | 'leaveGuestlist'
  | 'myBookings'
> {
  return {
    async bookingOptions(placeId) {
      return bookingOptionsSchema.parse(must(await db.rpc('venue_bookings', { p_venue: placeId })))
    },
    async requestReservation(placeId, input) {
      const result = await db.rpc('reservation_request', {
        p_venue: placeId,
        p_arrive_at: input.arriveAt,
        p_party: input.party,
        p_kind: input.kind,
      })
      if (result.error) {
        const code = refusal(result.error, [
          'not_available',
          'own_venue',
          'booking_limit',
          'already_booked',
          'age_required',
          'invalid booking',
        ] as const)
        return err(code === 'invalid booking' ? 'invalid' : code)
      }
      return ok(reservationSchema.parse(must(result)))
    },
    async cancelReservation(id) {
      return reservationSchema.parse(must(await db.rpc('reservation_cancel', { p_id: id })))
    },
    async joinGuestlist(listId) {
      const result = await db.rpc('guestlist_join', { p_list: listId })
      if (result.error)
        return err(
          refusal(result.error, [
            'not_available',
            'own_venue',
            'list_full',
            'age_required',
          ] as const),
        )
      return ok(guestEntrySchema.parse(must(result)))
    },
    async leaveGuestlist(entryId) {
      return guestEntrySchema.parse(must(await db.rpc('guestlist_leave', { p_entry: entryId })))
    },
    async myBookings() {
      return myBookingsSchema.parse(must(await db.rpc('my_bookings')))
    },
  }
}

export function createBookingPanel(
  db: Db,
): Pick<
  VenuePanelService,
  | 'saveBookingSettings'
  | 'reservations'
  | 'decideReservation'
  | 'guestlist'
  | 'saveGuestlist'
  | 'closeGuestlist'
  | 'checkInGuest'
> {
  return {
    async saveBookingSettings(placeId, settings) {
      return bookingSettingsSchema.parse(
        must(
          await db.rpc('venue_booking_settings_save', {
            p_venue: placeId,
            p_reservations: settings.reservations,
            p_guestlists: settings.guestlists,
            p_max_party: settings.maxParty,
          }),
        ),
      )
    },
    async reservations(placeId) {
      return venueReservationsSchema.parse(
        must(await db.rpc('venue_reservations', { p_venue: placeId })),
      )
    },
    async decideReservation(placeId, id, accept, reason) {
      return reservationSchema.parse(
        must(
          await db.rpc('venue_reservation_decide', {
            p_venue: placeId,
            p_id: id,
            p_accept: accept,
            p_reason: reason ?? null,
          }),
        ),
      )
    },
    async guestlist(placeId) {
      return venueGuestlistSchema.parse(must(await db.rpc('venue_guestlist', { p_venue: placeId })))
    },
    async saveGuestlist(placeId, input) {
      const result = await db.rpc('venue_guestlist_save', {
        p_venue: placeId,
        p_title: input.title,
        p_valid_until: input.validUntil,
        p_capacity: input.capacity,
      })
      if (result.error) return err(refusal(result.error, ['not_available'] as const))
      return ok(venueGuestlistSchema.parse(must(result)))
    },
    async closeGuestlist(placeId) {
      return venueGuestlistSchema.parse(
        must(await db.rpc('venue_guestlist_close', { p_venue: placeId })),
      )
    },
    async checkInGuest(placeId, code) {
      const result = await db.rpc('venue_guestlist_checkin', { p_venue: placeId, p_code: code })
      if (result.error) return err(refusal(result.error, ['invalid_code'] as const))
      return ok(doorResultSchema.parse(must(result)))
    },
  }
}
