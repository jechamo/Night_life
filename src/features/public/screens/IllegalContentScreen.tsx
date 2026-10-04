import { CheckCircle2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useIllegalContentNotice } from '@/features/moderation/hooks/use-moderation'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { CheckboxField } from '@/shared/ui/checkbox'
import { SingleChoice } from '@/shared/ui/choice-group'
import { TextAreaField, TextField } from '@/shared/ui/text-field'

const REASONS = ['minor', 'sexual', 'violence', 'hate', 'fraud', 'privacy', 'ip', 'other'] as const
type Reason = (typeof REASONS)[number]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTENT_URL_RE =
  /^https:\/\/(nightlife-connect-beige\.vercel\.app|nightlife-connect(-[a-z0-9-]+)?-chaplications-projects\.vercel\.app)\//

/**
 * Public notice of illegal content (DSA art. 16): exact location, reasons, contact and
 * a good-faith statement. Every notice gets a reference and a human review.
 */
export function IllegalContentScreen() {
  const { t } = useTranslation()
  const notice = useIllegalContentNotice()
  const [url, setUrl] = useState('')
  const [reason, setReason] = useState<Reason | undefined>()
  const [explanation, setExplanation] = useState('')
  const [email, setEmail] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const emailOk = EMAIL_RE.test(email.trim())
  const urlOk = CONTENT_URL_RE.test(url.trim())
  const valid = urlOk && reason && explanation.trim().length >= 20 && emailOk && goodFaith

  if (notice.data) {
    return (
      <GlassCard className="mt-12 space-y-3 text-center">
        <CheckCircle2 className="mx-auto size-10 text-success" aria-hidden />
        <h1 className="text-2xl font-semibold">{t('publicWeb.illegal.sentTitle')}</h1>
        <p className="text-muted-foreground">
          {t('publicWeb.illegal.sentBody', { reference: notice.data })}
        </p>
      </GlassCard>
    )
  }

  return (
    <form
      className="mt-8 space-y-5"
      onSubmit={(event) => {
        event.preventDefault()
        if (valid)
          notice.mutate({
            url: url.trim(),
            reason,
            explanation: explanation.trim(),
            email: email.trim(),
            goodFaith,
          })
      }}
    >
      <h1 className="text-3xl font-semibold">{t('publicWeb.illegal.title')}</h1>
      <p className="text-muted-foreground">{t('publicWeb.illegal.intro')}</p>
      <TextField
        type="url"
        label={t('publicWeb.illegal.url')}
        hint={t('publicWeb.illegal.urlHint')}
        error={url && !urlOk ? t('publicWeb.illegal.urlInvalid') : undefined}
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        maxLength={500}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('publicWeb.illegal.reason')}</legend>
        <SingleChoice
          label={t('publicWeb.illegal.reason')}
          value={reason}
          onChange={setReason}
          options={REASONS.map((value) => ({
            value,
            label: t(`publicWeb.illegal.reasons.${value}`),
          }))}
        />
      </fieldset>
      <TextAreaField
        label={t('publicWeb.illegal.explanation')}
        hint={t('publicWeb.illegal.explanationHint')}
        value={explanation}
        maxLength={2000}
        counter={`${explanation.length}/2000`}
        onChange={(e) => setExplanation(e.target.value)}
      />
      <TextField
        type="email"
        autoComplete="email"
        label={t('publicWeb.illegal.email')}
        hint={t('publicWeb.illegal.emailHint')}
        error={email && !emailOk ? t('publicWeb.illegal.emailInvalid') : undefined}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        maxLength={200}
      />
      <CheckboxField checked={goodFaith} onCheckedChange={setGoodFaith}>
        {t('publicWeb.illegal.goodFaith')}
      </CheckboxField>
      <p className="text-xs text-muted-foreground">{t('publicWeb.illegal.privacy')}</p>
      {notice.isError && (
        <p role="alert" className="text-sm text-danger">
          {t('publicWeb.illegal.failed')}
        </p>
      )}
      <Button type="submit" block size="lg" disabled={!valid || notice.isPending}>
        {t('publicWeb.illegal.submit')}
      </Button>
    </form>
  )
}
