import { useTranslation } from 'react-i18next'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'
import { GlassCard } from '@/shared/ui/card'
import { Switch } from '@/shared/ui/switch'
import { useSocialPremium, useSocialPremiumActions } from '../hooks/use-social-premium'

export function IncognitoControl() {
  const { t } = useTranslation()
  const { granted } = useEntitlement('incognito')
  const { data } = useSocialPremium()
  const { incognito } = useSocialPremiumActions()
  if (!granted || !data) return null
  return (
    <GlassCard className="mx-4 mt-4 space-y-2">
      <label className="flex items-center justify-between gap-3">
        <span>{t('premium.social.incognito')}</span>
        <Switch
          aria-label={t('premium.social.incognito')}
          checked={data.incognito}
          disabled={incognito.isPending}
          onCheckedChange={(on) => incognito.mutate(on)}
        />
      </label>
      <p className="text-sm text-muted-foreground">{t('premium.social.incognitoBody')}</p>
      {incognito.isError && (
        <p role="alert" className="text-sm text-danger">
          {t('matching.failed')}
        </p>
      )}
    </GlassCard>
  )
}
