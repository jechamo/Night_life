import { describe, expect, it, vi } from 'vitest'
import { createMockServices } from '@/mocks/mock-services'
import { createAdminService } from './admin'
import { createVenuePanelService } from './business'
import type { Db } from './client'

const dbWith = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as Db
const failing = (message: string) =>
  vi.fn().mockResolvedValue({ data: null, error: { message, code: '22023' } })

describe('roadmap R3: Supabase partner adapters', () => {
  it('redeems with a normalised code and maps every server refusal', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { placeId: 'v1', role: 'owner' }, error: null })
    const panel = createVenuePanelService(dbWith(rpc))
    expect(await panel.redeemInvite('abcd 1234 ef09', true)).toEqual({
      ok: true,
      value: { placeId: 'v1', role: 'owner' },
    })
    expect(rpc).toHaveBeenCalledWith('venue_invite_redeem', {
      p_code: 'ABCD-1234-EF09',
      p_accept_terms: true,
    })
    for (const code of ['invalid_code', 'already_manager', 'terms_required'] as const)
      expect(
        await createVenuePanelService(dbWith(failing(code))).redeemInvite('ABCD-1234-EF09', true),
      ).toEqual({ ok: false, error: code })
    await expect(
      createVenuePanelService(dbWith(failing('disabled'))).redeemInvite('ABCD-1234-EF09', true),
    ).rejects.toThrow('disabled')
  })

  it('claims map the terms refusal and keep the old already-claimed answer', async () => {
    expect(
      await createVenuePanelService(dbWith(failing('terms_required'))).claim('v1', 'x'.repeat(12)),
    ).toEqual({ ok: false, error: 'terms_required' })
    const rpc = vi.fn().mockResolvedValue({ data: { error: 'already_claimed' }, error: null })
    expect(await createVenuePanelService(dbWith(rpc)).claim('v1', 'x'.repeat(12))).toEqual({
      ok: false,
      error: 'already_claimed',
    })
  })

  it('team limits, void RPCs and partner state', async () => {
    expect(await createVenuePanelService(dbWith(failing('team_limit'))).inviteStaff('v1')).toEqual({
      ok: false,
      error: 'team_limit',
    })
    const rpc = vi.fn().mockResolvedValue({ data: null, error: null })
    await createVenuePanelService(dbWith(rpc)).removeManager('v1', 'u2')
    expect(rpc).toHaveBeenCalledWith('venue_remove_manager', { p_venue: 'v1', p_user: 'u2' })
    await expect(
      createVenuePanelService(dbWith(failing('forbidden'))).removeManager('v1', 'u2'),
    ).rejects.toThrow('forbidden')
  })

  it('admin partner actions map duplicates and invalid data', async () => {
    const base = createMockServices().admin
    const admin = (rpc: ReturnType<typeof vi.fn>) => createAdminService(dbWith(rpc), base)
    const input = {
      legalName: 'Noches SL',
      taxId: 'B12345678',
      contactName: 'Marta',
      billingEmail: 'a@b.es',
      contactPhone: '',
      notes: '',
      isTest: true,
    }
    expect(await admin(failing('duplicate_tax_id')).savePartner(input)).toEqual({
      ok: false,
      error: 'duplicate_tax_id',
    })
    expect(await admin(failing('invalid partner')).savePartner(input)).toEqual({
      ok: false,
      error: 'invalid',
    })
    expect(await admin(failing('already_sponsored')).contractAction('c1', 'activate')).toEqual({
      ok: false,
      error: 'already_sponsored',
    })
    expect(await admin(failing('invalid state')).contractAction('c1', 'end')).toEqual({
      ok: false,
      error: 'invalid_state',
    })
    expect(await admin(failing('linked_elsewhere')).linkPartnerVenue('a', 'v', true)).toEqual({
      ok: false,
      error: 'linked_elsewhere',
    })
    const ok = vi.fn().mockResolvedValue({ data: 'acc-1', error: null })
    expect(await admin(ok).savePartner(input)).toEqual({ ok: true, value: 'acc-1' })
    expect(ok).toHaveBeenCalledWith('admin_partner_save', { p: input })
  })
})
