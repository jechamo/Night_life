import { useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { dashboardKey } from '@/features/home/hooks/use-dashboard'
import { useServices } from '@/shared/services/ServicesProvider'
import { useSessionMutation } from '@/shared/session/use-session-mutation'

/** One authorized snapshot; acknowledge only after profiles/count loaded successfully. */
export function useLikesView() {
  const { matching } = useServices()
  const client = useQueryClient()
  const visited = useRef<string | null>(null)
  const query = useQuery({
    queryKey: ['matching', 'likes-view'],
    refetchOnMount: 'always',
    queryFn: async () => {
      if (matching.likesSnapshot) return matching.likesSnapshot()
      const [profiles, count] = await Promise.all([matching.likesYou(), matching.likesYouCount?.()])
      return { profiles, count: count ?? profiles.length, snapshotId: null }
    },
  })
  const seen = useSessionMutation({
    mutationFn: (snapshotId: string) => matching.markLikesSeen?.(snapshotId) ?? Promise.resolve(),
    onSuccess: () => client.invalidateQueries({ queryKey: dashboardKey }),
  })
  const snapshotId = query.data?.snapshotId
  const acknowledge = seen.mutate
  useEffect(() => {
    if (!snapshotId || !query.isFetchedAfterMount || visited.current === snapshotId) return
    visited.current = snapshotId
    acknowledge(snapshotId)
  }, [snapshotId, query.isFetchedAfterMount, acknowledge])
  return {
    ...query,
    seenError: seen.isError,
    retrySeen: () => {
      if (snapshotId) seen.mutate(snapshotId)
    },
  }
}
