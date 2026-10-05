import { useTranslation } from 'react-i18next'
import { useSocialPremium, useSocialPremiumActions } from '../hooks/use-social-premium'
import { Button } from '@/shared/ui/button'

export function SparkNotice() {
  const { t } = useTranslation()
  const { data } = useSocialPremium()
  const { seen } = useSocialPremiumActions()
  if (!data?.sparksUnread) return null
  return (
    <div role="status" className="glass mx-4 mt-3 flex items-center gap-3 rounded-theme p-3">
      <p className="flex-1 text-sm">
        {t('premium.social.sparkNotice', { count: data.sparksUnread })}
      </p>
      <Button variant="ghost" size="sm" disabled={seen.isPending} onClick={() => seen.mutate()}>
        {t('premium.social.dismiss')}
      </Button>
    </div>
  )
}
