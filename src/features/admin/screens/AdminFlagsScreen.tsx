import { useTranslation } from 'react-i18next'
import { FLAG_KEYS, FLAG_SCHEMAS, type FlagKey } from '@/shared/flags/flags'
import { resolvePaywallState } from '@/shared/flags/paywall'
import { useFeatureFlags } from '@/shared/flags/use-feature-flag'
import { useRoles } from '@/shared/session/use-roles'
import { GlassCard } from '@/shared/ui/card'
import { SingleChoice } from '@/shared/ui/choice-group'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { useSetFlag, type FlagChange } from '../hooks/use-admin'

/**
 * Feature flags (PRD 6.13, 6.14): every value is validated by its schema, applied
 * without redeploying and written to the audit log. Shows the resulting paywall.
 */
export function AdminFlagsScreen() {
  const { t } = useTranslation()
  const { data: flags } = useFeatureFlags()
  const roles = useRoles()
  const setFlag = useSetFlag()
  if (!flags) return null
  const paywall = resolvePaywallState(flags, roles)
  return (
    <>
      <ScreenHeader title={t('admin.nav.flags')} description={t('admin.flags.body')} />
      <div className="px-safe mt-4 space-y-3">
        <GlassCard role="status" className="flex items-center justify-between gap-2">
          <span className="text-sm text-muted-foreground">{t('admin.flags.paywallNow')}</span>
          <span className="font-semibold text-primary">{t(`admin.flags.paywall.${paywall}`)}</span>
        </GlassCard>
        {FLAG_KEYS.map((key: FlagKey) => (
          <GlassCard key={key} className="space-y-2">
            <p className="font-label text-sm font-semibold">{key}</p>
            <p className="text-sm text-muted-foreground">{t(`admin.flags.help.${key}`)}</p>
            <SingleChoice
              label={key}
              value={flags[key]}
              options={FLAG_SCHEMAS[key].options.map((value) => ({ value, label: value }))}
              onChange={(value) => setFlag.mutate({ key, value } as FlagChange)}
            />
          </GlassCard>
        ))}
      </div>
    </>
  )
}
