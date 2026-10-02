import { Phone, Plus, Share2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { usePlatform } from '@/platform'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { TextField } from '@/shared/ui/text-field'
import { useEmergencyContacts, useSaveEmergencyContacts } from '../hooks/use-safety'
import type { EmergencyContact } from '../services/safety-service'

const MAX_CONTACTS = 3
const PHONE_RE = /^\+?[0-9 ]{9,15}$/
type Draft = Omit<EmergencyContact, 'id'>

function ContactsEditor({ initial }: { initial: Draft[] }) {
  const { t } = useTranslation()
  const save = useSaveEmergencyContacts()
  const [drafts, setDrafts] = useState<Draft[]>(
    initial.length ? initial : [{ name: '', phone: '' }],
  )
  const valid = drafts.every((d) => d.name.trim().length >= 2 && PHONE_RE.test(d.phone.trim()))
  const edit = (index: number, patch: Partial<Draft>) =>
    setDrafts((all) => all.map((d, i) => (i === index ? { ...d, ...patch } : d)))
  return (
    <div className="space-y-3">
      {drafts.map((draft, index) => (
        <GlassCard key={index} className="space-y-3">
          <TextField
            label={t('sos.name')}
            value={draft.name}
            maxLength={40}
            onChange={(e) => edit(index, { name: e.target.value })}
          />
          <TextField
            label={t('sos.phone')}
            type="tel"
            inputMode="tel"
            value={draft.phone}
            maxLength={16}
            error={
              draft.phone && !PHONE_RE.test(draft.phone.trim()) ? t('sos.phoneInvalid') : undefined
            }
            onChange={(e) => edit(index, { phone: e.target.value })}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setDrafts((all) => all.filter((_, i) => i !== index))}
          >
            <Trash2 aria-hidden />
            {t('sos.remove')}
          </Button>
        </GlassCard>
      ))}
      {drafts.length < MAX_CONTACTS && (
        <Button
          variant="outline"
          block
          onClick={() => setDrafts((all) => [...all, { name: '', phone: '' }])}
        >
          <Plus aria-hidden />
          {t('sos.add')}
        </Button>
      )}
      <Button
        block
        disabled={!valid || save.isPending}
        onClick={() =>
          save.mutate(drafts.map((d) => ({ name: d.name.trim(), phone: d.phone.trim() })))
        }
      >
        {t('common.save')}
      </Button>
      {save.isSuccess && (
        <p role="status" className="text-sm text-success">
          {t('common.saved')}
        </p>
      )}
    </div>
  )
}

/**
 * SOS Lite (PRD 6.9): up to 3 trusted contacts (private, RLS), share "where I am
 * tonight" through the platform share sheet and a direct link to 112.
 */
export function SosScreen() {
  const { t } = useTranslation()
  const { share } = usePlatform()
  const { data: contacts } = useEmergencyContacts()
  const [shared, setShared] = useState<string | null>(null)

  const shareNight = async () => {
    const result = await share.share({ title: t('sos.shareTitle'), text: t('sos.shareText') })
    setShared(
      result.ok && result.value !== 'cancelled'
        ? t(result.value === 'copied' ? 'sos.copied' : 'sos.shared')
        : null,
    )
  }

  return (
    <>
      <ScreenHeader title={t('sos.title')} description={t('sos.body')} backTo="/profile/privacy" />
      <div className="px-safe mt-4 grid gap-3">
        <a
          href="tel:112"
          className="flex h-14 items-center justify-center gap-2 rounded-full bg-danger text-lg font-semibold text-danger-foreground"
        >
          <Phone className="size-5" aria-hidden />
          {t('sos.call112')}
        </a>
        <Button variant="glass" size="lg" block onClick={() => void shareNight()}>
          <Share2 aria-hidden />
          {t('sos.share')}
        </Button>
        {shared && (
          <p role="status" className="text-sm text-success">
            {shared}
          </p>
        )}
      </div>
      <Section title={t('sos.contacts')}>
        <p className="mb-3 text-sm text-muted-foreground">{t('sos.contactsBody')}</p>
        {contacts && (
          <ContactsEditor initial={contacts.map(({ name, phone }) => ({ name, phone }))} />
        )}
      </Section>
      <div className="h-8" />
    </>
  )
}
