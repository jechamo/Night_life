import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, test, vi } from 'vitest'
import { createMockServices } from '@/mocks/mock-services'
import type { RealtimeEvent } from '@/shared/realtime/realtime'
import { renderApp } from '@/test/render-app'

function fixture(initialCount = 1) {
  let count = initialCount
  let notify: ((event: RealtimeEvent) => void) | undefined
  const matching = {
    ...createMockServices({ latencyMs: 0, realtime: false }).matching,
    likesYou: vi.fn().mockResolvedValue([]),
    likesYouCount: vi.fn(() => Promise.resolve(count)),
  }
  const view = renderApp('/tonight', {
    services: {
      entitlements: [],
      state: {
        verification: {
          age: { state: 'verified', verifiedAt: '2026-10-04T00:00:00Z' },
          photo: { state: 'not_started' },
          identity: { state: 'not_started' },
        },
      },
    },
    settings: { reduceMotion: true },
    serviceOverrides: {
      matching,
      realtime: {
        subscribe(handler) {
          notify = handler
          return () => {
            notify = undefined
          }
        },
      },
    },
  })
  return {
    ...view,
    matching,
    setCount(next: number) {
      count = next
      notify?.({ type: 'refresh' })
    },
  }
}

test('the heart counts an incoming like even when Premium hides its profile', async () => {
  const view = fixture()
  const heart = await screen.findByRole('link', { name: 'Quién te ha dado like' })
  await waitFor(() => expect(heart).toHaveTextContent('1'))
  expect(view.matching.likesYou).not.toHaveBeenCalled()
  await userEvent.setup().click(heart)
  expect(await screen.findByLabelText('Perfil oculto')).toBeInTheDocument()
  expect(screen.getByText('1 persona')).toBeInTheDocument()
})

test('a realtime refresh updates the heart without exposing locked profiles', async () => {
  const view = fixture(0)
  const heart = await screen.findByRole('link', { name: 'Quién te ha dado like' })
  await waitFor(() => expect(view.matching.likesYouCount).toHaveBeenCalled())
  expect(heart).toHaveTextContent('0')
  act(() => view.setCount(1))
  await waitFor(() => expect(heart).toHaveTextContent('1'))
  expect(view.matching.likesYou).not.toHaveBeenCalled()
})
