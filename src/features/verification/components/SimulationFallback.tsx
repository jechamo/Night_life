import { useTranslation } from 'react-i18next'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { hasRole } from '@/shared/session/roles'
import { useRoles } from '@/shared/session/use-roles'
import { Button } from '@/shared/ui/button'

/** Explicit test choice; the server checks permissions and records a simulator session. */
export function SimulationFallback({
  onChoose,
  disabled,
}: {
  onChoose: () => void
  disabled: boolean
}) {
  const { t } = useTranslation()
  const sandbox = useFeatureFlag('verification_mode') === 'sandbox'
  const tools = useFeatureFlag('test_tools_enabled')
  const roles = useRoles()
  if (!sandbox || !tools || (!hasRole(roles, 'tester') && !hasRole(roles, 'admin'))) return null
  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">{t('verification.sandbox.fallbackBody')}</p>
      <Button block variant="outline" disabled={disabled} onClick={onChoose}>
        {t('verification.sandbox.fallbackAction')}
      </Button>
    </div>
  )
}
