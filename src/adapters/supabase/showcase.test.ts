import { describe, expect, it, vi } from 'vitest'
import type { Db } from './client'
import { createShowcaseAdmin, createShowcasePanel, createShowcasePlaces } from './showcase'

const VENUE = '11111111-1111-4111-8111-111111111111'

function database(rpcResult: (name: string) => { data: unknown; error: unknown }) {
  const rpc = vi.fn((name: string) => Promise.resolve(rpcResult(name)))
  const createSignedUrls = vi.fn((paths: string[], seconds: number) =>
    Promise.resolve({
      data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}?ttl=${seconds}` })),
      error: null,
    }),
  )
  const upload = vi.fn(() => Promise.resolve({ data: {}, error: null as unknown }))
  const remove = vi.fn(() => Promise.resolve({ data: [], error: null }))
  const from = vi.fn(() => ({ createSignedUrls, upload, remove }))
  return {
    db: { rpc, storage: { from } } as unknown as Db,
    rpc,
    from,
    upload,
    remove,
    createSignedUrls,
  }
}

const managed = {
  limit: 3,
  plan: false,
  photos: [
    {
      id: 'p1',
      path: `${VENUE}/a.webp`,
      status: 'approved',
      reason: null,
      isCover: true,
      createdAt: '2026-10-08T20:00:00Z',
      visible: true,
    },
  ],
}

describe('roadmap R4: Supabase showcase adapters', () => {
  it('signs only the private paths the server returns, for 15 minutes', async () => {
    const { db, from, createSignedUrls } = database(() => ({
      data: {
        photos: [{ id: 'p1', path: `${VENUE}/a.webp` }],
        details: {
          dressCode: 'smart',
          minAge: 21,
          entryPriceCents: 0,
          drinkPriceCents: 900,
          terrace: true,
          accessible: null,
        },
        notices: [
          { kind: 'door', value: 'long_queue', until: '2026-10-08T23:00:00Z' },
          { kind: 'happy_hour', value: null, until: '2026-10-08T23:30:00Z' },
          { kind: 'unknown', value: null, until: 'x' },
        ],
      },
      error: null,
    }))
    const showcase = await createShowcasePlaces(db).showcase(VENUE)
    expect(from).toHaveBeenCalledWith('venue-photos')
    expect(createSignedUrls).toHaveBeenCalledWith([`${VENUE}/a.webp`], 900)
    expect(showcase.photos).toEqual([{ id: 'p1', url: `https://signed/${VENUE}/a.webp?ttl=900` }])
    expect(showcase.details?.dressCode).toBe('smart')
    // Unknown notice kinds are dropped instead of breaking the page.
    expect(showcase.notices.map((n) => n.kind)).toEqual(['door', 'happy_hour'])
  })

  it('covers without any approved photo make no storage call', async () => {
    const { db, createSignedUrls } = database(() => ({ data: [], error: null }))
    expect(await createShowcasePlaces(db).covers()).toEqual({})
    expect(createSignedUrls).not.toHaveBeenCalled()
  })

  it('uploads into the venue folder and registers the photo as pending', async () => {
    const { db, rpc, upload } = database(() => ({ data: managed, error: null }))
    const blob = new Blob(['x'], { type: 'image/webp' })
    const result = await createShowcasePanel(db).uploadPhoto(VENUE, blob)
    expect(result.ok).toBe(true)
    const [path] = upload.mock.calls[0] as unknown as [string]
    expect(path).toMatch(new RegExp(`^${VENUE}/[0-9a-f-]{36}\\.webp$`))
    expect(rpc).toHaveBeenCalledWith('venue_photo_add', { p_venue: VENUE, p_path: path })
  })

  it('a refused registration removes the uploaded object and maps the limit', async () => {
    const { db, remove } = database((name) =>
      name === 'venue_photo_add'
        ? { data: null, error: { message: 'photo_limit', code: '54000' } }
        : { data: managed, error: null },
    )
    const result = await createShowcasePanel(db).uploadPhoto(VENUE, new Blob(['x']))
    expect(result).toEqual({ ok: false, error: 'photo_limit' })
    expect(remove).toHaveBeenCalledTimes(1)
  })

  it('a Storage policy refusal is the limit; other upload errors throw', async () => {
    const refused = database(() => ({ data: managed, error: null }))
    refused.upload.mockResolvedValueOnce({
      data: {},
      error: { message: 'new row violates row-level security policy' },
    })
    expect(await createShowcasePanel(refused.db).uploadPhoto(VENUE, new Blob(['x']))).toEqual({
      ok: false,
      error: 'photo_limit',
    })
    const broken = database(() => ({ data: managed, error: null }))
    broken.upload.mockResolvedValueOnce({ data: {}, error: new Error('network down') })
    await expect(
      createShowcasePanel(broken.db).uploadPhoto(VENUE, new Blob(['x'])),
    ).rejects.toThrow('network down')
  })

  it('deletes the row first, then the object', async () => {
    const order: string[] = []
    const { db, remove } = database((name) => {
      order.push(name)
      return name === 'venue_photo_remove'
        ? { data: `${VENUE}/a.webp`, error: null }
        : { data: managed, error: null }
    })
    remove.mockImplementation(() => {
      order.push('storage.remove')
      return Promise.resolve({ data: [], error: null })
    })
    await createShowcasePanel(db).removePhoto(VENUE, 'p1')
    expect(order.slice(0, 2)).toEqual(['venue_photo_remove', 'storage.remove'])
  })

  it('notices send the right arguments; admin review passes the reason', async () => {
    const { db, rpc } = database(() => ({ data: [], error: null }))
    await createShowcasePanel(db).setNotice(VENUE, { kind: 'door', value: 'full' })
    expect(rpc).toHaveBeenCalledWith('venue_notice_set', {
      p_venue: VENUE,
      p_kind: 'door',
      p_value: 'full',
      p_until: null,
    })
    await createShowcaseAdmin(db).reviewVenuePhoto('p1', false, 'Sale una persona')
    expect(rpc).toHaveBeenCalledWith('admin_venue_photo_review', {
      p_photo: 'p1',
      p_approve: false,
      p_reason: 'Sale una persona',
    })
  })
})
