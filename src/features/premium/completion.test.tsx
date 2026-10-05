import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { renderApp } from '@/test/render-app'
import { createMockServices } from '@/mocks/mock-services'
import { ok } from '@/shared/lib/result'
import type { Candidate } from '@/features/matching/model/people'
import { rankCandidates } from '@/features/matching/model/matching'

const verification = {
  age: { state: 'verified', verifiedAt: '2026-10-05T00:00:00Z' },
  photo: { state: 'not_started' },
  identity: { state: 'not_started' },
} as const
const base = () => createMockServices({ latencyMs: 0, realtime: false })
const state = {
  subscription: null,
  oneNightUntil: null,
  credits: { spark: 2, spotlight: 1, paid_dm: 0 },
  invoices: [],
  notifyMe: false,
}
const social = { incognito: false, spotlightUntil: null, sparksUnread: 1 }

test('Spark sends from the deck and the anonymous notice can be acknowledged', async () => {
  const b = base()
  const sendSpark = vi.fn().mockResolvedValue(ok({ usedToday: 1, match: null }))
  let unread = 1
  const premium = {
    ...b.premium,
    getState: () => Promise.resolve(state),
    getSocialState: () => Promise.resolve({ ...social, sparksUnread: unread }),
    sendSpark,
    markSparksSeen: vi.fn(() => {
      unread = 0
      return Promise.resolve({ ...social, sparksUnread: 0 })
    }),
  }
  renderApp('/tonight/swipe/v-aurora', {
    services: { state: { verification } },
    settings: { reduceMotion: true },
    serviceOverrides: { premium },
  })
  const button = await screen.findByRole('button', { name: 'Enviar Chispa (saldo: 2)' })
  expect(await screen.findByText(/Alguien ha sentido la chispa/)).toBeInTheDocument()
  await userEvent.setup().click(screen.getByRole('button', { name: 'Entendido' }))
  await waitFor(() =>
    expect(screen.queryByText(/Alguien ha sentido la chispa/)).not.toBeInTheDocument(),
  )
  await userEvent.setup().click(button)
  await waitFor(() => expect(sendSpark).toHaveBeenCalledWith('p-1'))
})

test('Spotlight activates for the chosen venue and displays its end time', async () => {
  const b = base()
  let active: string | null = null
  const activateSpotlight = vi.fn(() => {
    active = '2099-10-05T23:00:00Z'
    return Promise.resolve(ok({ ...social, spotlightUntil: active }))
  })
  const premium = {
    ...b.premium,
    getState: () => Promise.resolve(state),
    getSocialState: () => Promise.resolve({ ...social, spotlightUntil: active }),
    activateSpotlight,
  }
  renderApp('/tonight/swipe/v-aurora', {
    services: { state: { verification } },
    settings: { reduceMotion: true },
    serviceOverrides: { premium },
  })
  await userEvent
    .setup()
    .click(await screen.findByRole('button', { name: 'Activar Foco · 30 minutos' }))
  await waitFor(() => expect(activateSpotlight).toHaveBeenCalledWith('v-aurora'))
  expect(await screen.findByRole('button', { name: /Foco activo hasta/ })).toBeDisabled()
})

test('premium themes lead to the Pass without permission and cannot load as the active theme', async () => {
  const view = renderApp('/profile/themes', {
    services: { entitlements: [] },
    settings: { themeId: 'gold', reduceMotion: true },
  })
  expect(document.documentElement.dataset.theme).toBe('neon-noir')
  await userEvent.setup().click(await screen.findByRole('button', { name: /Oro/ }))
  await waitFor(() => expect(view.router.state.location.pathname).toBe('/premium'))
})

test('an active Pass unlocks extra themes', async () => {
  renderApp('/profile/themes', {
    services: {
      entitlements: [
        {
          key: 'premium_themes',
          source: 'tester',
          status: 'active',
          startsAt: '2026-01-01T00:00:00Z',
          endsAt: null,
        },
      ],
    },
    settings: { reduceMotion: true },
  })
  await userEvent.setup().click(await screen.findByRole('button', { name: /Zafiro/ }))
  await waitFor(() => expect(document.documentElement.dataset.theme).toBe('sapphire'))
})

