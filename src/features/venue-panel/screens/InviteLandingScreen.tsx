import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { useOnboardingStatus } from '@/features/onboarding/hooks/use-onboarding-status'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { usePendingInvite } from '../hooks/use-pending-invite'
import { isInviteCode, normalizeInviteCode } from '../model/partners'

/**
 * Roadmap R3: public page for an invitation link. Nothing is redeemed here: the code is
 * kept on this device and the person continues after signing up or signing in.
 */
export function InviteLandingScreen() {
  const { t } = useTranslation()
  const { code: raw = '' } = useParams()
  const code = normalizeInviteCode(raw)
  const valid = isInviteCode(code)
  const enabled = useFeatureFlag('venue_partners_enabled') === 'on'
  const { data: status } = useOnboardingStatus()
  const pending = usePendingInvite()

  useEffect(() => {
    if (valid && enabled) void pending.save(code)
  }, [valid, enabled, code, pending])

  return (
    <>
      <h1 className="mt-8 text-3xl font-semibold">{t('venuePanel.partners.landing.title')}</h1>
      <GlassCard className="mt-6 max-w-prose space-y-4">
        {!enabled ? (
          <p>{t('venuePanel.partners.invite.disabled')}</p>
        ) : !valid ? (
          <p role="alert">{t('venuePanel.partners.landing.invalid')}</p>
        ) : (
          <>
            <p>{t('venuePanel.partners.landing.body')}</p>
            <p className="font-label text-lg tracking-widest">
              {t('venuePanel.partners.landing.code', { code })}
            </p>
            {status === 'completed' ? (
              <ButtonLink to={`/venue/invitacion?code=${encodeURIComponent(code)}`} block>
                {t('venuePanel.partners.landing.continue')}
              </ButtonLink>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <ButtonLink to="/onboarding" block>
                  {t('venuePanel.partners.landing.signup')}
                </ButtonLink>
                <ButtonLink to="/login" variant="outline" block>
                  {t('venuePanel.partners.landing.login')}
                </ButtonLink>
              </div>
            )}
          </>
        )}
      </GlassCard>
    </>
  )
}
