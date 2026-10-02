import { useTranslation } from 'react-i18next'
import { useEntitlement } from '@/shared/entitlements/use-entitlement'
import { usePaywallState } from '@/shared/flags/use-paywall-state'
import { useFeatureFlags } from '@/shared/flags/use-feature-flag'
import { FLAG_KEYS } from '@/shared/flags/flags'
import { GlassCard } from '@/shared/ui/card'
import { Section } from '@/shared/ui/section'

/** Shows the mocked flag + entitlement services working end to end (PRD 6.13). */
export function ServicesDemo() {
  const { t } = useTranslation()
  const { data: flags } = useFeatureFlags()
  const paywall = usePaywallState()
  const seeLikes = useEntitlement('see_likes')
  const undo = useEntitlement('undo')

  return (
    <Section title={t('designKit.sections.services')}>
      <GlassCard className="space-y-3 text-sm">
        <Row
          label={t('designKit.services.paywall')}
          value={t(`designKit.services.paywallStates.${paywall}`)}
        />
        {[
          ['see_likes', seeLikes.granted],
          ['undo', undo.granted],
        ].map(([key, granted]) => (
          <Row
            key={String(key)}
            label={t('designKit.services.entitlement', { key: String(key) })}
            value={granted ? t('designKit.services.granted') : t('designKit.services.denied')}
          />
        ))}
        {flags && (
          <dl className="font-mono grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 border-t border-border pt-3 text-xs">
            {FLAG_KEYS.map((key) => (
              <div key={key} className="contents">
                <dt className="text-muted-foreground">{key}</dt>
                <dd>{flags[key]}</dd>
              </div>
            ))}
          </dl>
        )}
      </GlassCard>
    </Section>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
