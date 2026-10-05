import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useExploreCity } from '@/features/places/hooks/use-explore-city'
import { Button } from '@/shared/ui/button'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Skeleton } from '@/shared/ui/skeleton'
import { VenueTile } from './HomeScreen'
import { useFavorites } from './hooks/use-dashboard'

export function FavoritesScreen() {
  const { t } = useTranslation()
  const [offset, setOffset] = useState(0)
  const { origin } = useExploreCity()
  const query = useFavorites(offset)
  return (
    <>
      <ScreenHeader title={t('home.favorites')} backTo="/home" />
      <div className="px-safe mt-5">
        {query.isPending ? (
          <Skeleton className="h-72" />
        ) : query.isError ? (
          <div role="alert">
            <p>{t('errors.generic.title')}</p>
            <Button onClick={() => void query.refetch()}>{t('common.retry')}</Button>
          </div>
        ) : (
          query.data && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {query.data.places.map((p) => (
                  <VenueTile key={p.id} place={p} origin={origin} />
                ))}
              </div>
              {query.data.total === 0 && (
                <p className="py-10 text-center text-muted-foreground">{t('home.noFavorites')}</p>
              )}
              <div className="mt-6 flex justify-between gap-3">
                {offset > 0 && (
                  <Button variant="outline" onClick={() => setOffset(Math.max(0, offset - 50))}>
                    {t('common.back')}
                  </Button>
                )}
                {offset + 50 < query.data.total && (
                  <Button onClick={() => setOffset(offset + 50)}>{t('common.next')}</Button>
                )}
              </div>
            </>
          )
        )}
      </div>
    </>
  )
}
