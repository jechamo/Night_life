import { useTranslation } from 'react-i18next'
import { ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'

const STEPS = ['open', 'privacy', 'code', 'done'] as const
const DELETED = [
  'profile',
  'messages',
  'matches',
  'verification',
  'thirdParties',
  'subscription',
] as const

/**
 * Public account-deletion page (PRD 6.12 D/G): the URL Google Play asks for and the
 * way to exercise GDPR rights without having the app installed.
 */
export function DeleteAccountInfoScreen() {
  const { t } = useTranslation()
  return (
    <div className="mt-8 space-y-6">
      <h1 className="text-3xl font-semibold">{t('publicWeb.deleteAccount.title')}</h1>
      <p className="text-muted-foreground">{t('publicWeb.deleteAccount.intro')}</p>
      <GlassCard>
        <h2 className="text-xl font-semibold">{t('publicWeb.deleteAccount.howTitle')}</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5">
          {STEPS.map((step) => (
            <li key={step}>{t(`publicWeb.deleteAccount.steps.${step}`)}</li>
          ))}
        </ol>
        <ButtonLink to="/profile/privacy" className="mt-4">
          {t('publicWeb.deleteAccount.inApp')}
        </ButtonLink>
      </GlassCard>
      <section>
        <h2 className="text-xl font-semibold">{t('publicWeb.deleteAccount.whatTitle')}</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
          {DELETED.map((item) => (
            <li key={item}>{t(`publicWeb.deleteAccount.what.${item}`)}</li>
          ))}
        </ul>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{t('publicWeb.deleteAccount.keptTitle')}</h2>
        <p className="mt-2 text-muted-foreground">{t('publicWeb.deleteAccount.kept')}</p>
      </section>
      <section>
        <h2 className="text-xl font-semibold">{t('publicWeb.deleteAccount.rightsTitle')}</h2>
        <p className="mt-2 text-muted-foreground">{t('publicWeb.deleteAccount.rights')}</p>
      </section>
    </div>
  )
}
