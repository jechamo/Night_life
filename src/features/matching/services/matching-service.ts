import type { Result } from '@/shared/lib/result'
import type { Candidate, PublicProfile } from '../model/people'

export interface Match {
  id: string
  person: PublicProfile
  context: Candidate['context']
  createdAt: string
}

export type ReportReason =
  | 'possible_minor'
  | 'harassment'
  | 'feel_followed'
  | 'fake_profile'
  | 'inappropriate'
  | 'spam'
  | 'other'

/**
 * Port for likes and matches. Mutual-like detection, limits and blocks run on the
 * server (Block 8); the client never decides a match.
 */
export interface MatchingService {
  candidates(placeId: string | null): Promise<Candidate[]>
  like(
    personId: string,
  ): Promise<Result<{ match: Match | null; usedToday: number }, 'limit_reached'>>
  pass(personId: string): Promise<void>
  /** Premium `undo`: returns the last passed candidate. */
  undo(): Promise<Result<Candidate, 'nothing_to_undo'>>
  likesUsedToday(): Promise<number>
  likeStatus?(): Promise<{ usedToday: number; limit: number; unlimited: boolean }>
  likesYouCount?(): Promise<number>
  likesYou(): Promise<PublicProfile[]>
  matches(): Promise<Match[]>
  person(personId: string): Promise<PublicProfile | null>
  unmatch(matchId: string): Promise<void>
  block(personId: string): Promise<void>
  report(personId: string, reason: ReportReason, comment: string): Promise<void>
}
