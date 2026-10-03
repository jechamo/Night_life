import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { AdminSectionScreen } from './screens/AdminSectionScreen'

const state = vi.hoisted(() => ({ loadError: false, refetch: vi.fn() }))
vi.mock('@/shared/ui/badge', () => ({
  Badge: ({ children }: { children: ReactNode }) => <span>{children}</span>,
}))
vi.mock('./hooks/use-admin', () => ({
  useAdminList: () => ({
    data: state.loadError
      ? []
      : [
          {
            id: 'test',
            title: 'Test',
            subtitle: 'age',
            status: 'pending',
            createdAt: '2026-10-03',
            facts: [],
          },
        ],
    isPending: false,
    isError: state.loadError,
    refetch: state.refetch,
  }),
  useAdminAct: () => ({ isPending: false, isError: true, mutate: vi.fn() }),
}))
beforeEach(() => {
  state.loadError = false
  state.refetch.mockClear()
})
const open = () =>
  render(
    <MemoryRouter initialEntries={['/admin/s/verifications']}>
      <Routes>
        <Route path="/admin/s/:section" element={<AdminSectionScreen />} />
      </Routes>
    </MemoryRouter>,
  )

test('a rejected review action shows an error and preserves the pending row', () => {
  open()
  expect(screen.getByRole('alert')).toHaveTextContent('no puedes aprobar tu propia verificación')
  expect(screen.getByText('Pendiente')).toBeInTheDocument()
})

test('a failed queue fetch offers retry instead of claiming nothing is pending', async () => {
  state.loadError = true
  open()
  expect(screen.getByRole('alert')).toHaveTextContent('No se pudo cargar la lista')
  expect(screen.queryByText('Nada pendiente')).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
  expect(state.refetch).toHaveBeenCalledOnce()
})
