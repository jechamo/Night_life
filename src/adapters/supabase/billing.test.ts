import { describe, it, expect, vi } from 'vitest'
import { createPremiumService } from './billing'
import type { Db } from './client'
describe('real billing adapter boundaries', () => {
  it('rejects an unexpected checkout host', async () => {
    const db = {
      functions: {
        invoke: vi
          .fn()
          .mockResolvedValue({ data: { url: 'https://evil.example/checkout' }, error: null }),
      },
    } as unknown as Db
    expect(
      await createPremiumService(db).startPurchase('vip_monthly', { immediateStart: true }),
    ).toEqual({
      ok: false,
      error: 'gateway_error',
    })
  })
  it('preserves the server order status without granting benefits', async () => {
    const single = vi.fn().mockResolvedValue({ data: { status: 'pending' }, error: null })
    const chain = { select: vi.fn(), eq: vi.fn(), maybeSingle: single }
    chain.select.mockReturnValue(chain)
    chain.eq.mockReturnValue(chain)
    const db = { from: vi.fn().mockReturnValue(chain) } as unknown as Db
    expect(await createPremiumService(db).purchaseStatus('owned-order')).toBe('pending')
    expect(chain.eq).toHaveBeenCalledWith('id', 'owned-order')
  })
  it('does not fall back to a mock when a billing read fails', async () => {
    const db = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'unavailable' } }),
    } as unknown as Db
    await expect(createPremiumService(db).getState()).rejects.toThrow()
  })
  it('handles a closed withdrawal window returned with HTTP 409', async () => {
    const db = {
      functions: {
        invoke: vi.fn().mockResolvedValue({
          data: null,
          error: {
            context: new Response(JSON.stringify({ error: 'window_closed' }), { status: 409 }),
          },
        }),
      },
    } as unknown as Db
    expect(await createPremiumService(db).withdraw()).toEqual({ ok: false, error: 'window_closed' })
  })
})
