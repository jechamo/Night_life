export interface ProviderQuota {
  capability: 'mapbox' | 'google_places'
  mode: 'free_quota'
  sku: string
  available: boolean
  canCall: boolean
  editable: boolean
  /** A public Mapbox token (pk.*) is stored server-side and only handed out per reserved load. */
  hasToken: boolean
  expiresAt: string | null
  dailyBudget: number
  dailyUsed: number
  monthlyBudget: number
  monthlyUsed: number
  freeMonthlyAllowance: number
  safetyMargin: number
  observedProviderUsage: number
  usageObservedAt: string | null
  maxBudget: number
  increaseStep: number
}

export interface ProviderQuotaChange {
  capability: ProviderQuota['capability']
  dailyBudget: number
  monthlyBudget: number
  enabled: boolean
  /** Current total shown by the provider; omit to preserve the existing observation. */
  observedProviderUsage?: number
}

export function quotaWarning(quota: Pick<ProviderQuota, 'monthlyBudget' | 'monthlyUsed'>) {
  if (quota.monthlyBudget === 0 || quota.monthlyUsed >= quota.monthlyBudget) return 'exhausted'
  const percent = (quota.monthlyUsed / quota.monthlyBudget) * 100
  if (percent >= 95) return 'critical'
  if (percent >= 80) return 'near'
  return null
}
