import { beginSessionWork, useSessionMutation } from '@/shared/session/use-session-mutation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router'
import { usePlatform } from '@/platform'
import { entitlementsQueryKey } from '@/shared/entitlements/use-entitlement'
import { useServices } from '@/shared/services/ServicesProvider'
import type { ProductCode } from '../model/catalog'
import type { PremiumState } from '../services/premium-service'

export const premiumKey = ['premium', 'state'] as const

export function usePremiumState() {
  const { premium } = useServices()
  return useQuery({ queryKey: premiumKey, queryFn: () => premium.getState() })
}

export function usePurchaseStatus(id: string | null) {
  const { premium, session: premiumSession } = useServices()
  const refresh = useRefresh()
  return useQuery({
    queryKey: ['premium', 'order', id],
    enabled: !!id,
    refetchInterval: (q) => (q.state.data && q.state.data !== 'pending' ? false : 1500),
    queryFn: async () => {
      const check = beginSessionWork(premiumSession)
      const status = await premium.purchaseStatus(id!)
      check()
      if (status === 'paid') {
        const state = await premium.getState()
        check()
        await refresh(state)
      }
      return status
    },
  })
}

export function useBillingPortal() {
  const { premium, session } = useServices()
  const { browser } = usePlatform()
  return useSessionMutation({
    mutationFn: async () => {
      const check = beginSessionWork(session)
      const url = await premium.portal()
      check()
      return browser.openExternalFlow(url)
    },
  })
}

/** Any change in purchases refreshes entitlements: they are the only source of truth. */
function useRefresh() {
  const queryClient = useQueryClient()
  return async (state?: PremiumState) => {
    if (state) queryClient.setQueryData(premiumKey, state)
    await queryClient.invalidateQueries({ queryKey: entitlementsQueryKey })
    await queryClient.invalidateQueries({ queryKey: ['matching', 'likes-used'] })
  }
}

export function useStartPurchase() {
  const { premium } = useServices()
  const { browser } = usePlatform()
  const navigate = useNavigate()
  return useSessionMutation({
    mutationFn: (code: ProductCode) => premium.startPurchase(code),
    onSuccess: async (result) => {
      if (!result.ok) return
      if (result.value.type === 'internal') await navigate(result.value.path)
      else await browser.openExternalFlow(result.value.url)
    },
  })
}

export function useCompleteTestPurchase() {
  const { premium } = useServices()
  const refresh = useRefresh()
  return useSessionMutation({
    mutationFn: (code: ProductCode) => premium.completeTestPurchase(code),
    onSuccess: refresh,
  })
}

export function useSubscriptionActions() {
  const { premium } = useServices()
  const refresh = useRefresh()
  return {
    cancel: useSessionMutation({ mutationFn: () => premium.cancel(), onSuccess: refresh }),
    resume: useSessionMutation({ mutationFn: () => premium.resume(), onSuccess: refresh }),
    withdraw: useSessionMutation({
      mutationFn: (orderId?: string) => premium.withdraw(orderId),
      onSuccess: (result) => refresh(result.ok ? result.value : undefined),
    }),
    notifyMe: useSessionMutation({
      mutationFn: (on: boolean) => premium.setNotifyMe(on),
      onSuccess: refresh,
    }),
  }
}

export function useRedeemCode() {
  const { premium } = useServices()
  const refresh = useRefresh()
  return useSessionMutation({
    mutationFn: (code: string) => premium.redeem(code),
    onSuccess: async (result) => {
      if (result.ok) await refresh()
    },
  })
}

export function usePaidDm() {
  const { premium, session } = useServices()
  const refresh = useRefresh()
  return useSessionMutation({
    mutationFn: ({ personId, text }: { personId: string; text: string }) =>
      premium.sendPaidDm(personId, text),
    onSuccess: async () => {
      const check = beginSessionWork(session)
      const state = await premium.getState()
      check()
      await refresh(state)
    },
  })
}
