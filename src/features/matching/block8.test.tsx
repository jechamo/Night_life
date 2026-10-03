import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { RealtimeEvent } from '@/shared/realtime/realtime'
import { renderApp } from '@/test/render-app'
import type { Match } from './services/matching-service'
import { rankCandidates } from './model/matching'

const match: Match = {
  id: 'test-match',
  person: {
    id: 'test-person',
    name: 'Realtime tester',
    age: 25,
    gender: 'woman',
    bio: '',
    photos: [],
    photoVerified: false,
    trafficLight: 'green',
    anthem: null,
  },
  context: {
    sameVenueNow: true,
    sameVenueTonight: false,
    distanceMeters: null,
    venueName: 'Test venue',
    sharedArtist: null,
  },
  createdAt: '2026-10-04T00:00:00Z',
}
const verified = {
  age: { state: 'verified', verifiedAt: '2026-10-04T00:00:00Z' },
  photo: { state: 'not_started' },
  identity: { state: 'not_started' },
} as const
function session() {
  let handler: ((event: RealtimeEvent) => void) | undefined
  const view = renderApp('/chats', {
    services: { state: { verification: verified } },
    settings: { reduceMotion: true },
    serviceOverrides: {
      realtime: {
        subscribe: (next) => {
          handler = next
          return () => {
            handler = undefined
          }
        },
      },
    },
  })
  return {
    ...view,
    ready: () => !!handler,
    emit: (event: RealtimeEvent) => {
      handler?.(event)
    },
  }
}

describe('Block 8 realtime UI', () => {
  it('does not skip a candidate after the server refreshes the swipe stack', async () => {
    const view = renderApp('/tonight/swipe/v-aurora', {
      services: { state: { verification: verified } },
      settings: { reduceMotion: true },
    })
    const user = userEvent.setup()
    await screen.findByRole('article', { name: 'Lucía, 26' })
    const candidates = rankCandidates(await view.services.matching.candidates('v-aurora'), false)
    const expected = candidates[1]!.profile.id
    await user.click(screen.getByRole('button', { name: 'Paso' }))
    await act(async () => {
      await view.queryClient.invalidateQueries({ queryKey: ['matching', 'candidates'] })
    })
    const like = vi.spyOn(view.services.matching, 'like')
    await user.click(screen.getByRole('button', { name: 'Me gusta' }))
    await waitFor(() => expect(like).toHaveBeenCalledWith(expected))
  })
  it('keeps the current card when persisting a pass fails', async () => {
    const view = renderApp('/tonight/swipe/v-aurora', {
      services: { state: { verification: verified } },
      settings: { reduceMotion: true },
    })
    const user = userEvent.setup()
    await screen.findByRole('article', { name: 'Lucía, 26' })
    const pass = vi.spyOn(view.services.matching, 'pass').mockRejectedValue(new Error('offline'))
    await user.click(screen.getByRole('button', { name: 'Paso' }))
    await waitFor(() => expect(pass).toHaveBeenCalledOnce())
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se ha podido completar la acción',
    )
    const like = vi.spyOn(view.services.matching, 'like')
    await user.click(screen.getByRole('button', { name: 'Me gusta' }))
    await waitFor(() => expect(like).toHaveBeenCalledWith('p-1'))
  })
  it('shows the same realtime match celebration in both connected sessions', async () => {
    const first = session(),
      second = session()
    await waitFor(() =>
      expect(first.queryClient.getQueryState(['matching', 'matches'])?.status).toBe('success'),
    )
    act(() => {
      first.emit({ type: 'match', match })
      second.emit({ type: 'match', match })
    })
    expect(
      await within(first.container).findByRole('dialog', { name: '¡Match en Test venue!' }),
    ).toBeInTheDocument()
    expect(
      await within(second.container).findByRole('dialog', { name: '¡Match en Test venue!' }),
    ).toBeInTheDocument()
    const user = userEvent.setup()
    await user.click(within(first.container).getByRole('button', { name: 'Seguir mirando' }))
    await waitFor(() =>
      expect(within(first.container).queryByRole('dialog')).not.toBeInTheDocument(),
    )
    act(() => {
      first.emit({ type: 'match', match })
    })
    expect(within(first.container).queryByRole('dialog')).not.toBeInTheDocument()
  })
  it('deduplicates message events and immediately clears a removed chat from cache', async () => {
    const view = session()
    await waitFor(() => expect(view.ready()).toBe(true))
    const message = {
      id: 'message',
      matchId: match.id,
      fromMe: false,
      text: 'Hi',
      sentAt: match.createdAt,
      readAt: null,
    }
    view.queryClient.setQueryData(['chat', 'messages', match.id], [])
    view.queryClient.setQueryData(['matching', 'matches'], [match])
    act(() => {
      view.emit({ type: 'message', message })
      view.emit({ type: 'message', message })
    })
    expect(view.queryClient.getQueryData(['chat', 'messages', match.id])).toEqual([message])
    act(() => {
      view.emit({ type: 'removed', matchId: match.id })
    })
    expect(view.queryClient.getQueryData(['chat', 'messages', match.id])).toBeUndefined()
  })
  it('saves and plays an explicitly simulated Anthem through the platform port', async () => {
    const playTestSample = vi.fn().mockResolvedValue({ ok: true, value: undefined })
    const view = renderApp('/profile', {
      services: { state: { verification: verified } },
      platform: { audio: { playTestSample, stop: vi.fn() } },
    })
    const user = userEvent.setup()
    await user.type(await screen.findByLabelText('Canción de prueba'), 'Test melody')
    await user.type(screen.getByLabelText('Artista de prueba'), 'Test artist')
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    await user.click(
      await screen.findByRole('button', { name: 'Anthem: Test melody de Test artist' }),
    )
    expect(playTestSample).toHaveBeenCalledOnce()
    expect((await view.services.profile.getMine()).anthem?.simulated).toBe(true)
  })
})
