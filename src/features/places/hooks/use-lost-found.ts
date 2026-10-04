import { useSessionMutation } from '@/shared/session/use-session-mutation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import { lostFoundKey } from './use-places'

export function useLostFound(placeId: string) {
  const { places } = useServices()
  return useQuery({ queryKey: lostFoundKey(placeId), queryFn: () => places.lostAndFound(placeId) })
}

type Action =
  | { kind: 'post'; text: string }
  | { kind: 'reply'; postId: string; text: string }
  | { kind: 'edit'; postId: string; text: string }
  | { kind: 'delete'; postId: string }

export function useLostFoundAction(placeId: string) {
  const { places } = useServices()
  const queryClient = useQueryClient()
  return useSessionMutation({
    mutationFn: async (action: Action) => {
      if (action.kind === 'delete') {
        await places.deleteLostFound(action.postId)
        return null
      }
      const result =
        action.kind === 'post'
          ? await places.postLostFound(placeId, action.text)
          : action.kind === 'reply'
            ? await places.replyLostFound(action.postId, action.text)
            : await places.editLostFound(action.postId, action.text)
      return result.ok ? null : result.error
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: lostFoundKey(placeId) }),
  })
}
