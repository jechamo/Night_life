import { describe, expect, it, vi } from 'vitest'
import type { Db } from './client'
import { createChatService, createMatchingService, hydrateMatch, profileSchema } from './social'

const uid = '00000000-0000-4000-8000-00000000b801'
const mid = '00000000-0000-4000-8000-00000000b802'
const profile = {
  id: uid,
  name: 'Test',
  age: 25,
  gender: 'woman',
  bio: '',
  photos: [],
  photoVerified: false,
  trafficLight: 'green',
  anthem: null,
}
const context = {
  sameVenueNow: true,
  sameVenueTonight: false,
  distanceMeters: null,
  venueName: 'Test venue',
  sharedArtist: null,
}
const message = {
  id: uid,
  matchId: mid,
  fromMe: false,
  text: '<script>plain text</script>',
  sentAt: '2026-10-04T00:00:00Z',
  readAt: null,
}
function database(data: unknown, error: unknown = null) {
  const rpc = vi.fn().mockResolvedValue({ data, error })
  const createSignedUrls = vi
    .fn()
    .mockResolvedValue({ data: [{ signedUrl: 'https://example.test/signed' }], error: null })
  return {
    db: { rpc, storage: { from: () => ({ createSignedUrls }) } } as unknown as Db,
    rpc,
    createSignedUrls,
  }
}

describe('Block 8 adapters', () => {
  it('maps the server daily limit and does not decide matches locally', async () => {
    const { db, rpc } = database({ error: 'limit_reached' })
    expect(await createMatchingService(db).like(uid)).toEqual({ ok: false, error: 'limit_reached' })
    expect(rpc).toHaveBeenCalledWith('matching_like', { p_person: uid })
  })
  it('propagates authorization failures instead of pretending success', async () => {
    const { db } = database(null, new Error('forbidden'))
    await expect(createMatchingService(db).like(uid)).rejects.toThrow('forbidden')
    await expect(createMatchingService(db).undo()).rejects.toThrow('forbidden')
    await expect(createChatService(db).send(mid, 'hi')).rejects.toThrow('forbidden')
  })
  it('signs only authorized private photo paths', async () => {
    const { db, createSignedUrls } = database(null)
    const match = await hydrateMatch(db, {
      id: mid,
      person: { ...profile, photos: [`${uid}/photo.webp`] },
      context,
      createdAt: '2026-10-04T00:00:00Z',
    })
    expect(createSignedUrls).toHaveBeenCalledWith([`${uid}/photo.webp`], 300)
    expect(match.person.photos).toEqual(['https://example.test/signed'])
  })
  it('drops private profile fields and rejects invalid public payloads', () => {
    const parsed = profileSchema.parse({
      ...profile,
      birthdate: '2001-01-01',
      interestedIn: ['women'],
    })
    expect(parsed).not.toHaveProperty('birthdate')
    expect(parsed).not.toHaveProperty('interestedIn')
    expect(profileSchema.safeParse({ ...profile, age: 17 }).success).toBe(false)
  })
  it('uses only local avatars for explicit test fixtures', async () => {
    const { db, createSignedUrls } = database({
      id: mid,
      person: { ...profile, testAvatar: 0 },
      context,
      createdAt: '2026-10-04T00:00:00Z',
    })
    const match = await hydrateMatch(db, {
      id: mid,
      person: { ...profile, testAvatar: 0 },
      context,
      createdAt: '2026-10-04T00:00:00Z',
    })
    expect(match.person.photos[0]).toContain('avatar-01')
    expect(createSignedUrls).not.toHaveBeenCalled()
  })
  it('keeps incoming messages plain text and paginates with both cursor fields', async () => {
    const { db, rpc } = database([message])
    const result = await createChatService(db).messages(mid, {
      sentAt: message.sentAt,
      id: message.id,
    })
    expect(result).toEqual([message])
    expect(rpc).toHaveBeenCalledWith('chat_messages', {
      p_match: mid,
      p_before: message.sentAt,
      p_before_id: message.id,
    })
  })
  it('does not substitute sample profiles for a locked likes response', async () => {
    const { db } = database({ count: 3, profiles: [] })
    const service = createMatchingService(db)
    expect(await service.likesYou()).toEqual([])
    expect(await service.likesYouCount?.()).toBe(3)
  })
  it('loads the configurable quota and unlimited entitlement from the server', async () => {
    const { db } = database({ usedToday: 7, limit: 12, unlimited: true })
    expect(await createMatchingService(db).likeStatus?.()).toEqual({
      usedToday: 7,
      limit: 12,
      unlimited: true,
    })
  })
  it('rejects malformed message responses', async () => {
    const { db } = database({ ...message, text: 'x'.repeat(1001) })
    await expect(createChatService(db).send(mid, 'hi')).rejects.toThrow()
  })
})
