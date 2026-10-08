/**
 * Roadmap R2 «Cómo está ahora»: one-tap answers from people checked in at a place. The
 * server keeps the last 90 minutes, shows a question from 3 answers and never returns who
 * voted. These lists mirror `private.live_status_values` exactly.
 */
export const MUSIC_GENRES = [
  'reggaeton',
  'latin',
  'commercial',
  'pop',
  'techno',
  'house',
  'electronic',
  'hiphop',
  'rock',
  'indie',
  'other',
] as const
export type MusicGenre = (typeof MUSIC_GENRES)[number]

export const LIVE_QUESTIONS = {
  crowd: ['empty', 'normal', 'busy', 'packed'],
  queue: ['none', 'short', 'long'],
  music_like: ['yes', 'no'],
  music_genre: MUSIC_GENRES,
} as const
export type LiveQuestion = keyof typeof LIVE_QUESTIONS
export type LiveAnswer<Q extends LiveQuestion = LiveQuestion> = (typeof LIVE_QUESTIONS)[Q][number]
export const LIVE_QUESTION_KEYS = Object.keys(LIVE_QUESTIONS) as LiveQuestion[]
export const MAX_DECLARED_GENRES = 3
export const LINEUP_MAX_CHARS = 120

/** Answers of the last window; `counts` is null until the minimum number of votes. */
export interface LiveTally {
  total: number
  counts: Partial<Record<string, number>> | null
}

export interface LiveStatus {
  windowMinutes: number
  minVotes: number
  tallies: Record<LiveQuestion, LiveTally>
  mine: Partial<Record<LiveQuestion, string>>
  /** What the venue declares (null for events). */
  declared: { genres: MusicGenre[]; lineup: string | null } | null
  /** Most voted crowd answer on the same weekday night and hour (null without data). */
  usually: LiveAnswer<'crowd'> | null
}

export const isAnswer = <Q extends LiveQuestion>(
  question: Q,
  value: unknown,
): value is LiveAnswer<Q> =>
  typeof value === 'string' && (LIVE_QUESTIONS[question] as readonly string[]).includes(value)

/** Most voted answer with its share, or null while there are too few votes. */
export function topAnswer(tally: LiveTally): { value: string; percent: number } | null {
  if (!tally.counts || tally.total <= 0) return null
  const [value, count] = Object.entries(tally.counts)
    .filter((entry): entry is [string, number] => typeof entry[1] === 'number')
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0] ?? ['', 0]
  return value ? { value, percent: Math.round((count / tally.total) * 100) } : null
}

/** Parses the server payload defensively: unknown answers and genres are dropped. */
export function parseLiveStatus(raw: unknown): LiveStatus {
  const row = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>
  const tally = (question: LiveQuestion): LiveTally => {
    const t = (row[question] ?? {}) as Record<string, unknown>
    const source =
      t.counts && typeof t.counts === 'object' ? (t.counts as Record<string, unknown>) : null
    const counts = source
      ? Object.fromEntries(
          Object.entries(source)
            .filter(([key, n]) => isAnswer(question, key) && typeof n === 'number')
            .map(([key, n]) => [key, n as number]),
        )
      : null
    return { total: Number(t.total ?? 0) || 0, counts }
  }
  const mineRaw = (row.mine ?? {}) as Record<string, unknown>
  const mine: LiveStatus['mine'] = {}
  for (const question of LIVE_QUESTION_KEYS) {
    if (isAnswer(question, mineRaw[question])) mine[question] = mineRaw[question]
  }
  const declaredRaw = row.declared as Record<string, unknown> | null | undefined
  const declared =
    declaredRaw && typeof declaredRaw === 'object'
      ? {
          genres: (Array.isArray(declaredRaw.genres) ? declaredRaw.genres : []).filter(
            (g): g is MusicGenre => isAnswer('music_genre', g),
          ),
          lineup: typeof declaredRaw.lineup === 'string' ? declaredRaw.lineup : null,
        }
      : null
  return {
    windowMinutes: Number(row.windowMinutes ?? 90) || 90,
    minVotes: Number(row.minVotes ?? 3) || 3,
    tallies: {
      crowd: tally('crowd'),
      queue: tally('queue'),
      music_like: tally('music_like'),
      music_genre: tally('music_genre'),
    },
    mine,
    declared,
    usually: isAnswer('crowd', row.usually) ? row.usually : null,
  }
}
