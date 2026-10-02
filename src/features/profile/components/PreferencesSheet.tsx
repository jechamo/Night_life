import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { InterestedIn } from '@/features/onboarding/model/onboarding-machine'
import { BottomSheet } from '@/shared/ui/bottom-sheet'
import { Button } from '@/shared/ui/button'
import { MultiChoice } from '@/shared/ui/choice-group'
import { RangeSlider } from '@/shared/ui/range-slider'
import { useMyProfile, useUpdateProfile } from '../use-my-profile'

const OPTIONS: readonly InterestedIn[] = ['women', 'men', 'non_binary']

/** Edit who I want to meet (PRD 5.3 "preferencias"). */
export function PreferencesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const { data: me } = useMyProfile()
  const update = useUpdateProfile()
  const [interestedIn, setInterestedIn] = useState<InterestedIn[]>([])
  const [range, setRange] = useState<[number, number]>([18, 60])

  return (
    <BottomSheet
      open={open}
      onOpenChange={(next) => {
        if (next && me) {
          setInterestedIn([...me.interestedIn])
          setRange([me.ageMin, me.ageMax])
        }
        if (!next) onClose()
      }}
      title={t('onboarding.preferences.title')}
      description={t('onboarding.preferences.body')}
      closeLabel={t('common.close')}
      dragHint={t('designKit.sheet.dragHint')}
    >
      <div className="space-y-5">
        <MultiChoice<InterestedIn>
          label={t('onboarding.preferences.interestedIn')}
          value={interestedIn}
          onChange={setInterestedIn}
          options={OPTIONS.map((o) => ({
            value: o,
            label: t(`onboarding.preferences.options.${o}`),
          }))}
        />
        <RangeSlider
          label={t('onboarding.preferences.age')}
          thumbLabels={[t('onboarding.preferences.ageMin'), t('onboarding.preferences.ageMax')]}
          min={18}
          max={60}
          value={range}
          onChange={setRange}
          formatValue={(n) => (n >= 60 ? '60+' : String(n))}
        />
        <Button
          block
          disabled={interestedIn.length === 0 || update.isPending}
          onClick={() =>
            update.mutate(
              { interestedIn, ageMin: range[0], ageMax: range[1] },
              { onSuccess: onClose },
            )
          }
        >
          {t('common.save')}
        </Button>
      </div>
    </BottomSheet>
  )
}
