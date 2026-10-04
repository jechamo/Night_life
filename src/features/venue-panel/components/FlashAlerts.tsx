import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConsents } from '@/features/consents/hooks/use-consents'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { CheckboxField } from '@/shared/ui/checkbox'
import { TextField, TextAreaField } from '@/shared/ui/text-field'
import { useCreateFlashAlert, useFlashAlerts } from '../hooks/use-venue-panel'

export function FlashAlertForm({ placeId }: { placeId: string }) {
  const { t } = useTranslation(),
    create = useCreateFlashAlert(placeId)
  const [title, setTitle] = useState(''),
    [body, setBody] = useState(''),
    [alcohol, setAlcohol] = useState(false)
  return (
    <GlassCard className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('venuePanel.flash.hint')}</p>
      <TextField
        label={t('venuePanel.flash.heading')}
        value={title}
        maxLength={60}
        onChange={(e) => setTitle(e.target.value)}
      />
      <TextAreaField
        label={t('venuePanel.flash.body')}
        value={body}
        maxLength={200}
        onChange={(e) => setBody(e.target.value)}
      />
      <CheckboxField checked={alcohol} onCheckedChange={setAlcohol}>
        {t('venuePanel.flash.alcohol')}
      </CheckboxField>
      <Button
        block
        disabled={create.isPending || title.trim().length < 3 || !body.trim()}
        onClick={() =>
          create.mutate({
            title: title.trim(),
            body: body.trim(),
            containsAlcohol: alcohol,
            startsAt: new Date().toISOString(),
            endsAt: new Date(Date.now() + 3600000).toISOString(),
          })
        }
      >
        {t('venuePanel.flash.submit')}
      </Button>
      {create.isSuccess && <p role="status">{t('venuePanel.flash.saved')}</p>}
      {create.isError && (
        <p role="alert" className="text-danger">
          {t('venuePanel.flash.failed')}
        </p>
      )}
    </GlassCard>
  )
}
export function FlashAlerts({ placeId }: { placeId: string }) {
  const { t } = useTranslation(),
    consents = useConsents()
  const { data = [] } = useFlashAlerts(placeId, Boolean(consents.data?.choices.marketing))
  if (!data.length) return null
  return (
    <section aria-label={t('venuePanel.flash.title')} className="space-y-2">
      {data.map((a) => (
        <GlassCard key={a.id}>
          <p className="font-semibold">{a.title}</p>
          <p className="text-sm">{a.body}</p>
        </GlassCard>
      ))}
    </section>
  )
}
