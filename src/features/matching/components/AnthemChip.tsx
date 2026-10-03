import { useTranslation } from 'react-i18next'
import { usePlatform } from '@/platform'
import type { Anthem } from '../model/people'

/** Anthem chip with a mini equaliser (PRD 6.6.1). Bars only scale (transform). */
export function AnthemChip({ anthem }: { anthem: Anthem }) {
  const { t } = useTranslation()
  const { audio } = usePlatform()
  return (
    <button
      type="button"
      disabled={!anthem.simulated}
      onClick={() => {
        void audio.playTestSample()
      }}
      className="glass font-label inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-xs"
      aria-label={t('matching.anthem', { title: anthem.title, artist: anthem.artist })}
    >
      <span className="flex h-3 items-end gap-0.5" aria-hidden>
        {[0, 0.2, 0.4].map((delay) => (
          <span
            key={delay}
            className="nl-eq-bar block h-3 w-0.5 rounded-full bg-live"
            style={{ animationDelay: `${delay}s` }}
          />
        ))}
      </span>
      <span className="truncate">
        {anthem.title} · {anthem.artist}
        {anthem.simulated && ` · ${t('anthem.testSample')}`}
      </span>
    </button>
  )
}
