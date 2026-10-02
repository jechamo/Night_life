import { zodResolver } from '@hookform/resolvers/zod'
import { Music2 } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { LayeredInfoBox } from '@/features/legal/components/LayeredInfoBox'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { SingleChoice } from '@/shared/ui/choice-group'
import { TextAreaField, TextField } from '@/shared/ui/text-field'
import { OnboardingStepLayout } from '../components/OnboardingStepLayout'
import { MIN_PHOTOS, PhotoPicker } from '../components/PhotoPicker'
import type { Gender } from '../model/onboarding-machine'
import type { StepProps } from './types'

export const BIO_MAX = 300
const GENDERS: readonly Gender[] = ['woman', 'man', 'non_binary', 'other']

/** Shared with the server from Block 5 (PRD 3.4: Zod schemas shared client/Edge Functions). */
export const profileSchema = z.object({
  name: z.string().trim().min(2).max(30),
  gender: z.enum(['woman', 'man', 'non_binary', 'other']),
  bio: z.string().trim().max(BIO_MAX),
})
type ProfileForm = z.infer<typeof profileSchema>

export function ProfileStep({ data, dispatch }: StepProps) {
  const { t } = useTranslation()
  const [photos, setPhotos] = useState<Blob[]>(() => [...(data.profile?.photos ?? [])])
  const [triedSubmit, setTriedSubmit] = useState(false)
  const { register, control, handleSubmit, formState } = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: data.profile?.name ?? '',
      bio: data.profile?.bio ?? '',
      ...(data.profile ? { gender: data.profile.gender } : {}),
    },
  })
  const photosMissing = photos.length < MIN_PHOTOS
  const bioLength = useWatch({ control, name: 'bio' }).length

  const onSubmit = handleSubmit((values) => {
    if (photosMissing) return
    dispatch({ type: 'PROFILE_SAVED', profile: { ...values, photos } })
  })

  return (
    <OnboardingStepLayout
      step="profile"
      title={t('onboarding.profile.title')}
      description={t('onboarding.profile.body')}
      onBack={() => dispatch({ type: 'BACK' })}
      footer={
        <Button
          block
          size="lg"
          onClick={() => {
            setTriedSubmit(true)
            void onSubmit()
          }}
        >
          {t('common.continue')}
        </Button>
      }
    >
      <PhotoPicker
        initial={photos}
        onChange={setPhotos}
        error={triedSubmit && photosMissing ? t('onboarding.profile.photosError') : undefined}
      />
      <TextField
        label={t('onboarding.profile.name')}
        autoComplete="given-name"
        maxLength={30}
        error={formState.errors.name ? t('onboarding.profile.nameError') : undefined}
        {...register('name')}
      />
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('onboarding.profile.gender')}</legend>
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <SingleChoice<Gender>
              label={t('onboarding.profile.gender')}
              value={field.value}
              onChange={field.onChange}
              options={GENDERS.map((g) => ({
                value: g,
                label: t(`onboarding.profile.genders.${g}`),
              }))}
            />
          )}
        />
        {formState.errors.gender && (
          <p role="alert" className="text-sm text-danger">
            {t('onboarding.profile.genderError')}
          </p>
        )}
      </fieldset>
      <TextAreaField
        label={t('onboarding.profile.bio')}
        maxLength={BIO_MAX}
        counter={`${bioLength}/${BIO_MAX}`}
        {...register('bio')}
      />
      <GlassCard className="flex items-center gap-3 opacity-80">
        <Music2 className="size-5 shrink-0 text-primary" aria-hidden />
        <span>
          <span className="block font-medium">{t('onboarding.profile.anthemTitle')}</span>
          <span className="block text-sm text-muted-foreground">
            {t('onboarding.profile.anthemHint')}
          </span>
        </span>
      </GlassCard>
      <LayeredInfoBox form="profile" />
    </OnboardingStepLayout>
  )
}
