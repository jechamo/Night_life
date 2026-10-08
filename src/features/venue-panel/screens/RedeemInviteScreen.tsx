import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useSearchParams } from 'react-router'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { TextField } from '@/shared/ui/text-field'
import { VenueTermsCheckbox } from '../components/VenueTermsCheckbox'
import { usePendingInvite } from '../hooks/use-pending-invite'
import { useInvitePreview, useRedeemInvite } from '../hooks/use-venue-panel'
import { isInviteCode, normalizeInviteCode } from '../model/partners'

const ERRORS = ['invalid_code', 'already_manager', 'terms_required'] as const

/** Roadmap R3: redeem a venue invitation (accepting the venue terms) without a claim. */
export function RedeemInviteScreen() {
  const { t } = useTranslation()
  const enabled = useFeatureFlag('venue_partners_enabled') === 'on'
  const [params] = useSearchParams()
  const pending = usePendingInvite()
  const [input, setInput] = useState(params.get('code') ?? '')
  const [code, setCode] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)
  const preview = useInvitePreview(code ?? '', enabled && code !== null)
  const redeem = useRedeemInvite()

  // A link opened before signing in fills the code (it stays until it is used).
  useEffect(() => {
    if (input) return
    void pending.read().then((saved) => saved && setInput(saved))
  }, [input, pending])

  if (redeem.data?.ok) return <Navigate to={`/venue/${redeem.data.value.placeId}`} replace />

  const value = preview.data?.ok ? preview.data.value : null
  const failure =
    (preview.data && !preview.data.ok && preview.data.error) ||
    (redeem.data && !redeem.data.ok && redeem.data.error) ||
    (preview.isError || redeem.isError ? 'generic' : null)

  return (
    <>
      <ScreenHeader
        title={t('venuePanel.partners.invite.title')}
        description={t('venuePanel.partners.invite.body')}
        backTo="/venue"
      />
      <div className="px-safe mt-6">
        <GlassCard className="space-y-4">
          {!enabled ? (
            <p>{t('venuePanel.partners.invite.disabled')}</p>
          ) : (
            <>
              <TextField
                label={t('venuePanel.partners.invite.codeLabel')}
                value={input}
                maxLength={20}
                autoCapitalize="characters"
                autoComplete="off"
                onChange={(e) => {
                  setInput(e.target.value)
                  setCode(null)
                  setAccepted(false)
                }}
              />
              <Button
                block
                variant="outline"
                disabled={!isInviteCode(input) || preview.isFetching}
                onClick={() => setCode(normalizeInviteCode(input))}
              >
                {t('venuePanel.partners.invite.check')}
              </Button>
              {value && (
                <div className="space-y-3">
                  <p className="text-lg font-semibold">
                    {t('venuePanel.partners.invite.venue', {
                      venue: value.venueName,
                      city: value.city ?? '',
                    })}
                  </p>
                  {value.accountName && (
                    <p className="text-sm">
                      {t('venuePanel.partners.invite.account', { name: value.accountName })}
                    </p>
                  )}
                  <p className="text-sm">
                    {t('venuePanel.partners.invite.role', {
                      role: t(`venuePanel.partners.roles.${value.role}`),
                    })}
                  </p>
                  {value.alreadyManager ? (
                    <p>{t('venuePanel.partners.invite.alreadyManager')}</p>
                  ) : (
                    <>
                      <VenueTermsCheckbox checked={accepted} onCheckedChange={setAccepted} />
                      <Button
                        block
                        disabled={!accepted || redeem.isPending}
                        onClick={() =>
                          code &&
                          redeem.mutate(
                            { code, acceptTerms: accepted },
                            { onSuccess: (result) => void (result.ok && pending.clear()) },
                          )
                        }
                      >
                        {t('venuePanel.partners.invite.redeem')}
                      </Button>
                    </>
                  )}
                </div>
              )}
              {failure && (
                <p role="alert" className="text-sm text-danger">
                  {(ERRORS as readonly string[]).includes(failure)
                    ? t(`venuePanel.partners.invite.errors.${failure as (typeof ERRORS)[number]}`)
                    : t('venuePanel.partners.invite.errors.generic')}
                </p>
              )}
            </>
          )}
        </GlassCard>
      </div>
    </>
  )
}
