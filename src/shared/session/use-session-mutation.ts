import { useMutation, type UseMutationOptions } from '@tanstack/react-query'
import { useServices } from '@/shared/services/ServicesProvider'
import type { SessionService } from './session-service'

export class SessionChangedError extends Error {
  constructor() {
    super('session_changed')
  }
}

/** Capture before a request; call before publishing its result or opening a file/URL. */
export function beginSessionWork(session: SessionService): () => void {
  const generation = session.getGeneration()
  return () => {
    if (session.getGeneration() !== generation) throw new SessionChangedError()
  }
}

/** Clearing queries cannot cancel a running mutation. Discard its late response. */
export function useSessionMutation<TData, TVariables = void>(
  options: Omit<UseMutationOptions<TData, Error, TVariables>, 'onMutate' | 'mutationFn'> & {
    mutationFn: (variables: TVariables) => Promise<TData>
  },
) {
  const { session } = useServices()
  return useMutation<TData, Error, TVariables, () => void>({
    ...options,
    onMutate: () => beginSessionWork(session),
    onSuccess: (data, variables, check, context) => {
      check?.()
      return options.onSuccess?.(data, variables, undefined, context)
    },
    onError: (error, variables, check, context) => {
      if (error instanceof SessionChangedError) return
      try {
        check?.()
      } catch {
        return
      }
      return options.onError?.(error, variables, undefined, context)
    },
    onSettled: (data, error, variables, check, context) => {
      try {
        check?.()
      } catch {
        return
      }
      return options.onSettled?.(data, error, variables, undefined, context)
    },
  })
}
