import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import { useSessionMutation } from '@/shared/session/use-session-mutation'
import type { CityName } from '@/features/places/model/cities'
import type { LatLng } from '@/features/places/model/types'

export const dashboardKey = ['dashboard'] as const
export const favoritesKey = ['favorites'] as const
export const placeDetailKey = (id: string) => ['places', 'detail', id] as const

export function usePlaceDetail(id: string, enabled = true) {
  const { places } = useServices()
  return useQuery({
    queryKey: placeDetailKey(id),
    queryFn: () => places.getById(id),
    enabled,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })
}

export function useDashboard(city: CityName, origin: LatLng, ready: boolean) {
  const { dashboard } = useServices()
  return useQuery({
    queryKey: [...dashboardKey, city, origin.lat, origin.lng],
    queryFn: () => dashboard.summary(city, origin),
    enabled: ready,
    staleTime: 30_000,
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })
}

export function useFavorites(offset = 0) {
  const { dashboard } = useServices()
  return useQuery({
    queryKey: [...favoritesKey, offset],
    queryFn: () => dashboard.favorites(offset),
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  })
}

export function useFavorite() {
  const { dashboard } = useServices()
  const client = useQueryClient()
  return useSessionMutation({
    mutationFn: ({ id, saved }: { id: string; saved: boolean }) => dashboard.setFavorite(id, saved),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: dashboardKey }),
        client.invalidateQueries({ queryKey: favoritesKey }),
        client.invalidateQueries({ queryKey: ['places'] }),
      ])
    },
  })
}
