import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PurchaseReturnScreen } from './PurchaseReturnScreen'
vi.mock('@/shared/motion/MotionPreferencesProvider', () => ({
  useMotionTokens: () => ({ spring: { gentle: { duration: 0 } }, reduced: true }),
}))
const { status } = vi.hoisted(() => ({ status: vi.fn() }))
vi.mock('../hooks/use-premium', () => ({ usePurchaseStatus: status }))
afterEach(() => vi.clearAllMocks())
describe('provider return requires persisted ownership and payment', () => {
  const show = (url: string) =>
    render(
      <MemoryRouter initialEntries={[url]}>
        <PurchaseReturnScreen />
      </MemoryRouter>,
    )
  it('success URL alone cannot confirm payment', () => {
    status.mockReturnValue({ data: 'pending' })
    show('/premium/return?status=success&order=00000000-0000-4000-8000-00000000a901')
    expect(screen.getByText('Confirmando el pago')).toBeInTheDocument()
  })
  it('only persisted paid status confirms purchase', () => {
    status.mockReturnValue({ data: 'paid' })
    show('/premium/return?status=success&order=00000000-0000-4000-8000-00000000a901')
    expect(screen.getByText('¡Pago completado!')).toBeInTheDocument()
  })
  it('invalid order is not sent to the server', () => {
    status.mockReturnValue({})
    show('/premium/return?status=success&order=invalid')
    expect(status).toHaveBeenCalledWith(null)
  })
})
