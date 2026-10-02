import type { ChatService } from '@/features/chats/services/chat-service'
import { isMutuallyCompatible, FREE_DAILY_LIKES } from '@/features/matching/model/matching'
import type { Candidate } from '@/features/matching/model/people'
import type { Match, MatchingService } from '@/features/matching/services/matching-service'
import type { ProfileService } from '@/features/profile/services/profile-service'
import { err, ok } from '@/shared/lib/result'
import { contextFor, emit, type WorldState } from './world-state'

type Wait = () => Promise<void>

const REPLIES = [
  '¡Jaja, me encanta! 😄',
  '¿Te pillo en la barra?',
  'Ahora mismo suena un temazo',
  '¿Qué tal la noche por ahí?',
  'Vale, ¡nos vemos en un rato!',
]

export function createMockMatchingService(
  state: WorldState,
  wait: Wait,
  options: { unlimitedLikes: () => boolean; realtime: boolean },
): MatchingService {
  const available = (excludePassed = true) =>
    state.people.filter(
      (p) =>
        isMutuallyCompatible(state.me, p, state.blocked) &&
        !state.liked.has(p.id) &&
        !(excludePassed && state.passed.includes(p.id)) &&
        !state.matches.some((m) => m.person.id === p.id),
    )

  const createMatch = (personId: string): Match | null => {
    const person = state.people.find((p) => p.id === personId)
    if (!person) return null
    const match: Match = {
      id: `m-${person.id}`,
      person,
      context: contextFor(state, person),
      createdAt: new Date().toISOString(),
    }
    state.matches.unshift(match)
    return match
  }

  return {
    async candidates(placeId) {
      await wait()
      return available()
        .filter((p) => !placeId || p.placeNow === placeId || p.placeTonight === placeId)
        .map((profile): Candidate => ({ profile, context: contextFor(state, profile) }))
    },
    async like(personId) {
      await wait()
      if (!options.unlimitedLikes() && state.likesUsed >= FREE_DAILY_LIKES)
        return err('limit_reached')
      state.liked.add(personId)
      state.likesUsed += 1
      const person = state.people.find((p) => p.id === personId)
      if (person?.likesMe) return ok({ match: createMatch(personId), usedToday: state.likesUsed })
      // Sometimes they like back a bit later: the match arrives in real time to both.
      if (options.realtime && Math.random() < 0.35) {
        setTimeout(
          () => {
            if (state.blocked.has(personId)) return
            const match = createMatch(personId)
            if (match) emit(state, { type: 'match', match })
          },
          4000 + Math.random() * 4000,
        )
      }
      return ok({ match: null, usedToday: state.likesUsed })
    },
    async pass(personId) {
      await wait()
      state.passed.push(personId)
    },
    async undo() {
      await wait()
      const last = state.passed.pop()
      const person = state.people.find((p) => p.id === last)
      return person
        ? ok({ profile: person, context: contextFor(state, person) })
        : err('nothing_to_undo')
    },
    likesUsedToday: () => Promise.resolve(state.likesUsed),
    async likesYou() {
      await wait()
      return state.people.filter(
        (p) =>
          p.likesMe && !state.blocked.has(p.id) && !state.matches.some((m) => m.person.id === p.id),
      )
    },
    async matches() {
      await wait()
      return [...state.matches]
    },
    person: (personId) => Promise.resolve(state.people.find((p) => p.id === personId) ?? null),
    async unmatch(matchId) {
      await wait()
      state.matches = state.matches.filter((m) => m.id !== matchId)
      state.messages = state.messages.filter((m) => m.matchId !== matchId)
    },
    async block(personId) {
      await wait()
      // Blocking is mutual and instant: hides the person and removes the match both ways.
      state.blocked.add(personId)
      const match = state.matches.find((m) => m.person.id === personId)
      if (match) {
        state.matches = state.matches.filter((m) => m.id !== match.id)
        state.messages = state.messages.filter((m) => m.matchId !== match.id)
      }
    },
    async report() {
      await wait()
    },
  }
}

export function createMockChatService(
  state: WorldState,
  wait: Wait,
  options: { realtime: boolean },
): ChatService {
  const forMatch = (matchId: string) => state.messages.filter((m) => m.matchId === matchId)
  return {
    async summaries() {
      await wait()
      return state.matches.map((match) => {
        const list = forMatch(match.id)
        return {
          matchId: match.id,
          last: list.at(-1) ?? null,
          unread: list.filter((m) => !m.fromMe && !m.readAt).length,
        }
      })
    },
    async messages(matchId) {
      await wait()
      return forMatch(matchId)
    },
    async send(matchId, text) {
      await wait()
      const message = {
        id: crypto.randomUUID(),
        matchId,
        fromMe: true,
        text,
        sentAt: new Date().toISOString(),
        readAt: null,
      }
      state.messages.push(message)
      if (options.realtime) {
        setTimeout(() => {
          state.messages.forEach((m) => {
            if (m.matchId === matchId && m.fromMe && !m.readAt) m.readAt = new Date().toISOString()
          })
          emit(state, { type: 'read', matchId })
          emit(state, { type: 'typing', matchId, typing: true })
        }, 900)
        setTimeout(() => {
          emit(state, { type: 'typing', matchId, typing: false })
          if (!state.matches.some((m) => m.id === matchId)) return
          const reply = {
            id: crypto.randomUUID(),
            matchId,
            fromMe: false,
            text: REPLIES[Math.floor(Math.random() * REPLIES.length)] ?? REPLIES[0]!,
            sentAt: new Date().toISOString(),
            readAt: null,
          }
          state.messages.push(reply)
          emit(state, { type: 'message', message: reply })
        }, 3200)
      }
      return message
    },
    async markRead(matchId) {
      await wait()
      const now = new Date().toISOString()
      state.messages.forEach((m) => {
        if (m.matchId === matchId && !m.fromMe && !m.readAt) m.readAt = now
      })
    },
    setTyping: () => undefined,
  }
}

export function createMockProfileService(state: WorldState, wait: Wait): ProfileService {
  return {
    getMine: () => Promise.resolve(state.me),
    async update(patch) {
      await wait()
      state.me = { ...state.me, ...patch }
      return state.me
    },
  }
}
