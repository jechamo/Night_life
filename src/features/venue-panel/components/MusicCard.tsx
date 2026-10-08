import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LiveStatusSummary, useAnswerLabel } from '@/features/places/components/LiveStatusSection'
import { useLiveStatus } from '@/features/places/hooks/use-places'
import {
  LINEUP_MAX_CHARS,
  MAX_DECLARED_GENRES,
  MUSIC_GENRES,
  type LiveStatus,
  type MusicGenre,
} from '@/features/places/model/live-status'
import { Button } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'
import { Chip } from '@/shared/ui/chip'
import { TextField } from '@/shared/ui/text-field'
import { useSetVenueMusic } from '../hooks/use-venue-panel'

function MusicForm({ placeId, status }: { placeId: string; status: LiveStatus }) {
  const { t } = useTranslation()
  const answerLabel = useAnswerLabel()
  const save = useSetVenueMusic(placeId)
  const [genres, setGenres] = useState<MusicGenre[]>(status.declared?.genres ?? [])
  const [lineup, setLineup] = useState(status.declared?.lineup ?? '')
  const toggle = (genre: MusicGenre) =>
    setGenres((current) =>
      current.includes(genre)
        ? current.filter((g) => g !== genre)
        : current.length < MAX_DECLARED_GENRES
          ? [...current, genre]
          : current,
    )
  return (
    <GlassCard className="space-y-4">
      <p className="text-sm text-muted-foreground">{t('venuePanel.music.body')}</p>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">{t('venuePanel.music.genres')}</legend>
        <div className="flex flex-wrap gap-2">
          {MUSIC_GENRES.map((genre) => (
            <Chip
              key={genre}
              selected={genres.includes(genre)}
              disabled={!genres.includes(genre) && genres.length >= MAX_DECLARED_GENRES}
              onClick={() => toggle(genre)}
            >
              {answerLabel('music_genre', genre)}
            </Chip>
          ))}
        </div>
      </fieldset>
      <TextField
        label={t('venuePanel.music.lineup')}
        hint={t('venuePanel.music.lineupHint')}
        value={lineup}
        maxLength={LINEUP_MAX_CHARS}
        onChange={(event) => setLineup(event.target.value)}
      />
      <Button block disabled={save.isPending} onClick={() => save.mutate({ genres, lineup })}>
        {t('venuePanel.music.save')}
      </Button>
      {save.isSuccess && (
        <p role="status" className="text-sm text-success">
          {t('venuePanel.music.saved')}
        </p>
      )}
      {save.isError && (
        <p role="alert" className="text-sm text-danger">
          {t('venuePanel.music.error')}
        </p>
      )}
      <div className="space-y-2 border-t border-border pt-4">
        <h3 className="text-sm font-medium">{t('venuePanel.music.summary')}</h3>
        <LiveStatusSummary status={status} />
      </div>
    </GlassCard>
  )
}

/** Roadmap R2: the venue declares its music; people confirm it with check-in votes. */
export function MusicCard({ placeId }: { placeId: string }) {
  const { data: status, isError } = useLiveStatus(placeId, true)
  if (isError) return null
  if (!status) return <GlassCard className="h-48" aria-busy="true" />
  return <MusicForm placeId={placeId} status={status} />
}
