import { createContext, use, useCallback, useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Illustration } from '@/shared/images/Illustration'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'
import { canPerform, type AgeGatedAction } from '../model/verification'
import { useVerificationSnapshot } from './use-verification'

interface AgeGate {
  /** Returns true if allowed; otherwise opens the "Verifica tu edad" sheet and returns false. */
  guard: (action: AgeGatedAction) => boolean
}

const AgeGateContext = createContext<AgeGate | null>(null)

/**
 * "Verifica tu edad" gate (PRD 5.2.10). It is asked the first time the user tries a
 * flirting action. UX only: the server enforces the same rule (RLS + Edge Functions).
 */
export function AgeGateProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { data: snapshot } = useVerificationSnapshot()
  const [blocked, setBlocked] = useState<AgeGatedAction | null>(null)

  const guard = useCallback(
    (action: AgeGatedAction) => {
      if (canPerform(action, snapshot)) return true
      setBlocked(action)
      return false
    },
    [snapshot],
  )
  const value = useMemo(() => ({ guard }), [guard])
  const state = snapshot?.age.state
  const waiting = state === 'pending' || state === 'manual_review'

  return (
    <AgeGateContext value={value}>
      {children}
      <BottomSheet
        open={blocked !== null}
        onOpenChange={(open) => !open && setBlocked(null)}
        title={t('verification.gate.title')}
        description={
          state === 'pending'
            ? t('verification.gate.pending')
            : state === 'manual_review'
              ? t('verification.gate.review')
              : blocked
                ? t('verification.gate.body', { action: t(`verification.gate.actions.${blocked}`) })
                : undefined
        }
        closeLabel={t('common.close')}
        dragHint={t('designKit.sheet.dragHint')}
      >
        <Illustration name="verification" className="size-32" />
        <div className="mt-4 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => setBlocked(null)}>
            {t('verification.gate.notNow')}
          </Button>
          <Button
            disabled={waiting}
            onClick={() => {
              setBlocked(null)
              void navigate('/verification/age')
            }}
          >
            {t('verification.gate.verifyNow')}
          </Button>
        </div>
      </BottomSheet>
    </AgeGateContext>
  )
}

export function useAgeGate(): AgeGate {
  const value = use(AgeGateContext)
  if (!value) throw new Error('useAgeGate must be used inside <AgeGateProvider>')
  return value
}
