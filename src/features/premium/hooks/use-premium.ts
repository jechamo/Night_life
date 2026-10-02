import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
  return useMutation({
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
  return useMutation({
    mutationFn: (code: ProductCode) => premium.completeTestPurchase(code),
    onSuccess: refresh,
  })
}

export function useSubscriptionActions() {
  const { premium } = useServices()
  const refresh = useRefresh()
  return {
    cancel: useMutation({ mutationFn: () => premium.cancel(), onSuccess: refresh }),
    resume: useMutation({ mutationFn: () => premium.resume(), onSuccess: refresh }),
    withdraw: useMutation({
      mutationFn: () => premium.withdraw(),
      onSuccess: (result) => refresh(result.ok ? result.value : undefined),
    }),
    notifyMe: useMutation({
      mutationFn: (on: boolean) => premium.setNotifyMe(on),
      onSuccess: refresh,
    }),
  }
}

export function useRedeemCode() {
  const { premium } = useServices()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: (code: string) => premium.redeem(code),
    onSuccess: async (result) => {
      if (result.ok) await refresh()
    },
  })
}

export function usePaidDm() {
  const { premium } = useServices()
  const refresh = useRefresh()
  return useMutation({
    mutationFn: ({ personId, text }: { personId: string; text: string }) =>
      premium.sendPaidDm(personId, text),
    onSuccess: async () => refresh(await premium.getState()),
  })
}
