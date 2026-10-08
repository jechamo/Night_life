import { describe, expect, it, vi } from 'vitest'
import { createBookingPanel, createBookingPlaces } from './bookings'
import type { Db } from './client'

const dbWith = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as Db
const failing = (message: string) =>
  vi.fn().mockResolvedValue({ data: null, error: { message, code: '22023' } })

describe('roadmap R5: Supabase booking adapters', () => {
  it('maps every reservation refusal', async () => {
    const input = { arriveAt: '2026-10-09T21:30:00Z', party: 4, kind: 'table' as const }
    for (const code of [
      'not_available',
      'own_venue',
      'booking_limit',
      'already_booked',
      'age_required',
    ] as const)
      expect(
        await createBookingPlaces(dbWith(failing(code))).requestReservation('v1', input),
      ).toEqual({ ok: false, error: code })
    expect(
      await createBookingPlaces(dbWith(failing('invalid booking'))).requestReservation('v1', input),
    ).toEqual({ ok: false, error: 'invalid' })
    await expect(
      createBookingPlaces(dbWith(failing('disabled'))).requestReservation('v1', input),
    ).rejects.toThrow('disabled')
  })

  it('sends the request arguments the server expects', async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: 'r1',
        placeId: 'v1',
        placeName: 'Bar',
        arriveAt: '2026-10-09T21:30:00Z',
        party: 4,
        kind: 'bottle',
        status: 'requested',
        reason: null,
      },
      error: null,
    })
    const result = await createBookingPlaces(dbWith(rpc)).requestReservation('v1', {
      arriveAt: '2026-10-09T21:30:00Z',
      party: 4,
      kind: 'bottle',
    })
    expect(result.ok).toBe(true)
    expect(rpc).toHaveBeenCalledWith('reservation_request', {
      p_venue: 'v1',
      p_arrive_at: '2026-10-09T21:30:00Z',
      p_party: 4,
      p_kind: 'bottle',
    })
  })

  it('door: invalid codes are a result, other errors throw', async () => {
    expect(
      await createBookingPanel(dbWith(failing('invalid_code'))).checkInGuest('v1', 'X'),
    ).toEqual({
      ok: false,
      error: 'invalid_code',
    })
    await expect(
      createBookingPanel(dbWith(failing('forbidden'))).checkInGuest('v1', 'X'),
    ).rejects.toThrow('forbidden')
    expect(await createBookingPlaces(dbWith(failing('list_full'))).joinGuestlist('l1')).toEqual({
      ok: false,
      error: 'list_full',
    })
  })
})
