import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { BookingSettings, ReservationKind } from '@/features/bookings/model/bookings'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { useServices } from '@/shared/services/ServicesProvider'
import { useSessionMutation } from '@/shared/session/use-session-mutation'

// Roadmap R5 (flag `venue_bookings_enabled`, checked by the server too).
export const bookingOptionsKey = (placeId: string) => ['places', placeId, 'bookings'] as const
export const myBookingsKey = ['bookings', 'mine'] as const
const venueReservationsKey = (placeId: string) => ['venue-panel', 'reservations', placeId] as const
const venueGuestlistKey = (placeId: string) => ['venue-panel', 'guestlist', placeId] as const

export const useBookingsEnabled = () => useFeatureFlag('venue_bookings_enabled') === 'on'

function useInvalidateMine() {
  const queryClient = useQueryClient()
  return (placeId?: string) => {
    void queryClient.invalidateQueries({ queryKey: myBookingsKey })
    if (placeId) void queryClient.invalidateQueries({ queryKey: bookingOptionsKey(placeId) })
  }
}

export function useBookingOptions(placeId: string, enabled: boolean) {
  const { places } = useServices()
  return useQuery({
    queryKey: bookingOptionsKey(placeId),
    queryFn: () => places.bookingOptions(placeId),
    enabled,
  })
}

export function useMyBookings(enabled: boolean) {
  const { places } = useServices()
  return useQuery({
    queryKey: myBookingsKey,
    queryFn: () => places.myBookings(),
    enabled,
    // Venue answers arrive without a refresh while the screen is open.
    refetchInterval: 60_000,
  })
}

export function useRequestReservation(placeId: string) {
  const { places } = useServices()
  const invalidate = useInvalidateMine()
  return useSessionMutation({
    mutationFn: async (input: { arriveAt: string; party: number; kind: ReservationKind }) => {
      const result = await places.requestReservation(placeId, input)
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
    onSuccess: () => invalidate(placeId),
  })
}

export function useCancelReservation() {
  const { places } = useServices()
  const invalidate = useInvalidateMine()
  return useSessionMutation({
    mutationFn: (id: string) => places.cancelReservation(id),
    onSuccess: (r) => invalidate(r.placeId),
  })
}

export function useJoinGuestlist(placeId: string) {
  const { places } = useServices()
  const invalidate = useInvalidateMine()
  return useSessionMutation({
    mutationFn: async (listId: string) => {
      const result = await places.joinGuestlist(listId)
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
    onSuccess: () => invalidate(placeId),
  })
}

export function useLeaveGuestlist() {
  const { places } = useServices()
  const invalidate = useInvalidateMine()
  return useSessionMutation({
    mutationFn: (entryId: string) => places.leaveGuestlist(entryId),
    onSuccess: (e) => invalidate(e.placeId),
  })
}

// Venue side.
export function useVenueReservations(placeId: string, enabled: boolean) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: venueReservationsKey(placeId),
    queryFn: () => venuePanel.reservations(placeId),
    enabled,
    refetchInterval: 60_000,
  })
}

export function useVenueGuestlist(placeId: string, enabled: boolean) {
  const { venuePanel } = useServices()
  return useQuery({
    queryKey: venueGuestlistKey(placeId),
    queryFn: () => venuePanel.guestlist(placeId),
    enabled,
  })
}

function useInvalidateVenue(placeId: string) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: venueReservationsKey(placeId) })
    void queryClient.invalidateQueries({ queryKey: venueGuestlistKey(placeId) })
    void queryClient.invalidateQueries({ queryKey: bookingOptionsKey(placeId) })
  }
}

export function useSaveBookingSettings(placeId: string) {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateVenue(placeId)
  return useSessionMutation({
    mutationFn: (settings: BookingSettings) => venuePanel.saveBookingSettings(placeId, settings),
    onSuccess: invalidate,
  })
}

export function useDecideReservation(placeId: string) {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateVenue(placeId)
  return useSessionMutation({
    mutationFn: (input: { id: string; accept: boolean; reason?: string }) =>
      venuePanel.decideReservation(placeId, input.id, input.accept, input.reason),
    onSuccess: invalidate,
  })
}

export function useSaveGuestlist(placeId: string) {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateVenue(placeId)
  return useSessionMutation({
    mutationFn: async (input: { title: string; validUntil: string; capacity: number }) => {
      const result = await venuePanel.saveGuestlist(placeId, input)
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
    onSuccess: invalidate,
  })
}

export function useCloseGuestlist(placeId: string) {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateVenue(placeId)
  return useSessionMutation({
    mutationFn: () => venuePanel.closeGuestlist(placeId),
    onSuccess: invalidate,
  })
}

export function useCheckInGuest(placeId: string) {
  const { venuePanel } = useServices()
  const invalidate = useInvalidateVenue(placeId)
  return useSessionMutation({
    mutationFn: async (code: string) => {
      const result = await venuePanel.checkInGuest(placeId, code)
      if (!result.ok) throw new Error(result.error)
      return result.value
    },
    onSuccess: invalidate,
  })
}
