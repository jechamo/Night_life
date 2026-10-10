import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, expect, test, vi } from 'vitest'
import { AdminDashboardScreen } from './screens/AdminDashboardScreen'

const state = vi.hoisted((): { mode: 'live' | 'mock' } => ({ mode: 'live' }))
vi.mock('@/shared/services/ServicesProvider', () => ({
  useServices: () => ({ admin: { mode: state.mode } }),
}))
vi.mock('./hooks/use-admin', () => ({ useAdminDashboard: () => ({ data: undefined }) }))
beforeEach(() => {
  state.mode = 'live'
})
const open = () =>
  render(
    <MemoryRouter>
      <AdminDashboardScreen />
    </MemoryRouter>,
  )

test('with the real backend the dashboard does not call its figures simulated', () => {
  open()
  expect(screen.getByText('Datos reales del proyecto.')).toBeInTheDocument()
  expect(screen.queryByText('Datos simulados del entorno de pruebas.')).not.toBeInTheDocument()
})

test('with the simulated backend the dashboard says so', () => {
  state.mode = 'mock'
  open()
  expect(screen.getByText('Datos simulados del entorno de pruebas.')).toBeInTheDocument()
})
