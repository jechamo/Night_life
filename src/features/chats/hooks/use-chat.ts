import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { ChatMessage } from '../services/chat-service'
import { mergeMessages } from '../model/messages'

export const summariesKey = ['chat', 'summaries'] as const
export const messagesKey = (matchId: string) => ['chat', 'messages', matchId] as const
export const typingKey = (matchId: string) => ['chat', 'typing', matchId] as const

export function useChatSummaries() {
  const { chat } = useServices()
  return useQuery({ queryKey: summariesKey, queryFn: () => chat.summaries() })
}

export function useMessages(matchId: string) {
  const { chat } = useServices()
  const queryClient = useQueryClient()
  return useQuery({
    queryKey: messagesKey(matchId),
    queryFn: async () =>
      mergeMessages(
        queryClient.getQueryData<ChatMessage[]>(messagesKey(matchId)) ?? [],
        await chat.messages(matchId),
      ),
  })
}

export function useEarlierMessages(matchId: string) {
  const { chat } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const first = queryClient.getQueryData<ChatMessage[]>(messagesKey(matchId))?.[0]
      return first ? chat.messages(matchId, { sentAt: first.sentAt, id: first.id }) : []
    },
    onSuccess: (messages) => {
      queryClient.setQueryData<ChatMessage[]>(messagesKey(matchId), (list = []) =>
        mergeMessages(list, messages),
      )
    },
  })
}

/** Typing indicator lives in the query cache too, fed by realtime (no parallel state). */
export function useTyping(matchId: string): boolean {
  const { data } = useQuery({
    queryKey: typingKey(matchId),
    queryFn: () => false,
    staleTime: Infinity,
  })
  return data ?? false
}

export function useSendMessage(matchId: string) {
  const { chat } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => chat.send(matchId, text),
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(messagesKey(matchId), (list = []) =>
        mergeMessages(list, [message]),
      )
      void queryClient.invalidateQueries({ queryKey: summariesKey })
    },
  })
}

export function useMarkRead(matchId: string) {
  const { chat } = useServices()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => chat.markRead(matchId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: summariesKey }),
  })
}
