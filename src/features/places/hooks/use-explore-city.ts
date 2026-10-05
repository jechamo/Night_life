import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { usePlatform } from '@/platform'
import { CITIES, cityCenter, DEFAULT_CITY, isCity, type CityName } from '../model/cities'
import { distanceMeters } from '../model/geo'
import { useMyPosition } from './use-places'

const cityKey = ['explore', 'city'] as const
const preferenceKey = 'explore-city'

/** Explicit choice is shared by Home and Discover; only consented GPS is used. */
export function useExploreCity() {
  const { preferences } = usePlatform()
  const queryClient = useQueryClient()
  const [params, setParams] = useSearchParams()
  const { position, city: consentCity } = useMyPosition()
  const { data: stored, isPending } = useQuery({
    queryKey: cityKey,
    queryFn: () => preferences.get(preferenceKey),
    staleTime: Infinity,
  })
  const explicit = params.get('city')
  const nearest = position
    ? CITIES.find((c) => distanceMeters(position, c.center) <= 40_000)
    : undefined
  const city = isCity(explicit)
    ? explicit
    : isCity(stored)
      ? stored
      : (nearest?.name ?? (isCity(consentCity) ? consentCity : DEFAULT_CITY))
  const centered = !position || nearest?.name !== city
  const origin = centered ? cityCenter(city)! : position
  const selectCity = (next: CityName) => {
    queryClient.setQueryData(cityKey, next)
    void preferences.set(preferenceKey, next)
    const search = new URLSearchParams(params)
    search.set('city', next)
    search.delete('place')
    setParams(search, { replace: true })
  }
  return { city, origin, position, centered, selectCity, ready: !isPending }
}
