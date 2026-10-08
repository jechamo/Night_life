import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { InvitationNotice } from '@/features/venue-panel/components/InvitationNotice'
import {
  CONTRACT_TIERS,
  isTaxId,
  type ContractTier,
  type PartnerAccount,
  type PartnerInput,
} from '@/features/venue-panel/model/partners'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { CheckboxField } from '@/shared/ui/checkbox'
import { SingleChoice } from '@/shared/ui/choice-group'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { TextAreaField, TextField } from '@/shared/ui/text-field'
import {
  useAdminPartners,
  useAdminVenues,
  useContractAction,
  useCreateContract,
  useInviteVenueOwner,
  useLinkPartnerVenue,
  useRemoveVenueManager,
  useRevokeInvitation,
  useSavePartner,
} from '../hooks/use-admin'

const ERRORS = [
  'invalid',
  'duplicate_tax_id',
  'linked_elsewhere',
  'already_sponsored',
  'duplicate_reference',
  'invalid_state',
] as const
type PartnerError = (typeof ERRORS)[number]

function ErrorText({ error }: { error: string | null | undefined }) {
  const { t } = useTranslation()
  if (!error) return null
  return (
    <p role="alert" className="text-sm text-danger">
      {(ERRORS as readonly string[]).includes(error)
        ? t(`admin.partners.errors.${error as PartnerError}`)
        : t('admin.partners.errors.generic')}
    </p>
  )
}

const EMPTY: PartnerInput = {
  legalName: '',
  taxId: '',
  contactName: '',
  billingEmail: '',
  contactPhone: '',
  notes: '',
  isTest: false,
}

function PartnerForm({ account, onDone }: { account?: PartnerAccount; onDone: () => void }) {
  const { t } = useTranslation()
  const save = useSavePartner()
  const [form, setForm] = useState<PartnerInput>(
    account
      ? {
          id: account.id,
          legalName: account.legalName,
          taxId: account.taxId,
          contactName: account.contactName,
          billingEmail: account.billingEmail,
          contactPhone: account.contactPhone ?? '',
          notes: account.notes ?? '',
          isTest: account.isTest,
        }
      : EMPTY,
  )
  const set = (key: keyof PartnerInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))
  const valid =
    form.legalName.trim().length >= 2 &&
    isTaxId(form.taxId) &&
    form.contactName.trim().length >= 2 &&
    form.billingEmail.includes('@')
  return (
    <GlassCard className="space-y-3">
      <TextField
        label={t('admin.partners.fields.legalName')}
        value={form.legalName}
        maxLength={120}
        onChange={set('legalName')}
      />
      <TextField
        label={t('admin.partners.fields.taxId')}
        value={form.taxId}
        maxLength={12}
        autoCapitalize="characters"
        onChange={set('taxId')}
      />
      <TextField
        label={t('admin.partners.fields.contactName')}
        value={form.contactName}
        maxLength={80}
        onChange={set('contactName')}
      />
      <TextField
        type="email"
        label={t('admin.partners.fields.billingEmail')}
        value={form.billingEmail}
        maxLength={254}
        onChange={set('billingEmail')}
      />
      <TextField
        type="tel"
        label={t('admin.partners.fields.contactPhone')}
        value={form.contactPhone}
        maxLength={20}
        onChange={set('contactPhone')}
      />
      <TextAreaField
        label={t('admin.partners.fields.notes')}
        value={form.notes}
        maxLength={500}
        onChange={set('notes')}
      />
      {!account && (
        <CheckboxField
          checked={form.isTest}
          onCheckedChange={(isTest) => setForm((f) => ({ ...f, isTest }))}
        >
          {t('admin.partners.fields.isTest')}
        </CheckboxField>
      )}
      <Button
        block
        disabled={!valid || save.isPending}
        onClick={() =>
          save.mutate(form, {
            onSuccess: (result) => {
              if (result.ok) onDone()
            },
          })
        }
      >
        {t('admin.partners.save')}
      </Button>
      <ErrorText error={save.data && !save.data.ok ? save.data.error : save.error?.message} />
    </GlassCard>
  )
}

