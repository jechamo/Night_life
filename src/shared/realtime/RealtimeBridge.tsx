import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { messagesKey, summariesKey, typingKey } from '@/features/chats/hooks/use-chat'
import type { ChatMessage } from '@/features/chats/services/chat-service'
import { useMatchCelebration } from '@/features/matching/components/MatchCelebration'
import { matchesKey } from '@/features/matching/hooks/use-matching'
import type { Match } from '@/features/matching/services/matching-service'
import { placesListKey } from '@/features/places/hooks/use-places'
import type { Place } from '@/features/places/model/types'
import { useServices } from '@/shared/services/ServicesProvider'

export const newPeopleKey = ['live', 'new-people'] as const
/** Live notices fade away on their own (PRD 6.6.1 "aviso discreto"). */
const NOTICE_MS = 8000
export interface NewPeopleNotice {
  placeId: string
  count: number
  at: number
}

/**
 * Single realtime subscription for the app (Observer, PRD 3.4): every event is
 * written into the TanStack Query cache, which is the only client state.
 */
export function RealtimeBridge() {
  const { realtime } = useServices()
  const queryClient = useQueryClient()
  const { celebrate } = useMatchCelebration()

  useEffect(
    () =>
      realtime.subscribe((event) => {
        switch (event.type) {
          case 'dashboard_changed':
            void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            void queryClient.invalidateQueries({ queryKey: ['favorites'] })
            void queryClient.invalidateQueries({ queryKey: ['places', 'detail'] })
            break
          case 'stats':
            void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            void queryClient.invalidateQueries({ queryKey: ['places', 'detail', event.placeId] })
            queryClient.setQueriesData<Place[]>({ queryKey: placesListKey }, (list) =>
              list?.map((p) => (p.id === event.placeId ? { ...p, stats: event.stats } : p)),
            )
            break
          case 'new_people': {
            const at = Date.now()
            queryClient.setQueryData<NewPeopleNotice>(newPeopleKey, {
              placeId: event.placeId,
              count: event.count,
              at,
            })
            setTimeout(
              () =>
                queryClient.setQueryData<NewPeopleNotice | null>(newPeopleKey, (current) =>
                  current?.at === at ? null : current,
                ),
              NOTICE_MS,
            )
            break
          }
          case 'match':
            void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            void queryClient.invalidateQueries({ queryKey: matchesKey })
            void queryClient.invalidateQueries({ queryKey: summariesKey })
            celebrate(event.match)
            break
          case 'message':
            void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.setQueryData<ChatMessage[]>(messagesKey(event.message.matchId), (list) =>
              list && !list.some((m) => m.id === event.message.id)
                ? [...list, event.message]
                : list,
            )
            void queryClient.invalidateQueries({ queryKey: summariesKey })
            break
          case 'typing':
            queryClient.setQueryData(typingKey(event.matchId), event.typing)
            if (event.typing)
              setTimeout(() => queryClient.setQueryData(typingKey(event.matchId), false), 6000)
            break
          case 'read':
          case 'messages_changed':
            void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            void queryClient.invalidateQueries({ queryKey: messagesKey(event.matchId) })
            void queryClient.invalidateQueries({ queryKey: summariesKey })
            break
          case 'removed':
            void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            queryClient.setQueryData<Match[]>(matchesKey, (list) =>
              list?.filter((m) => m.id !== event.matchId),
            )
            queryClient.removeQueries({ queryKey: messagesKey(event.matchId) })
            queryClient.removeQueries({ queryKey: typingKey(event.matchId) })
            void queryClient.invalidateQueries({ queryKey: ['matching'] })
            void queryClient.invalidateQueries({ queryKey: summariesKey })
            break
          case 'refresh':
            void queryClient.invalidateQueries({ queryKey: ['dashboard'] })
            void queryClient.invalidateQueries({ queryKey: ['favorites'] })
            void queryClient.invalidateQueries({ queryKey: ['premium'] })
            void queryClient.invalidateQueries({ queryKey: ['venue-panel'] })
            void queryClient.invalidateQueries({ queryKey: ['entitlements'] })
            void queryClient.invalidateQueries({ queryKey: ['matching'] })
            void queryClient.invalidateQueries({ queryKey: ['chat'] })
            break
        }
      }),
    [realtime, queryClient, celebrate],
  )
  return null
}
