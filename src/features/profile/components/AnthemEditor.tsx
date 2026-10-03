import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { hasRole } from '@/shared/session/roles'
import { useRoles } from '@/shared/session/use-roles'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { TextField } from '@/shared/ui/text-field'
import { useMyProfile, useUpdateProfile } from '../use-my-profile'

export function AnthemEditor() {
  const { t } = useTranslation()
  const { data: me } = useMyProfile()
  const roles = useRoles()
  const tools = useFeatureFlag('test_tools_enabled')
  const update = useUpdateProfile()
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const canSimulate = tools === 'on' && (hasRole(roles, 'tester') || hasRole(roles, 'admin'))
  return (
    <GlassCard className="space-y-3">
      <p className="font-medium">{t('onboarding.profile.anthemTitle')}</p>
      <p className="text-sm text-muted-foreground">
        {t(canSimulate ? 'anthem.testHint' : 'anthem.unavailable')}
      </p>
      {canSimulate && (
        <>
          <TextField
            label={t('anthem.title')}
            value={title}
            maxLength={80}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            label={t('anthem.artist')}
            value={artist}
            maxLength={80}
            onChange={(e) => setArtist(e.target.value)}
          />
          <Button
            disabled={!title.trim() || !artist.trim() || update.isPending}
            onClick={() =>
              update.mutate({
                anthem: { title: title.trim(), artist: artist.trim(), simulated: true },
              })
            }
          >
            {t('common.save')}
          </Button>
        </>
      )}
      {me?.anthem && (
        <Button
          variant="ghost"
          disabled={update.isPending}
          onClick={() => update.mutate({ anthem: null })}
        >
          {t('anthem.remove')}
        </Button>
      )}
      {update.isError && (
        <p role="alert" className="text-sm text-danger">
          {t('anthem.failed')}
        </p>
      )}
    </GlassCard>
  )
}
