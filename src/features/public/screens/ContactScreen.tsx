import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'

const CHANNELS = ['general', 'privacy', 'dsa', 'venues'] as const

/** Public contact page, including the DSA single point of contact (PRD 6.1 doc 1). */
export function ContactScreen() {
  const { t } = useTranslation()
  return (
    <div className="mt-8 space-y-6">
      <h1 className="text-3xl font-semibold">{t('publicWeb.contact.title')}</h1>
      <p className="text-muted-foreground">{t('publicWeb.contact.intro')}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        {CHANNELS.map((channel) => (
          <GlassCard key={channel}>
            <h2 className="font-semibold">{t(`publicWeb.contact.channels.${channel}.title`)}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t(`publicWeb.contact.channels.${channel}.body`)}
            </p>
          </GlassCard>
        ))}
      </div>
      <ButtonLink to="/legal/illegal-content" variant="outline">
        {t('publicWeb.illegal.title')}
      </ButtonLink>
    </div>
  )
}
