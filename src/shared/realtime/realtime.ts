import type { ChatMessage } from '@/features/chats/services/chat-service'
import type { Match } from '@/features/matching/services/matching-service'
import type { PlaceStats } from '@/features/places/model/types'

/**
 * Realtime events (Observer, PRD 3.4). Hooks subscribe and update the TanStack
 * Query cache; there is never a parallel client state. Supabase Realtime from Block 7.
 */
export type RealtimeEvent =
  | { type: 'stats'; placeId: string; stats: PlaceStats }
  | { type: 'new_people'; placeId: string; count: number }
  | { type: 'match'; match: Match }
  | { type: 'message'; message: ChatMessage }
  | { type: 'typing'; matchId: string; typing: boolean }
  | { type: 'read'; matchId: string }

export interface RealtimeService {
  subscribe(handler: (event: RealtimeEvent) => void): () => void
}
