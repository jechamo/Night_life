import { QueryClient } from '@tanstack/react-query'

/** TanStack Query is the only client cache (PRD 3.4); Realtime will update it, not parallel state. */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retries with exponential backoff (PRD 6.15 A10), capped at 8 s.
        retry: 2,
        retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      },
      mutations: { retry: 0 },
    },
  })
}
