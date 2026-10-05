import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { renderApp } from '@/test/render-app'
import { createMockServices } from '@/mocks/mock-services'
import { UNVERIFIED } from '@/features/verification/model/verification'
import { THEME_IDS } from '@/shared/theme/themes'
import type { DashboardService } from './services/dashboard-service'

const verification = {
  ...UNVERIFIED,
  age: { state: 'verified' as const, verifiedAt: new Date().toISOString() },
}

describe('map-free Home', () => {
  it('refreshes, saves favorites and opens a place without loading a map or requesting GPS', async () => {
    const user = userEvent.setup()
    const base = createMockServices({ latencyMs: 0, realtime: false })
    const reserve = vi.fn(base.places.reserveMapLoad)
    const list = vi.fn(base.places.list)
    const gps = vi.fn()
    const { services, queryClient, router } = renderApp('/home', {
      services: { state: { verification } },
      serviceOverrides: { places: { ...base.places, reserveMapLoad: reserve, list } },
      platform: { geolocation: { checkPermission: vi.fn(), getCurrentPosition: gps } },
    })
    expect(await screen.findByRole('heading', { name: 'Cerca del centro' })).toBeInTheDocument()
    const favorites = screen.getAllByRole('button', { name: /^Guardar/ })
    await user.click(favorites[0]!)
    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Quitar/ }).length).toBeGreaterThan(0),
    )
    expect((await services.dashboard.favorites(0)).total).toBe(1)
    await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    await router.navigate('/favorites')
    const link = (await screen.findAllByRole('link')).find((l) =>
      l.getAttribute('href')?.startsWith('/places/'),
    )!
    await user.click(link)
    await screen.findByRole('link', { name: 'Ver en el mapa' })
    expect(reserve).not.toHaveBeenCalled()
    expect(list).not.toHaveBeenCalled()
    expect(gps).not.toHaveBeenCalled()
  })

  it('preserves a direct place URL and queries by ID instead of searching the catalogue', async () => {
    const base = createMockServices({ latencyMs: 0, realtime: false })
    const place = (await base.places.list())[0]!
    const getById = vi.fn().mockResolvedValue(place)
    const list = vi.fn()
    const reserveMapLoad = vi.fn()
    const { router } = renderApp(`/places/${place.id}`, {
      serviceOverrides: { places: { ...base.places, getById, list, reserveMapLoad } },
    })
    await screen.findByRole('heading', { name: place.name })
    expect(router.state.location.pathname).toBe(`/places/${place.id}`)
    expect(getById).toHaveBeenCalledWith(place.id)
    expect(list).not.toHaveBeenCalled()
    expect(reserveMapLoad).not.toHaveBeenCalled()
  })

  it('shares the selected city and does not reinterpret missing activity as an error', async () => {
    const user = userEvent.setup()
    const summary = vi.fn<DashboardService['summary']>().mockResolvedValue({
      nearby: [],
      tonight: [],
      now: [],
      favorites: [],
      favoritesTotal: 0,
      social: null,
    })
    const { services, platform } = renderApp('/home', {
      serviceOverrides: { dashboard: { summary, favorites: vi.fn(), setFavorite: vi.fn() } },
    })
    await screen.findByRole('heading', { name: 'Cerca del centro' })
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Ciudad que quieres explorar' }),
      'Barcelona',
    )
    await waitFor(() => expect(summary.mock.calls.at(-1)?.[0]).toBe('Barcelona'))
    await expect(platform.preferences.get('explore-city')).resolves.toBe('Barcelona')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(services.dashboard.summary).toBe(summary)
    expect(screen.getByRole('link', { name: /Verifica/ })).toHaveAttribute(
      'href',
      '/verification/age',
    )
  })

  it('acknowledges only a successful likes load while preserving the received total', async () => {
    const user = userEvent.setup()
    const { services, router } = renderApp('/home', {
      services: { state: { verification }, entitlements: [] },
    })
    const likes = await screen.findByRole('link', { name: /Likes nuevos/ })
    const before = (await services.dashboard.summary('Madrid', { lat: 40.4, lng: -3.7 })).social!
      .newLikes
    expect(before).toBeGreaterThan(0)
    await user.click(likes)
    await screen.findByRole('heading', { name: 'Quién te ha dado like' })
    await waitFor(async () =>
      expect(
        (await services.dashboard.summary('Madrid', { lat: 40.4, lng: -3.7 })).social?.newLikes,
      ).toBe(0),
    )
    expect((await services.matching.likesYou()).length).toBe(before)
    await router.navigate('/home')
    const updated = await screen.findByRole('link', { name: /Likes nuevos/ })
    expect(within(updated).getByText('0')).toBeInTheDocument()
  })

  it.each(THEME_IDS)('renders the mosaic in %s with five navigation tabs', async (themeId) => {
    renderApp('/home', {
      services: {
        state: { verification },
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
      settings: { themeId, reduceMotion: true },
    })
    await screen.findByRole('heading', { name: 'Cerca del centro' })
    expect(document.documentElement.dataset.theme).toBe(themeId)
    expect(document.documentElement.dataset.motion).toBe('reduced')
    expect(
      within(screen.getByRole('navigation', { name: 'Navegación principal' })).getAllByRole('link'),
    ).toHaveLength(5)
    expect(screen.getByRole('link', { name: /Chats por contestar/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Matches/ })).toHaveAttribute(
      'href',
      '/tonight#matches',
    )
  })

  it('does not mark likes as seen when the snapshot fails to load', async () => {
    const base = createMockServices({ latencyMs: 0, realtime: false })
    const markLikesSeen = vi.fn()
    renderApp('/tonight/likes', {
      services: { state: { verification } },
      serviceOverrides: {
        matching: {
          ...base.matching,
          likesSnapshot: vi.fn().mockRejectedValue(new Error('offline')),
          markLikesSeen,
        },
      },
    })
    await screen.findByRole('alert')
    expect(markLikesSeen).not.toHaveBeenCalled()
  })
})
