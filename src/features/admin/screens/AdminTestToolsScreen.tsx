import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FeatureGate } from '@/shared/flags/FeatureGate'
import { ROLES, type Role } from '@/shared/session/roles'
import { useRoles } from '@/shared/session/use-roles'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { MultiChoice } from '@/shared/ui/choice-group'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { useRunTestTool, useSetSimulatedRoles } from '../hooks/use-admin'
import type { TestTool } from '../services/admin-service'

const TOOLS: readonly TestTool[] = [
  'generate_test_city',
  'fill_venue',
  'test_like_me',
  'send_test_messages',
  'simulate_stripe_webhook',
  'simulate_yoti_webhook',
  'expire_everything',
  'reset_likes',
  'simulate_suspension',
  'purge_test_data',
]
const DANGEROUS = new Set<TestTool>(['purge_test_data', 'simulate_suspension'])

function Tools() {
  const { t } = useTranslation()
  const run = useRunTestTool()
  const [last, setLast] = useState<{ tool: TestTool; result: string } | null>(null)
  const [confirm, setConfirm] = useState<TestTool | null>(null)
  const execute = (tool: TestTool) => {
    setConfirm(null)
    run.mutate(tool, { onSuccess: (result) => setLast({ tool, result: String(result) }) })
  }
  return (
    <div className="space-y-3">
      {last && (
        <GlassCard role="status" className="text-sm">
          {t('admin.tools.result', {
            tool: t(`admin.tools.items.${last.tool}.name`),
            result: last.result,
          })}
        </GlassCard>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        {TOOLS.map((tool) => (
          <GlassCard key={tool} className="flex flex-col gap-2">
            <p className="font-semibold">{t(`admin.tools.items.${tool}.name`)}</p>
            <p className="flex-1 text-sm text-muted-foreground">
              {t(`admin.tools.items.${tool}.body`)}
            </p>
            {confirm === tool ? (
              <div className="flex gap-2">
                <Button size="sm" variant="danger" onClick={() => execute(tool)}>
                  {t('admin.tools.confirm')}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                  {t('admin.tools.cancel')}
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant={DANGEROUS.has(tool) ? 'outline' : 'secondary'}
                disabled={run.isPending}
                onClick={() => (DANGEROUS.has(tool) ? setConfirm(tool) : execute(tool))}
              >
                {t('admin.tools.run')}
              </Button>
            )}
          </GlassCard>
        ))}
      </div>
    </div>
  )
}

function SimulatedRoles() {
  const { t } = useTranslation()
  const roles = useRoles()
  const setRoles = useSetSimulatedRoles()
  return (
    <GlassCard className="space-y-3">
      <p className="text-sm text-muted-foreground">{t('admin.tools.rolesBody')}</p>
      <MultiChoice
        label={t('admin.tools.roles')}
        value={[...roles]}
        // "admin" stays on so the tester cannot lock themselves out of this panel.
        onChange={(next: Role[]) => setRoles.mutate(Array.from(new Set<Role>([...next, 'admin'])))}
        options={ROLES.map((role) => ({ value: role, label: role }))}
      />
    </GlassCard>
  )
}

/** Test tools (PRD 6.14): double-gated by role and `test_tools_enabled`, all audited. */
export function AdminTestToolsScreen() {
  const { t } = useTranslation()
  return (
    <>
      <ScreenHeader title={t('admin.nav.testTools')} description={t('admin.tools.body')} />
      <FeatureGate
        flag="test_tools_enabled"
        is="on"
        fallback={
          <EmptyState
            icon={FlaskConical}
            title={t('admin.tools.offTitle')}
            description={t('admin.tools.offBody')}
          />
        }
      >
        <Section title={t('admin.tools.title')}>
          <Tools />
        </Section>
        <Section title={t('admin.tools.roles')}>
          <SimulatedRoles />
        </Section>
      </FeatureGate>
    </>
  )
}
