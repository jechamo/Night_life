import { Map } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { Button, ButtonLink } from '@/shared/ui/button'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Skeleton } from '@/shared/ui/skeleton'
import { usePlaceDetail } from '@/features/home/hooks/use-dashboard'
import { useExploreCity } from './hooks/use-explore-city'
import { PlaceDetails } from './components/PlaceDetails'

export function PlaceScreen() {
  const { t } = useTranslation()
  const { placeId = '' } = useParams()
  const { origin } = useExploreCity()
  const query = usePlaceDetail(placeId)
  return (
    <>
      <ScreenHeader title={query.data?.name ?? t('home.place')} backTo="/home" />
      <div className="px-safe mt-5">
        {query.isPending ? (
          <Skeleton className="h-80" />
        ) : query.isError ? (
          <div role="alert">
            <p>{t('errors.generic.title')}</p>
            <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
          </div>
        ) : query.data ? (
          <>
            <PlaceDetails place={query.data} origin={origin} />
            <ButtonLink
              to={`/discover?place=${query.data.id}&city=${encodeURIComponent(query.data.city ?? '')}`}
              variant="outline"
            >
              <Map aria-hidden />
              {t('home.viewMap')}
            </ButtonLink>
          </>
        ) : (
          <p className="py-8">{t('home.placeUnavailable')}</p>
        )}
      </div>
    </>
  )
}
