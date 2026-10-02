import { Flag, Gavel } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/shared/ui/badge'
import { Button, ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { TextAreaField } from '@/shared/ui/text-field'
import { useAppeal, useDecisions, useMyReports } from '../hooks/use-moderation'
import type { ModerationDecision } from '../services/moderation-service'

function DecisionCard({ decision }: { decision: ModerationDecision }) {
  const { t, i18n } = useTranslation()
  const appeal = useAppeal()
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  return (
    <GlassCard className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold">{t(`moderationCenter.actions.${decision.action}`)}</p>
        <span className="text-xs text-muted-foreground">
          {new Date(decision.createdAt).toLocaleDateString(i18n.language)}
        </span>
      </div>
      <p className="text-sm">{decision.explanation}</p>
      {decision.appeal ? (
        <Badge tone={decision.appeal.status === 'accepted' ? 'verified' : 'unconfirmed'}>
          {t(`moderationCenter.appealStatus.${decision.appeal.status}`)}
        </Badge>
      ) : open ? (
        <div className="space-y-2">
          <TextAreaField
            label={t('moderationCenter.appealLabel')}
            hint={t('moderationCenter.appealHint')}
            value={text}
            maxLength={1000}
            onChange={(e) => setText(e.target.value)}
          />
          <Button
            block
            disabled={text.trim().length < 10 || appeal.isPending}
            onClick={() => appeal.mutate({ decisionId: decision.id, text: text.trim() })}
          >
            {t('moderationCenter.appealSend')}
          </Button>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
          {t('moderationCenter.appeal')}
        </Button>
      )}
    </GlassCard>
  )
}

/** "Moderación y apelaciones" (DSA art. 17 and 20): explained decisions, appeals, my reports. */
export function ModerationScreen() {
  const { t, i18n } = useTranslation()
  const { data: decisions = [] } = useDecisions()
  const { data: reports = [] } = useMyReports()
  return (
    <>
      <ScreenHeader
        title={t('moderationCenter.title')}
        description={t('moderationCenter.body')}
        backTo="/profile/privacy"
      />
      <Section title={t('moderationCenter.decisions')}>
        <div className="space-y-3">
          {decisions.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Gavel className="size-4" aria-hidden />
              {t('moderationCenter.noDecisions')}
            </p>
          ) : (
            decisions.map((d) => <DecisionCard key={d.id} decision={d} />)
          )}
        </div>
      </Section>
      <Section title={t('moderationCenter.myReports')}>
        {reports.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Flag className="size-4" aria-hidden />
            {t('moderationCenter.noReports')}
          </p>
        ) : (
          <ul className="glass divide-y divide-border rounded-theme">
            {reports.map((r) => (
              <li key={r.id} className="flex justify-between gap-2 px-4 py-3 text-sm">
                <span>
                  {r.aboutName} · {new Date(r.createdAt).toLocaleDateString(i18n.language)}
                </span>
                <span className="text-muted-foreground">
                  {t(`moderationCenter.reportStatus.${r.status}`)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <div className="px-safe mt-6 pb-6">
        <ButtonLink to="/legal/illegal-content" variant="ghost" block>
          {t('publicWeb.illegal.title')}
        </ButtonLink>
      </div>
    </>
  )
}
