import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { TravelState } from '@/features/matching/services/matching-service'
import { createMockServices } from '@/mocks/mock-services'
import { err, ok } from '@/shared/lib/result'
import { renderApp } from '@/test/render-app'

const quiet = { settings: { reduceMotion: true } } as const
const base: TravelState = {
  enabled: true,
  entitled: true,
  homeCity: 'Madrid',
  city: null,
  endsAt: null,
  active: false,
}

function matchingWith(state: TravelState) {
  const matching = createMockServices({ latencyMs: 0, realtime: false }).matching
  let current = state
  const setTravel = vi.fn((city: string) => {
    if (city === 'Madrid') return Promise.resolve(err('same_city' as const))
    current = { ...current, city, endsAt: '2026-10-17T10:00:00Z', active: true }
    return Promise.resolve(ok(current))
  })
  const clearTravel = vi.fn(() => {
    current = { ...current, city: null, endsAt: null, active: false }
    return Promise.resolve(current)
  })
  return {
    matching: { ...matching, travelState: () => Promise.resolve(current), setTravel, clearTravel },
    setTravel,
    clearTravel,
  }
}

const travelFlag = { flags: { travel_mode_enabled: 'on' as const } }

describe('travel mode (Block 11b)', () => {
  it('stays hidden while the flag is off', async () => {
    const { matching } = matchingWith(base)
    renderApp('/profile', { ...quiet, serviceOverrides: { matching } })
    expect(await screen.findByRole('heading', { name: 'Perfil' })).toBeInTheDocument()
    expect(screen.queryByText('Modo viaje')).not.toBeInTheDocument()
  })

  it('offers the Pass to people without the benefit', async () => {
    const { matching } = matchingWith({ ...base, entitled: false })
    renderApp('/profile', { ...quiet, services: travelFlag, serviceOverrides: { matching } })
    expect(
      await screen.findByText('Incluido en el Pase, el Pase VIP y el Pase de una noche.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver Premium' })).toHaveAttribute('href', '/premium')
  })

  it('travels to another city and comes back home', async () => {
    const { matching, setTravel, clearTravel } = matchingWith(base)
    renderApp('/profile', { ...quiet, services: travelFlag, serviceOverrides: { matching } })
    // The home city is not offered as a destination.
    await screen.findByRole('radiogroup', { name: 'Ciudad de destino' })
    expect(screen.queryByRole('radio', { name: 'Madrid' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('radio', { name: 'Ibiza' }))
    await userEvent.click(screen.getByRole('radio', { name: '14 días' }))
    await userEvent.click(screen.getByRole('button', { name: 'Activar modo viaje' }))
    expect(setTravel).toHaveBeenCalledWith('Ibiza', 14)
    expect(await screen.findByText(/De viaje en Ibiza hasta el/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Volver a Madrid' }))
    await waitFor(() => expect(clearTravel).toHaveBeenCalled())
    expect(await screen.findByRole('button', { name: 'Activar modo viaje' })).toBeInTheDocument()
  })
})
