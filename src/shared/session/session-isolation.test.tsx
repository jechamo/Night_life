import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { expect, test, vi } from 'vitest'
import { AppProviders } from '@/app/AppProviders'
import { createQueryClient } from '@/app/query-client'
import { createMockServices } from '@/mocks/mock-services'
import { createFakePlatform } from '@/platform/testing'
import { myProfileKey, useUpdateProfile } from '@/features/profile/use-my-profile'
import { useSaveEmergencyContacts } from '@/features/safety/hooks/use-safety'
import type { SessionService } from './session-service'

function fixture() {
  let generation = 0
  const listeners = new Set<() => void>()
  const services = createMockServices({ latencyMs: 0 })
  const session: SessionService = {
    getGeneration: () => generation,
    getRoles: services.session.getRoles,
    signOut: services.session.signOut,
    onChange: (callback) => {
      listeners.add(callback)
      return () => listeners.delete(callback)
    },
  }
  services.session = session
  const queryClient = createQueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => (
    <AppProviders
      platform={createFakePlatform()}
      services={services}
      queryClient={queryClient}
      settings={{ themeId: 'mono', reduceMotion: true, language: 'es' }}
    >
      {children}
    </AppProviders>
  )
  return {
    services,
    queryClient,
    wrapper,
    changeIdentity() {
      generation++
      queryClient.clear()
      listeners.forEach((notify) => notify())
    },
  }
}

test('a delayed profile response from A cannot replace B after cache clear and identity change', async () => {
  const view = fixture()
  const previous = await view.services.profile.getMine()
  const next = { ...previous, id: 'account-b', name: 'B' }
  let finish: ((profile: typeof previous) => void) | undefined
  vi.spyOn(view.services.profile, 'update').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const success = vi.fn()
  const hook = renderHook(() => useUpdateProfile(), { wrapper: view.wrapper })
  act(() => hook.result.current.mutate({ bio: 'A' }, { onSuccess: success }))
  await waitFor(() => expect(finish).toBeDefined())
  act(() => {
    view.changeIdentity()
    view.queryClient.setQueryData(myProfileKey, next)
    finish?.(previous)
  })
  await waitFor(() => expect(hook.result.current.isError).toBe(true))
  expect(view.queryClient.getQueryData(myProfileKey)).toEqual(next)
  expect(success).not.toHaveBeenCalled()
})

test('late emergency-contact phone numbers are discarded even with the mutation still mounted', async () => {
  const view = fixture()
  const previous = [{ id: 'a-contact', name: 'A contact', phone: '+34600000001' }]
  let finish: ((contacts: typeof previous) => void) | undefined
  vi.spyOn(view.services.safety, 'saveContacts').mockImplementation(
    () =>
      new Promise((resolve) => {
        finish = resolve
      }),
  )
  const hook = renderHook(() => useSaveEmergencyContacts(), { wrapper: view.wrapper })
  act(() => hook.result.current.mutate(previous))
  await waitFor(() => expect(finish).toBeDefined())
  act(() => {
    view.changeIdentity()
    finish?.(previous)
  })
  await waitFor(() => expect(hook.result.current.isError).toBe(true))
  expect(view.queryClient.getQueryData(['safety', 'contacts'])).toBeUndefined()
})
