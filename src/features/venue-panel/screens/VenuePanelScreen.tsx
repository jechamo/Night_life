import { BookOpen, Building2, KeyRound, Store } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useLegalDocuments, useSignDocuments } from '@/features/legal/hooks/use-legal-documents'
import { usePlaces } from '@/features/places/hooks/use-places'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { isEvent } from '@/features/places/model/types'
import { hasRole } from '@/shared/session/roles'
import { useRoles } from '@/shared/session/use-roles'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { SingleChoice } from '@/shared/ui/choice-group'
import { ListRow } from '@/shared/ui/list-row'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { TextAreaField, TextField } from '@/shared/ui/text-field'
import { VenueTermsCheckbox } from '../components/VenueTermsCheckbox'
import { useClaimVenue, useMyVenues } from '../hooks/use-venue-panel'

const VENUE_TERMS = ['venues'] as const

function ClaimForm() {
  const { t } = useTranslation()
  const { data: places = [] } = usePlaces()
  const claim = useClaimVenue()
  // Roadmap R3: with partners on, the venue terms are accepted before claiming.
  const partners = useFeatureFlag('venue_partners_enabled') === 'on'
  const { data: terms } = useLegalDocuments(partners ? VENUE_TERMS : [])
  const sign = useSignDocuments()
  const [accepted, setAccepted] = useState(false)
  const [query, setQuery] = useState('')
  const [placeId, setPlaceId] = useState<string | undefined>()
  const [evidence, setEvidence] = useState('')
  const venues = places.filter((p) => !isEvent(p))
  const matches =
    query.trim().length >= 2
      ? venues.filter((v) => v.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6)
      : []
  const error = claim.data && !claim.data.ok ? claim.data.error : null

  if (claim.data?.ok) {
    return (
      <GlassCard role="status" className="text-sm">
        {t('venuePanel.claim.sent', { name: claim.data.value.name })}
      </GlassCard>
    )
  }
  return (
    <GlassCard className="space-y-4">
      <TextField
        label={t('venuePanel.claim.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        maxLength={60}
      />
      {matches.length > 0 && (
        <SingleChoice
          label={t('venuePanel.claim.search')}
          value={placeId}
          onChange={setPlaceId}
          options={matches.map((v) => ({ value: v.id, label: v.name }))}
        />
      )}
      <TextAreaField
        label={t('venuePanel.claim.evidence')}
        hint={t('venuePanel.claim.evidenceHint')}
        value={evidence}
        maxLength={500}
        onChange={(e) => setEvidence(e.target.value)}
      />
      {partners && <VenueTermsCheckbox checked={accepted} onCheckedChange={setAccepted} />}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {t(
            error === 'terms_required'
              ? 'venuePanel.partners.claimTermsRequired'
              : 'venuePanel.claim.already',
          )}
        </p>
      )}
      <Button
        block
        disabled={
          !placeId ||
          evidence.trim().length < 10 ||
          claim.isPending ||
          sign.isPending ||
          (partners && (!accepted || !terms?.length))
        }
        onClick={() => {
          if (!placeId) return
          const send = () => claim.mutate({ placeId, evidence: evidence.trim() })
          if (partners && terms?.length) sign.mutate(terms, { onSuccess: send })
          else send()
        }}
      >
        {t('venuePanel.claim.submit')}
      </Button>
    </GlassCard>
  )
}

/** Free venue panel (PRD 6.10): my venues + claim a new one (reviewed by a person). */
export function VenuePanelScreen() {
  const { t } = useTranslation()
  const partners = useFeatureFlag('venue_partners_enabled') === 'on'
  const roles = useRoles()
  const { data: venues = [] } = useMyVenues()
  const manager = hasRole(roles, 'venue_manager')
  return (
    <>
      <ScreenHeader
        title={t('venuePanel.title')}
        description={t('venuePanel.body')}
        backTo="/profile"
      />
      <Section title={t('guide.nav.title')}>
        <GlassCard className="p-0">
          <ListRow
            to="/guia/locales"
            icon={BookOpen}
            label={t('guide.nav.venues')}
            hint={t('guide.nav.venuesHint')}
          />
          {partners && (
            <ListRow
              to="/venue/invitacion"
              icon={KeyRound}
              label={t('venuePanel.partners.haveCode')}
            />
          )}
        </GlassCard>
      </Section>
      {manager && (
        <Section title={t('venuePanel.myVenues')}>
          {venues.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('venuePanel.noVenues')}</p>
          ) : (
            <GlassCard className="divide-y divide-border p-0">
              {venues.map((v) =>
                v.claimStatus === 'approved' ? (
                  <ListRow
                    key={v.placeId}
                    to={`/venue/${v.placeId}`}
                    icon={Store}
                    label={v.name}
                    hint={t('venuePanel.manage')}
                  />
                ) : (
                  <div
                    key={v.placeId}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-3"
                  >
                    <span className="flex items-center gap-3 font-medium">
                      <Building2 className="size-5 text-muted-foreground" aria-hidden />
                      {v.name}
                    </span>
                    <Badge tone="unconfirmed">{t(`venuePanel.claimStatus.${v.claimStatus}`)}</Badge>
                  </div>
                ),
              )}
            </GlassCard>
          )}
        </Section>
      )}
      <Section title={t('venuePanel.claim.title')}>
        <p className="mb-3 text-sm text-muted-foreground">{t('venuePanel.claim.body')}</p>
        <ClaimForm />
      </Section>
      <div className="h-8" />
    </>
  )
}