test('VIP Incognito switch persists through the service', async () => {
  const b = base()
  const setIncognito = vi.fn().mockResolvedValue({ ...social, incognito: true })
  renderApp('/profile', {
    services: {
      state: { verification },
      entitlements: [
        {
          key: 'incognito',
          source: 'tester',
          status: 'active',
          startsAt: '2026-01-01T00:00:00Z',
          endsAt: null,
        },
      ],
    },
    settings: { reduceMotion: true },
    serviceOverrides: {
      premium: { ...b.premium, getSocialState: () => Promise.resolve(social), setIncognito },
    },
  })
  await userEvent.setup().click(await screen.findByRole('switch', { name: 'Modo Incógnito' }))
  await waitFor(() => expect(setIncognito).toHaveBeenCalledWith(true))
})

test('server promotion order survives client ranking and verified filter', () => {
  const candidate = (id: string, priority: number, verified: boolean): Candidate => ({
    profile: {
      id,
      name: id,
      age: 30,
      gender: 'man',
      bio: '',
      photos: [],
      photoVerified: verified,
      trafficLight: 'green',
      anthem: null,
    },
    visibilityPriority: priority,
    context: {
      sameVenueNow: priority === 2,
      sameVenueTonight: false,
      distanceMeters: 100,
      venueName: null,
      sharedArtist: null,
    },
  })
  const list = [
    candidate('ordinary', 2, true),
    candidate('VIP like', 1, true),
    candidate('Spotlight', 0, false),
  ]
  expect(rankCandidates(list, false).map((c) => c.profile.id)).toEqual([
    'Spotlight',
    'VIP like',
    'ordinary',
  ])
  expect(rankCandidates(list, true).map((c) => c.profile.id)).toEqual(['VIP like', 'ordinary'])
})

test('sponsored swipe cards appear once after ten decisions', async () => {
  const b = base()
  const pass = vi.fn().mockResolvedValue(undefined)
  const candidates = (await b.matching.candidates(null)).slice(0, 1).flatMap((c) =>
    Array.from({ length: 21 }, (_, i) => ({
      ...c,
      profile: { ...c.profile, id: `person-${i}`, name: `Person ${i}` },
    })),
  )
  const view = renderApp('/tonight/swipe/v-aurora', {
    services: {
      state: { verification },
      flags: { sponsored_cards_enabled: 'on' },
      entitlements: [],
    },
    settings: { reduceMotion: true },
    serviceOverrides: {
      matching: {
        ...b.matching,
        candidates: () => Promise.resolve(candidates),
        pass,
        sponsoredCards: () => Promise.resolve([{ id: 'v-cobalto', name: 'Sponsored venue' }]),
      },
    },
  })
  const user = userEvent.setup()
  for (let i = 1; i <= 10; i++) {
    await user.click(await screen.findByRole('button', { name: 'Paso' }))
    await waitFor(() => expect(pass).toHaveBeenCalledTimes(i))
    if (i < 10) expect(screen.queryByText('Patrocinado')).not.toBeInTheDocument()
  }
  expect(await screen.findByText('Patrocinado')).toBeInTheDocument()
  await user.click(screen.getByRole('button', { name: 'Continuar' }))
  expect(screen.queryByText('Patrocinado')).not.toBeInTheDocument()
  for (let i = 11; i <= 20; i++) {
    await user.click(await screen.findByRole('button', { name: 'Paso' }))
    await waitFor(() => expect(pass).toHaveBeenCalledTimes(i))
  }
  expect(await screen.findByText('Patrocinado')).toBeInTheDocument()
  view.queryClient.setQueryData(['feature-flags'], {
    ...(await view.services.flags.getAll()),
    sponsored_cards_enabled: 'off',
  })
  await waitFor(() => expect(screen.queryByText('Patrocinado')).not.toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Paso' })).toBeInTheDocument()
})

test('Pro checkout is bound to the managed venue', async () => {
  const b = base()
  const startVenuePurchase = vi
    .fn()
    .mockResolvedValue(
      ok({ type: 'external', url: 'https://checkout.stripe.com/c/pay/test_completion' }),
    )
  renderApp('/venue/v-cobalto', {
    services: {
      flags: { payments_mode: 'test', payments_audience: 'testers', paywall_visibility: 'visible' },
    },
    settings: { reduceMotion: true },
    serviceOverrides: {
      premium: { ...b.premium, startVenuePurchase },
      venuePanel: {
        ...b.venuePanel,
        billingState: () => Promise.resolve({ pro: false, subscription: null }),
      },
    },
  })
  await userEvent.setup().click(await screen.findByRole('button', { name: 'Suscribirme y pagar' }))
  await waitFor(() =>
    expect(startVenuePurchase).toHaveBeenCalledWith('venue_pro_monthly', 'v-cobalto', undefined),
  )
})
