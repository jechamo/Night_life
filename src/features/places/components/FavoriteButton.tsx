import { Bookmark } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useFavorite } from '@/features/home/hooks/use-dashboard'
import { Button } from '@/shared/ui/button'
import type { Place } from '../model/types'

export function FavoriteButton({ place }: { place: Place }) {
  const { t } = useTranslation()
  const action = useFavorite()
  if (place.type === 'event') return null
  return (
    <div className="relative">
      <Button
        size="icon"
        variant="glass"
        aria-pressed={place.favorite === true}
        aria-label={t(place.favorite ? 'home.unfavorite' : 'home.favorite', { name: place.name })}
        disabled={action.isPending}
        onClick={() => action.mutate({ id: place.id, saved: !place.favorite })}
      >
        <Bookmark aria-hidden className={place.favorite ? 'fill-primary text-primary' : ''} />
      </Button>
      {action.isError && (
        <span
          role="alert"
          className="absolute right-0 top-full z-10 w-48 rounded-theme bg-surface p-2 text-xs text-danger"
        >
          {t('errors.generic.description')}
        </span>
      )}
    </div>
  )
}
