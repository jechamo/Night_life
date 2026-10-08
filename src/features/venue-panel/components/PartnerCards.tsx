import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSignDocuments, useLegalDocuments } from '@/features/legal/hooks/use-legal-documents'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { useQueryClient } from '@tanstack/react-query'
import {
  useCancelStaffInvite,
  useInviteStaff,
  useRemoveStaff,
  useVenuePartnerState,
  useVenueTeam,
} from '../hooks/use-venue-panel'
import { InvitationNotice } from './InvitationNotice'
import { VenueTermsCheckbox } from './VenueTermsCheckbox'

const VENUE_TERMS = ['venues'] as const

function useDate() {
  const { i18n } = useTranslation()
  return (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value))
      : '—'
}

/** Roadmap R3: company, contract, active advantages (with their origin) and venue terms. */
export function PlanCard({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const date = useDate()
  const queryClient = useQueryClient()
  const { data: state, isError } = useVenuePartnerState(placeId, true)
  const { data: terms } = useLegalDocuments(VENUE_TERMS)
  const sign = useSignDocuments()
  const [accepting, setAccepting] = useState(false)
  const [accepted, setAccepted] = useState(false)
  if (isError) return null
  if (!state) return <GlassCard className="h-32" aria-busy="true" />
  return (
    <GlassCard className="space-y-3">
      {state.role && (
        <Badge tone="neutral">
          {t('venuePanel.partners.plan.yourRole', {
            role: t(`venuePanel.partners.roles.${state.role}`),
          })}
        </Badge>
      )}
      {state.account && (
        <p className="font-medium">
          {t('venuePanel.partners.plan.account', { name: state.account.legalName })}
        </p>
      )}
      <p className="text-sm">
        {state.contract
          ? t('venuePanel.partners.plan.contract', {
              reference: state.contract.reference,
              from: date(state.contract.startsOn),
              to: date(state.contract.endsOn),
            })
          : t('venuePanel.partners.plan.noContract')}
      </p>
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase">
          {t('venuePanel.partners.plan.benefitsTitle')}
        </p>
        {state.benefits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('venuePanel.partners.plan.noBenefits')}
          </p>
        ) : (
          <ul className="mt-1 space-y-1 text-sm">
            {state.benefits.map((b) => (
              <li key={`${b.key}-${b.source}`}>
                {t('venuePanel.partners.plan.benefit', {
                  benefit: t(`venuePanel.partners.plan.benefits.${b.key}`),
                  source: t(`venuePanel.partners.plan.sources.${b.source}`),
                  until: date(b.until),
                })}
              </li>
            ))}
          </ul>
        )}
      </div>
      {state.termsCurrent &&
        (state.termsAccepted ? (
          <p className="text-xs text-muted-foreground">
            {t('venuePanel.partners.plan.termsAccepted', { version: state.termsCurrent })}
          </p>
        ) : (
          <div className="space-y-2 rounded-2xl border border-warning p-3 text-sm">
            <p>{t('venuePanel.partners.plan.termsPending', { version: state.termsCurrent })}</p>
            {accepting ? (
              <>
                <VenueTermsCheckbox checked={accepted} onCheckedChange={setAccepted} />
                <Button
                  size="sm"
                  disabled={!accepted || !terms || sign.isPending}
                  onClick={() =>
                    terms &&
                    sign.mutate(terms, {
                      onSuccess: () =>
                        void queryClient.invalidateQueries({
                          queryKey: ['venue-panel', 'partner', placeId],
                        }),
                    })
                  }
                >
                  {t('venuePanel.partners.plan.termsConfirm')}
                </Button>
              </>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setAccepting(true)}>
                {t('venuePanel.partners.plan.termsAccept')}
              </Button>
            )}
          </div>
        ))}
    </GlassCard>
  )
}

/** Roadmap R3: the owner invites and removes managers. */
export function TeamCard({ placeId }: { placeId: string }) {
  const { t } = useTranslation()
  const date = useDate()
  const { data: team, isError } = useVenueTeam(placeId, true)
  const invite = useInviteStaff(placeId)
  const cancel = useCancelStaffInvite(placeId)
  const remove = useRemoveStaff(placeId)
  if (isError) return null
  if (!team) return <GlassCard className="h-32" aria-busy="true" />
  const created = invite.data?.ok ? invite.data.value : null
  return (
    <GlassCard className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('venuePanel.partners.team.body')}</p>
      <ul className="space-y-1 text-sm">
        {team.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-2">
            <span>
              {m.name} · {t(`venuePanel.partners.roles.${m.role}`)}
              {m.me ? ` ${t('venuePanel.partners.team.me')}` : ''}
            </span>
            {m.role === 'staff' && !m.me && (
              <Button
                size="sm"
                variant="ghost"
                disabled={remove.isPending}
                onClick={() => remove.mutate(m.userId)}
              >
                {t('venuePanel.partners.team.remove')}
              </Button>
            )}
          </li>
        ))}
      </ul>
      {team.invitations.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase">
            {t('venuePanel.partners.team.pending')}
          </p>
          <ul className="mt-1 space-y-1 text-sm">
            {team.invitations.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2">
                <span>
                  {t('venuePanel.partners.team.pendingItem', { date: date(i.expiresAt) })}
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={cancel.isPending}
                  onClick={() => cancel.mutate(i.id)}
                >
                  {t('venuePanel.partners.team.cancel')}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Button block variant="outline" disabled={invite.isPending} onClick={() => invite.mutate()}>
        {t('venuePanel.partners.team.invite')}
      </Button>
      {created && (
        <InvitationNotice
          invitation={created}
          body={t('venuePanel.partners.team.created', { date: date(created.expiresAt) })}
        />
      )}
      {invite.data && !invite.data.ok && (
        <p role="alert" className="text-sm text-danger">
          {t('venuePanel.partners.team.limit')}
        </p>
      )}
      {(invite.isError || cancel.isError || remove.isError) && (
        <p role="alert" className="text-sm text-danger">
          {t('venuePanel.partners.team.error')}
        </p>
      )}
    </GlassCard>
  )
}
