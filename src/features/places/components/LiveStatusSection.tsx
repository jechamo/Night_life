import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'
import { useLiveStatus, useReportLiveStatus } from '../hooks/use-places'
import {
  LIVE_QUESTION_KEYS,
  LIVE_QUESTIONS,
  topAnswer,
  type LiveAnswer,
  type LiveQuestion,
  type LiveStatus,
} from '../model/live-status'

const KNOWN_ERRORS = ['no_check_in', 'own_venue'] as const

/** Label of one answer (values come already validated by `parseLiveStatus`). */
export function useAnswerLabel() {
  const { t } = useTranslation()
  return (question: LiveQuestion, value: string): string => {
    switch (question) {
      case 'crowd':
        return t(`places.live.answers.crowd.${value as LiveAnswer<'crowd'>}`)
      case 'queue':
        return t(`places.live.answers.queue.${value as LiveAnswer<'queue'>}`)
      case 'music_like':
        return t(`places.live.answers.music_like.${value as LiveAnswer<'music_like'>}`)
      case 'music_genre':
        return t(`places.live.answers.music_genre.${value as LiveAnswer<'music_genre'>}`)
    }
  }
}

/** Aggregated answers: what the venue declares, what people say and the usual crowd. */
export function LiveStatusSummary({ status }: { status: LiveStatus }) {
  const { t } = useTranslation()
  const answerLabel = useAnswerLabel()
  const declared = status.declared
  const peopleGenre = topAnswer(status.tallies.music_genre)
  return (
    <div className="space-y-3">
      {declared && (declared.genres.length > 0 || declared.lineup) && (
        <div className="space-y-1 text-sm">
          {declared.genres.length > 0 && (
            <p>
              {t('places.live.venueSays', {
                genres: declared.genres.map((g) => answerLabel('music_genre', g)).join(' · '),
              })}
            </p>
          )}
          {declared.lineup && (
            <p className="text-muted-foreground">
              {t('places.live.lineup', { lineup: declared.lineup })}
            </p>
          )}
          {peopleGenre && (
            <p>
              {t('places.live.peopleSays', {
                answer: answerLabel('music_genre', peopleGenre.value),
                percent: peopleGenre.percent,
              })}
            </p>
          )}
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
        {LIVE_QUESTION_KEYS.map((question) => {
          const top = topAnswer(status.tallies[question])
          return (
            <div key={question}>
              <dt className="text-xs text-muted-foreground">
                {t(`places.live.questions.${question}`)}
              </dt>
              <dd className={cn(!top && 'text-muted-foreground')}>
                {top
                  ? t('places.live.share', {
                      answer: answerLabel(question, top.value),
                      percent: top.percent,
                    })
                  : t('places.live.fewVotes')}
              </dd>
            </div>
          )
        })}
      </dl>
      {status.usually && (
        <p className="text-sm text-muted-foreground">
          {t('places.live.usually', { answer: answerLabel('crowd', status.usually) })}
        </p>
      )}
    </div>
  )
}

/**
 * Roadmap R2 «Cómo está ahora» (flag `live_status_enabled`): people checked in here answer
 * a few one-tap questions; everyone sees anonymous totals of the last 90 minutes. The
 * Vibe Check below is unchanged.
 */
export function LiveStatusSection({
  placeId,
  checkedInHere,
}: {
  placeId: string
  checkedInHere: boolean
}) {
  const { t } = useTranslation()
  const answerLabel = useAnswerLabel()
  const { data: status, isError } = useLiveStatus(placeId, true)
  const report = useReportLiveStatus(placeId)
  if (isError) return null
  const error = report.error?.message
  return (
    <section id="live-status" aria-labelledby="live-status-title" className="space-y-3">
      <div>
        <h3 id="live-status-title" className="text-lg font-semibold">
          {t('places.live.title')}
        </h3>
        <p className="text-xs text-muted-foreground">
          {t('places.live.subtitle', { minutes: status?.windowMinutes ?? 90 })}
        </p>
      </div>
      {status ? (
        <LiveStatusSummary status={status} />
      ) : (
        <p className="text-sm text-muted-foreground" aria-busy="true">
          {t('places.live.loading')}
        </p>
      )}
      {checkedInHere && status ? (
        <div className="space-y-3">
          {LIVE_QUESTION_KEYS.map((question) => (
            <div
              key={question}
              role="group"
              aria-label={`${t('places.live.yourAnswer')}: ${t(`places.live.questions.${question}`)}`}
              className="space-y-1.5"
            >
              <p className="text-xs text-muted-foreground">
                {t(`places.live.questions.${question}`)}
              </p>
              <div className="flex flex-wrap gap-2">
                {LIVE_QUESTIONS[question].map((answer) => {
                  const selected = status.mine[question] === answer
                  return (
                    <button
                      key={answer}
                      type="button"
                      disabled={report.isPending}
                      aria-pressed={selected}
                      onClick={() => report.mutate({ question, answer })}
                      className={cn(
                        'touch-target font-label inline-flex items-center rounded-full border px-3 text-sm transition-opacity disabled:opacity-50',
                        selected
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-surface',
                      )}
                    >
                      {answerLabel(question, answer)}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{t('places.live.needsCheckIn')}</p>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {(KNOWN_ERRORS as readonly string[]).includes(error)
            ? t(`places.live.errors.${error as (typeof KNOWN_ERRORS)[number]}`)
            : t('places.live.errors.generic')}
        </p>
      )}
    </section>
  )
}
