import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { usePlatform } from '@/platform'
import type { LatLng } from '@/features/places/model/types'
import { useServices } from '@/shared/services/ServicesProvider'
import type { AttendanceState } from '../services/attendance-service'

export const attendanceKey = ['attendance', 'mine'] as const

export function useAttendance() {
  const { attendance } = useServices()
  return useQuery({ queryKey: attendanceKey, queryFn: () => attendance.getMine() })
}

/**
 * Manual check-in: reads the position once through the platform layer, the
 * server checks the 150 m radius and only "place + time" is kept. In test mode
 * `simulateAt` lets testers stand "inside" a venue.
 */
export function useCheckIn() {
  const { attendance } = useServices()
  const { geolocation } = usePlatform()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      placeId,
      visible,
      simulateAt,
    }: {
      placeId: string
      visible: boolean
      simulateAt?: LatLng
    }) => {
      let position: LatLng | null = simulateAt ?? null
      if (!position) {
        const result = await geolocation.getCurrentPosition({ highAccuracy: true })
        position = result.ok ? { lat: result.value.latitude, lng: result.value.longitude } : null
      }
      return attendance.checkIn(placeId, position, { visible })
    },
    onSuccess: async (result) => {
      if (result.ok) queryClient.setQueryData<AttendanceState>(attendanceKey, result.value)
      await queryClient.invalidateQueries({ queryKey: ['matching'] })
    },
  })
}

export function useCheckOut() {
  const { attendance } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => attendance.checkOut(),
    onSuccess: (state) => queryClient.setQueryData(attendanceKey, state),
  })
}

export function useGoingTonight() {
  const { attendance } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ placeId, going }: { placeId: string; going: boolean }) =>
      going
        ? attendance.setGoing(placeId)
        : { ok: true as const, value: await attendance.cancelGoing() },
    onSuccess: async (result) => {
      if (result.ok) queryClient.setQueryData(attendanceKey, result.value)
      await queryClient.invalidateQueries({ queryKey: ['matching'] })
    },
  })
}