function VenueLinker({ accountId }: { accountId: string }) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const { data: venues } = useAdminVenues(query.trim().length >= 2 ? query.trim() : '')
  const link = useLinkPartnerVenue()
  return (
    <div className="space-y-2">
      <TextField
        type="search"
        label={t('admin.partners.venues.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {query.trim().length >= 2 && (
        <ul className="space-y-1">
          {(venues ?? []).slice(0, 5).map((v) => (
            <li key={v.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {v.name} · {v.city}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={link.isPending}
                onClick={() => link.mutate({ accountId, venueId: v.id, link: true })}
              >
                {t('admin.partners.venues.link')}
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ErrorText error={link.data && !link.data.ok ? link.data.error : link.error?.message} />
    </div>
  )
}

function ContractForm({ accountId }: { accountId: string }) {
  const { t } = useTranslation()
  const create = useCreateContract()
  const [reference, setReference] = useState('')
  const [tier, setTier] = useState<ContractTier>('featured')
  const [pro, setPro] = useState(false)
  const [startsOn, setStartsOn] = useState(() => new Date().toISOString().slice(0, 10))
  const [endsOn, setEndsOn] = useState('')
  const valid =
    reference.trim().length >= 3 && (tier !== 'none' || pro) && !!endsOn && endsOn >= startsOn
  return (
    <div className="space-y-3 rounded-2xl border border-border p-3">
      <TextField
        label={t('admin.partners.contracts.reference')}
        value={reference}
        maxLength={40}
        onChange={(e) => setReference(e.target.value)}
      />
      <SingleChoice
        label={t('admin.partners.contracts.tier')}
        value={tier}
        onChange={setTier}
        options={CONTRACT_TIERS.map((value) => ({
          value,
          label: t(`admin.partners.contracts.tiers.${value}`),
        }))}
      />
      <CheckboxField checked={pro} onCheckedChange={setPro}>
        {t('admin.partners.contracts.pro')}
      </CheckboxField>
      <div className="grid grid-cols-2 gap-3">
        <TextField
          type="date"
          label={t('admin.partners.contracts.startsOn')}
          value={startsOn}
          onChange={(e) => setStartsOn(e.target.value)}
        />
        <TextField
          type="date"
          label={t('admin.partners.contracts.endsOn')}
          value={endsOn}
          onChange={(e) => setEndsOn(e.target.value)}
        />
      </div>
      <Button
        block
        variant="outline"
        disabled={!valid || create.isPending}
        onClick={() =>
          create.mutate(
            { accountId, reference: reference.trim(), tier, pro, startsOn, endsOn },
            { onSuccess: (result) => result.ok && setReference('') },
          )
        }
      >
        {t('admin.partners.contracts.create')}
      </Button>
      <ErrorText
        error={create.data && !create.data.ok ? create.data.error : create.error?.message}
      />
    </div>
  )
}

function PartnerCard({ account }: { account: PartnerAccount }) {
  const { t, i18n } = useTranslation()
  const [editing, setEditing] = useState(false)
  const link = useLinkPartnerVenue()
  const invite = useInviteVenueOwner()
  const revoke = useRevokeInvitation()
  const remove = useRemoveVenueManager()
  const action = useContractAction()
  const date = (value: string) =>
    new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' }).format(new Date(value))
  return (
    <GlassCard role="region" className="space-y-4" aria-label={account.legalName}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{account.legalName}</h2>
          <p className="text-sm text-muted-foreground">
            {account.taxId} · {account.contactName} · {account.billingEmail}
          </p>
        </div>
        <div className="flex gap-2">
          {account.isTest && <Badge tone="neutral">{t('admin.partners.testBadge')}</Badge>}
          {account.status === 'ended' && <Badge tone="neutral">{t('admin.partners.ended')}</Badge>}
          <Button size="sm" variant="ghost" onClick={() => setEditing((v) => !v)}>
            {t('admin.partners.edit')}
          </Button>
        </div>
      </div>
      {editing && <PartnerForm account={account} onDone={() => setEditing(false)} />}

      <section className="space-y-3">
        <h3 className="font-semibold">{t('admin.partners.venues.title')}</h3>
        {account.venues.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('admin.partners.venues.none')}</p>
        )}
        {account.venues.map((venue) => (
          <div key={venue.id} className="space-y-2 rounded-2xl border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium">
                {venue.name}
                {venue.city ? ` · ${venue.city}` : ''}
              </p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={invite.isPending}
                  onClick={() => invite.mutate(venue.id)}
                >
                  {t('admin.partners.venues.invite')}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={link.isPending}
                  onClick={() =>
                    link.mutate({ accountId: account.id, venueId: venue.id, link: false })
                  }
                >
                  {t('admin.partners.venues.unlink')}
                </Button>
              </div>
            </div>
            {invite.data && invite.variables === venue.id && (
              <InvitationNotice
                invitation={invite.data}
                body={t('admin.partners.invitation.body', { date: date(invite.data.expiresAt) })}
              />
            )}
            <p className="text-xs font-semibold text-muted-foreground uppercase">
              {t('admin.partners.venues.managers')}
            </p>
            {venue.managers.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {t('admin.partners.venues.noManagers')}
              </p>
            ) : (
              <ul className="space-y-1 text-sm">
                {venue.managers.map((m) => (
                  <li key={m.userId} className="flex items-center justify-between gap-2">
                    <span>
                      {m.name ?? '—'} · {t(`venuePanel.partners.roles.${m.role}`)}
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ venueId: venue.id, userId: m.userId })}
                    >
                      {t('admin.partners.venues.remove')}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            {venue.invitations.length > 0 && (
              <ul className="space-y-1 text-sm">
                {venue.invitations.map((i) => (
                  <li key={i.id} className="flex items-center justify-between gap-2">
                    <span>
                      {t(`venuePanel.partners.roles.${i.role}`)} ·{' '}
                      {t(`admin.partners.invitationStatus.${i.status}`)} · {date(i.expiresAt)}
                    </span>
                    {i.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={revoke.isPending}
                        onClick={() => revoke.mutate(i.id)}
                      >
                        {t('admin.partners.venues.revoke')}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
        <ErrorText error={link.data && !link.data.ok ? link.data.error : link.error?.message} />
        <VenueLinker accountId={account.id} />
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold">{t('admin.partners.contracts.title')}</h3>
        <p className="text-xs text-muted-foreground">{t('admin.partners.contracts.note')}</p>
        {account.contracts.length === 0 && (
          <p className="text-sm text-muted-foreground">{t('admin.partners.contracts.none')}</p>
        )}
        <ul className="space-y-2">
          {account.contracts.map((c) => (
            <li key={c.id} className="space-y-1 rounded-2xl border border-border p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{c.reference}</span>
                <Badge tone={c.status === 'active' ? 'live' : 'neutral'}>
                  {t(`admin.partners.contracts.status.${c.status}`)}
                </Badge>
              </div>
              <p>
                {t('admin.partners.contracts.summary', {
                  tier: t(`admin.partners.contracts.tiers.${c.tier}`),
                  pro: c.pro ? t('admin.partners.contracts.proSuffix') : '',
                  from: date(c.startsOn),
                  to: date(c.endsOn),
                  version: c.termsVersion,
                })}
              </p>
              {c.status !== 'ended' && (
                <Button
                  size="sm"
                  variant={c.status === 'draft' ? 'primary' : 'outline'}
                  disabled={action.isPending}
                  onClick={() =>
                    action.mutate({ id: c.id, action: c.status === 'draft' ? 'activate' : 'end' })
                  }
                >
                  {t(
                    c.status === 'draft'
                      ? 'admin.partners.contracts.activate'
                      : 'admin.partners.contracts.end',
                  )}
                </Button>
              )}
            </li>
          ))}
        </ul>
        <ErrorText
          error={action.data && !action.data.ok ? action.data.error : action.error?.message}
        />
        <ContractForm accountId={account.id} />
      </section>
    </GlassCard>
  )
}

/** Roadmap R3: partner companies, their venues, offline contracts and access invitations. */
export function AdminPartnersScreen() {
  const { t } = useTranslation()
  const { data: partners, isPending } = useAdminPartners()
  const [creating, setCreating] = useState(false)
  return (
    <>
      <ScreenHeader title={t('admin.partners.title')} description={t('admin.partners.body')} />
      <Section title={t('admin.nav.partners')}>
        <div className="space-y-4">
          <Button variant="outline" onClick={() => setCreating((v) => !v)}>
            <Plus aria-hidden />
            {t('admin.partners.new')}
          </Button>
          {creating && <PartnerForm onDone={() => setCreating(false)} />}
          {!isPending && partners?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('admin.partners.empty')}</p>
          )}
          {partners?.map((account) => (
            <PartnerCard key={account.id} account={account} />
          ))}
        </div>
      </Section>
    </>
  )
}
