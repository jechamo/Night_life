import { z } from 'zod'
import type { ChatMessage, ChatService } from '@/features/chats/services/chat-service'
import type { Candidate, PublicProfile } from '@/features/matching/model/people'
import type { Match, MatchingService } from '@/features/matching/services/matching-service'
import { err, ok } from '@/shared/lib/result'
import { TEST_AVATARS } from '@/shared/images/catalog'
import type { Db } from './client'
import { must } from './errors'

export const anthemSchema = z.object({
  title: z.string().min(1).max(80),
  artist: z.string().min(1).max(80),
  simulated: z.boolean().optional(),
})
export const profileSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  age: z.number().int().min(18),
  gender: z.enum(['woman', 'man', 'non_binary', 'other']),
  bio: z.string(),
  photos: z.array(z.string()).max(5),
  photoVerified: z.boolean(),
  testAvatar: z.number().int().min(0).max(23).nullable().optional(),
  trafficLight: z.enum(['green', 'yellow', 'red']),
  anthem: anthemSchema.nullable(),
})
const contextSchema = z.object({
  sameVenueNow: z.boolean(),
  sameVenueTonight: z.boolean(),
  distanceMeters: z.number().nonnegative().nullable(),
  venueName: z.string().nullable(),
  sharedArtist: z.string().nullable(),
})
const candidateSchema = z.object({ profile: profileSchema, context: contextSchema })
const matchSchema = z.object({
  contactKind: z.enum(['mutual', 'paid_dm']).optional(),
  id: z.uuid(),
  person: profileSchema,
  context: contextSchema,
  createdAt: z.iso.datetime({ offset: true }),
})
export const messageSchema = z.object({
  id: z.uuid(),
  matchId: z.uuid(),
  fromMe: z.boolean(),
  text: z.string().min(1).max(1000),
  sentAt: z.iso.datetime({ offset: true }),
  readAt: z.iso.datetime({ offset: true }).nullable(),
})
const statusSchema = z.object({
  usedToday: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  unlimited: z.boolean(),
})
const likesSchema = z.object({
  count: z.number().int().nonnegative(),
  profiles: z.array(profileSchema).max(50),
})

/** Private storage stays private; only server-authorized visible profiles can sign photos. */
export async function signSocialProfile(db: Db, profile: PublicProfile): Promise<PublicProfile> {
  if (!profile.photos.length) {
    const parsed = profileSchema.parse(profile)
    const avatar = parsed.testAvatar == null ? null : TEST_AVATARS[parsed.testAvatar]
    return { ...profile, photos: avatar ? [avatar.src] : [] }
  }
  const photos = must(
    await db.storage.from('profile-photos').createSignedUrls([...profile.photos], 300),
  )
  return { ...profile, photos: photos.flatMap((p) => (p.signedUrl ? [p.signedUrl] : [])) }
}
export async function hydrateMatch(db: Db, raw: unknown): Promise<Match> {
  const match = matchSchema.parse(raw)
  return { ...match, person: await signSocialProfile(db, match.person) }
}
async function hydrateCandidate(db: Db, candidate: Candidate): Promise<Candidate> {
  return { ...candidate, profile: await signSocialProfile(db, candidate.profile) }
}

export function createMatchingService(db: Db): MatchingService {
  const likeStatus = async () => statusSchema.parse(must(await db.rpc('matching_status')))
  return {
    async candidates(placeId) {
      const list = z
        .array(candidateSchema)
        .max(50)
        .parse(must(await db.rpc('matching_candidates', { p_place: placeId ?? undefined })))
      return Promise.all(list.map((c) => hydrateCandidate(db, c)))
    },
    async like(personId) {
      const raw = must(await db.rpc('matching_like', { p_person: personId }))
      if (z.object({ error: z.literal('limit_reached') }).safeParse(raw).success)
        return err('limit_reached')
      const result = z
        .object({ usedToday: z.number().int().nonnegative(), match: matchSchema.nullable() })
        .parse(raw)
      return ok({
        usedToday: result.usedToday,
        match: result.match ? await hydrateMatch(db, result.match) : null,
      })
    },
    async pass(personId) {
      const { error } = await db.rpc('matching_pass', { p_person: personId })
      if (error) throw error
    },
    async undo() {
      const { data, error } = await db.rpc('matching_undo')
      if (error) throw error
      return data === null
        ? err('nothing_to_undo')
        : ok(await hydrateCandidate(db, candidateSchema.parse(data)))
    },
    likeStatus,
    likesUsedToday: async () => (await likeStatus()).usedToday,
    async likesYou() {
      const result = likesSchema.parse(must(await db.rpc('matching_likes_you')))
      return Promise.all(result.profiles.map((p) => signSocialProfile(db, p)))
    },
    async likesYouCount() {
      return likesSchema.parse(must(await db.rpc('matching_likes_you'))).count
    },
    async matches() {
      return Promise.all(
        z
          .array(matchSchema)
          .max(100)
          .parse(must(await db.rpc('matching_matches')))
          .map((m) => hydrateMatch(db, m)),
      )
    },
    async person(personId) {
      const { data, error } = await db.rpc('matching_person', { p_person: personId })
      if (error) throw error
      return data === null ? null : signSocialProfile(db, profileSchema.parse(data))
    },
    async unmatch(matchId) {
      const { error } = await db.rpc('matching_unmatch', { p_match: matchId })
      if (error) throw error
    },
    async block(personId) {
      const { error } = await db.rpc('matching_block', { p_person: personId })
      if (error) throw error
    },
    async report(personId, reason, comment) {
      const { error } = await db.rpc('matching_report', {
        p_person: personId,
        p_reason: reason,
        p_comment: comment,
      })
      if (error) throw error
    },
  }
}

export function createChatService(db: Db): ChatService {
  return {
    async summaries() {
      return z
        .array(
          z.object({
            matchId: z.uuid(),
            last: messageSchema.nullable(),
            unread: z.number().int().nonnegative(),
          }),
        )
        .max(100)
        .parse(must(await db.rpc('chat_summaries')))
    },
    async messages(matchId, before) {
      return z
        .array(messageSchema)
        .max(100)
        .parse(
          must(
            await db.rpc('chat_messages', {
              p_match: matchId,
              p_before: before?.sentAt,
              p_before_id: before?.id,
            }),
          ),
        )
    },
    async send(matchId, text): Promise<ChatMessage> {
      return messageSchema.parse(
        must(await db.rpc('chat_send', { p_match: matchId, p_text: text })),
      )
    },
    async markRead(matchId) {
      const { error } = await db.rpc('chat_read', { p_match: matchId })
      if (error) throw error
    },
    setTyping(matchId, typing) {
      void db.rpc('chat_typing', { p_match: matchId, p_typing: typing }).then(
        () => {},
        () => {},
      )
    },
  }
}
