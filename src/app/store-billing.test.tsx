import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { createMockServices } from '@/mocks/mock-services'
import type { StoreBillingService } from '@/platform'
import { err, ok } from '@/shared/lib/result'
import { renderApp } from '@/test/render-app'

const USER = '0b5f8c2e-1d3a-4b6c-9e7f-a1b2c3d4e5f6'
const quiet = { settings: { reduceMotion: true } } as const

function nativeStore(overrides: Partial<StoreBillingService> = {}): StoreBillingService {
  return {
    available: true,
    storeName: 'play_store',
    configure: vi.fn(() => Promise.resolve(ok(undefined))),
    products: vi.fn(() =>
      Promise.resolve(ok([{ identifier: 'pass_monthly', title: 'Pase', priceString: '9,99 €' }])),
    ),
    purchase: vi.fn(() => Promise.resolve(ok(undefined))),
    restore: vi.fn(() => Promise.resolve(ok(undefined))),
    manageSubscriptions: vi.fn(() => Promise.resolve(err('unavailable' as const))),
    logOut: vi.fn(() => Promise.resolve()),
    ...overrides,
  }
}

/** Mock premium service with the Block 11b store methods. */
function premiumWithStore() {
  const base = createMockServices({ latencyMs: 0, realtime: false }).premium
  const storeConfig = vi.fn(() =>
    Promise.resolve(
      ok({
        apiKey: 'test_key',
        userId: USER,
        mode: 'test' as const,
        products: { pass_monthly: 'pass_monthly', sparks_5: 'sparks_5' },
      }),
    ),
  )
  const syncStore = vi.fn(async () => ok(await base.getState()))
  return { premium: { ...base, storeConfig, syncStore }, storeConfig, syncStore }
}

const storeFlags = { flags: { store_payments_enabled: 'on' as const } }

describe('native store purchases (Block 11b)', () => {
  it('never offers Stripe inside the app while store payments are off', async () => {
    renderApp('/premium/checkout/pass_monthly', {
      ...quiet,
      platform: { runtime: 'native', store: nativeStore() },
    })
    expect(await screen.findByText('Próximamente')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Suscribirme/ })).not.toBeInTheDocument()
  })

  it('buys in the store with the server-side identifier and lets the server apply it', async () => {
    const store = nativeStore()
    const { premium, storeConfig, syncStore } = premiumWithStore()
    renderApp('/premium/checkout/pass_monthly', {
      ...quiet,
      services: storeFlags,
      platform: { runtime: 'native', store },
      serviceOverrides: { premium },
    })
    const buy = await screen.findByRole('button', { name: 'Suscribirme en la tienda de pruebas' })
    expect(screen.getByText('Precio en la tienda: 9,99 €')).toBeInTheDocument()
    // No Stripe consent checkbox: the store's own sheet carries the terms.
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    await userEvent.click(buy)
    await waitFor(() => expect(syncStore).toHaveBeenCalledTimes(1))
    expect(store.configure).toHaveBeenCalledWith({ apiKey: 'test_key', appUserId: USER })
    expect(store.purchase).toHaveBeenCalledWith('pass_monthly', 'subscription')
    expect(storeConfig).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByText('Compra completada. Tus ventajas ya están activas.'),
    ).toBeInTheDocument()
  })

  it('a cancelled store sheet changes nothing and is not an error', async () => {
    const store = nativeStore({ purchase: vi.fn(() => Promise.resolve(err('cancelled' as const))) })
    const { premium, syncStore } = premiumWithStore()
    renderApp('/premium/checkout/pass_monthly', {
      ...quiet,
      services: storeFlags,
      platform: { runtime: 'native', store },
      serviceOverrides: { premium },
    })
    await userEvent.click(await screen.findByRole('button', { name: /Suscribirme en/ }))
    expect(
      await screen.findByText('Compra cancelada. No se te ha cobrado nada.'),
    ).toBeInTheDocument()
    expect(syncStore).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('restores purchases from the paywall through the server', async () => {
    const store = nativeStore()
    const { premium, syncStore } = premiumWithStore()
    renderApp('/premium', {
      ...quiet,
      services: storeFlags,
      platform: { runtime: 'native', store },
      serviceOverrides: { premium },
    })
    const restore = await screen.findByRole('button', { name: 'Restaurar compras' })
    await waitFor(() => expect(restore).toBeEnabled())
    await userEvent.click(restore)
    expect(await screen.findByText('Compras restauradas.')).toBeInTheDocument()
    expect(store.restore).toHaveBeenCalled()
    expect(syncStore).toHaveBeenCalledTimes(1)
  })

  it('keeps the web on Stripe: no store checkout or restore button', async () => {
    renderApp('/premium/checkout/pass_monthly', { ...quiet, services: storeFlags })
    expect(await screen.findByRole('checkbox')).toBeInTheDocument()
    expect(screen.queryByText(/tienda de pruebas/)).not.toBeInTheDocument()
  })

  it('shows store subscriptions as managed by the store, without Stripe actions', async () => {
    const { premium } = premiumWithStore()
    const state = await premium.getState()
    const storeState = {
      ...state,
      subscription: {
        id: 's1',
        productCode: 'pass_monthly' as const,
        provider: 'test_store' as const,
        status: 'active' as const,
        startedAt: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 300_000).toISOString(),
        simulated: false,
      },
    }
    renderApp('/premium/subscription', {
      ...quiet,
      serviceOverrides: { premium: { ...premium, getState: () => Promise.resolve(storeState) } },
    })
    expect(
      await screen.findByText(/Suscripción gestionada en la tienda de pruebas/),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar suscripción' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Desistir/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Portal/ })).not.toBeInTheDocument()
  })
})
