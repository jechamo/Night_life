import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { hasRole } from '@/shared/session/roles'
import { useRoles } from '@/shared/session/use-roles'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { useSimulateVerification } from '../hooks/use-verification'
import type { VerificationLevel } from '../model/verification'
import type { SandboxOutcome } from '../services/verification-service'

const OUTCOMES: Record<VerificationLevel, readonly SandboxOutcome[]> = {
  age: ['approved', 'inconclusive', 'denied'],
  photo: ['approved', 'borderline', 'denied'],
  identity: ['approved', 'denied'],
}

const isLevel = (value: string | null): value is VerificationLevel =>
  value === 'age' || value === 'photo' || value === 'identity'

/**
 * Stand-in for the provider's hosted flow (PRD 6.14 "verificación en sandbox").
 * Only testers with verification_mode = sandbox reach it: there is never a bypass
 * for normal users, and in live mode it only explains that the provider is missing.
 */
export function ProviderSandboxScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const level = params.get('level')
  const sandbox = useFeatureFlag('verification_mode') === 'sandbox'
  const simulator = useFeatureFlag('verification_provider') === 'simulator'
  const testTools = useFeatureFlag('test_tools_enabled')
  const roles = useRoles()
  const isTester = hasRole(roles, 'tester') || hasRole(roles, 'admin')
  const simulate = useSimulateVerification()
  const [documentStep, setDocumentStep] = useState(false)

  if (!isLevel(level)) return null
  const allowed = sandbox && simulator && testTools && isTester

  const choose = (outcome: SandboxOutcome) => {
    simulate.mutate(
      { level, outcome },
      {
        onSuccess: (snapshot) => {
          if (outcome === 'inconclusive') return setDocumentStep(true)
          void navigate(`/profile/verification?level=${level}&result=${snapshot[level].state}`, {
            replace: true,
          })
        },
      },
    )
  }

  const outcomes = documentStep ? (['approved', 'denied'] as const) : OUTCOMES[level]

  return (
    <>
      <ScreenHeader title={t('verification.sandbox.title')} backTo="/profile/verification" />
      <div className="px-safe mt-4 space-y-4">
        <GlassCard className="flex gap-3">
          <FlaskConical className="size-5 shrink-0 text-warning" aria-hidden />
          <p className="text-sm">
            {allowed ? t('verification.sandbox.body') : t('verification.sandbox.liveMode')}
          </p>
        </GlassCard>
        {simulate.isError && (
          <p role="alert" className="text-sm text-danger">
            {t('verification.age.unavailable')}
          </p>
        )}
        {allowed && (
          <>
            <p className="font-medium">{t(`verification.levels.${level}.title`)}</p>
            {documentStep && (
              <p className="text-sm text-muted-foreground">
                {t('verification.sandbox.documentStep')}
              </p>
            )}
            <div className="grid gap-3">
              {outcomes.map((outcome) => (
                <Button
                  key={outcome}
                  variant={outcome === 'approved' ? 'primary' : 'outline'}
                  disabled={simulate.isPending}
                  onClick={() => choose(outcome)}
                >
                  {t(`verification.sandbox.outcomes.${outcome}`)}
                </Button>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  )
}
