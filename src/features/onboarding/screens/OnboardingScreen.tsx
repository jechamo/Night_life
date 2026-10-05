import { AnimatePresence, motion } from 'motion/react'
import { useReducer, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { CircleSlash, FileWarning } from 'lucide-react'
import { riseIn } from '@/shared/motion/presets'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import { useTheme } from '@/shared/theme/ThemeProvider'
import { Button, ButtonLink } from '@/shared/ui/button'
import { EmptyState } from '@/shared/ui/empty-state'
import { useCompleteOnboarding, useOnboardingStatus } from '../hooks/use-onboarding-status'
import { initialOnboardingState, onboardingReducer } from '../model/onboarding-machine'
import { BirthdateStep } from '../steps/BirthdateStep'
import { ConsentsStep } from '../steps/ConsentsStep'
import { LegalStep } from '../steps/LegalStep'
import { PhoneStep } from '../steps/PhoneStep'
import { PreferencesStep } from '../steps/PreferencesStep'
import { ProfileStep } from '../steps/ProfileStep'
import { ThemeStep } from '../steps/ThemeStep'

/**
 * Runs the onboarding state machine. All personal data stays in this component's
 * memory: leaving the flow (e.g. under 18) discards it completely.
 */
export function OnboardingScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const tokens = useMotionTokens()
  const { themeId } = useTheme()
  const status = useOnboardingStatus()
  const complete = useCompleteOnboarding()
  const [state, dispatch] = useReducer(onboardingReducer, initialOnboardingState)

  if (status.data === 'completed') return <Navigate to="/home" replace />

  let content: ReactNode
  let key: string = state.status
  if (state.status === 'not_eligible') {
    content = (
      <Centered>
        <EmptyState
          icon={CircleSlash}
          title={t('onboarding.notEligible.title')}
          description={t('onboarding.notEligible.body')}
          action={
            <ButtonLink to="/welcome" replace>
              {t('common.exit')}
            </ButtonLink>
          }
        />
      </Centered>
    )
  } else if (state.status === 'legal_declined') {
    content = (
      <Centered>
        <EmptyState
          icon={FileWarning}
          title={t('onboarding.legalDeclined.title')}
          description={t('onboarding.legalDeclined.body')}
          action={
            <div className="flex flex-col gap-3">
              <Button onClick={() => dispatch({ type: 'REVIEW_LEGAL_AGAIN' })}>
                {t('onboarding.legalDeclined.review')}
              </Button>
              <ButtonLink to="/welcome" replace variant="outline">
                {t('common.exit')}
              </ButtonLink>
            </div>
          }
        />
      </Centered>
    )
  } else if (state.status === 'in_progress') {
    key = state.step
    const props = { data: state.data, dispatch }
    content = {
      birthdate: <BirthdateStep {...props} />,
      legal: <LegalStep {...props} />,
      phone: <PhoneStep {...props} />,
      consents: <ConsentsStep {...props} />,
      profile: <ProfileStep {...props} />,
      preferences: <PreferencesStep {...props} />,
      theme: (
        <ThemeStep
          {...props}
          finishing={complete.isPending}
          failed={complete.data?.ok === false}
          onFinish={() =>
            complete.mutate(
              { ...state.data, themeId },
              {
                onSuccess: (result) => {
                  if (!result.ok) return
                  dispatch({ type: 'THEME_CHOSEN', themeId })
                  void navigate('/home', { replace: true })
                },
              },
            )
          }
        />
      ),
    }[state.step]
  }

  return (
    <div className="relative min-h-dvh bg-background">
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={key}
          variants={riseIn}
          initial="hidden"
          animate="visible"
          exit="hidden"
          transition={tokens.spring.gentle}
        >
          {content}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="pt-safe flex min-h-dvh items-center justify-center">{children}</div>
}
