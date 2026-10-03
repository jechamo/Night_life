import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { ProviderQuota } from '../model/provider-quota'
import { ProviderQuotas } from './ProviderQuotas'

const hooks = vi.hoisted(() => ({
  data: [] as ProviderQuota[],
  error: false,
  mutate: vi.fn(),
  refetch: vi.fn(),
}))
vi.mock('../hooks/use-admin', () => ({
  useProviderQuotas: () => ({
    data: hooks.data,
    isPending: false,
    isError: hooks.error,
    refetch: hooks.refetch,
  }),
  useConfigureProvider: () => ({
    mutate: hooks.mutate,
    isPending: false,
    isError: false,
    isSuccess: false,
  }),
  useSetMapToken: () => ({ mutate: hooks.mutate, isPending: false, isError: false }),
}))
const mapbox: ProviderQuota = {
  capability: 'mapbox',
  mode: 'free_quota',
  sku: 'map_loads_web',
  available: true,
  canCall: true,
  editable: true,
  hasToken: false,
  expiresAt: '2026-11-01T00:00:00Z',
  dailyBudget: 1000,
  dailyUsed: 2,
  monthlyBudget: 1000,
  monthlyUsed: 42,
  freeMonthlyAllowance: 50000,
  safetyMargin: 5000,
  observedProviderUsage: 0,
  usageObservedAt: '2026-10-03T19:00:00Z',
  maxBudget: 45000,
  increaseStep: 1000,
}
beforeEach(() => {
  hooks.data = [{ ...mapbox }]
  hooks.error = false
  vi.clearAllMocks()
})
describe('provider quota controls', () => {
  it('raises the cap manually without resetting consumption or refreshing proof', async () => {
    const user = userEvent.setup()
    render(<ProviderQuotas />)
    await user.click(screen.getByRole('button', { name: 'Añadir 1000 al límite' }))
    expect(screen.getByText(/42 \/ 1000 reservas/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(hooks.mutate).toHaveBeenCalledWith({
      capability: 'mapbox',
      dailyBudget: 1000,
      monthlyBudget: 2000,
      enabled: true,
    })
  })
  it('prevents exceeding the reserved free margin', async () => {
    const user = userEvent.setup()
    render(<ProviderQuotas />)
    await user.clear(screen.getByLabelText('Límite mensual de Nightlife'))
    await user.type(screen.getByLabelText('Límite mensual de Nightlife'), '50000')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
    expect(screen.getByRole('alert')).toHaveTextContent('Revisa los límites')
  })
  it('shows the critical warning at 95 percent', () => {
    hooks.data = [{ ...mapbox, monthlyUsed: 950 }]
    render(<ProviderQuotas />)
    expect(screen.getByRole('status')).toHaveTextContent('95 %')
  })
  it('does not offer activation for an unverified Google SKU', () => {
    hooks.data = [
      {
        ...mapbox,
        capability: 'google_places',
        editable: false,
        canCall: false,
        available: false,
        freeMonthlyAllowance: 0,
      },
    ]
    render(<ProviderQuotas />)
    expect(screen.getByText(/Falta verificar el SKU/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Guardar cambios' })).not.toBeInTheDocument()
  })
  it('only accepts a public Mapbox token', async () => {
    const user = userEvent.setup()
    render(<ProviderQuotas />)
    const field = screen.getByLabelText('Token público de Mapbox (pk.)')
    await user.type(field, 'sk.eyJ1Ijoic2VjcmV0LXRva2VuLXRlc3Qi')
    expect(screen.getByRole('button', { name: 'Guardar token' })).toBeDisabled()
    await user.clear(field)
    await user.type(field, 'pk.eyJ1IjoibmlnaHRsaWZlLXRlc3QifQ.abc')
    await user.click(screen.getByRole('button', { name: 'Guardar token' }))
    expect(hooks.mutate).toHaveBeenCalledWith(
      'pk.eyJ1IjoibmlnaHRsaWZlLXRlc3QifQ.abc',
      expect.anything(),
    )
  })
  it('allows retry after a connection error', async () => {
    const user = userEvent.setup()
    hooks.data = []
    hooks.error = true
    render(<ProviderQuotas />)
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(hooks.refetch).toHaveBeenCalledOnce()
  })
})
