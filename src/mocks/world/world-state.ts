import type { AttendanceState } from '@/features/attendance/services/attendance-service'
import type { ChatMessage } from '@/features/chats/services/chat-service'
import { distanceMeters } from '@/features/places/model/geo'
import type { MatchingProfile, Candidate } from '@/features/matching/model/people'
import type { Match } from '@/features/matching/services/matching-service'
import type { LostFoundPost } from '@/features/places/services/places-service'
import type { Place, Vibe } from '@/features/places/model/types'
import {
  LIVE_QUESTION_KEYS,
  type LiveQuestion,
  type LiveStatus,
  type MusicGenre,
} from '@/features/places/model/live-status'
import type { RealtimeEvent } from '@/shared/realtime/realtime'
import { createMockMe, createMockPeople, type MockPerson } from './people.mock'
import { createMockPlaces, MOCK_CENTER } from './places.mock'

/** In-memory simulated backend for Blocks 3-4 (nothing personal is persisted). */
export interface WorldState {
  places: Place[]
  people: MockPerson[]
  me: MatchingProfile
  attendance: AttendanceState
  checkInsByPlace: Map<string, number>
  liked: Set<string>
  likesSeen: Set<string>
  likesSnapshots: Map<string, string[]>
  passed: string[]
  blocked: Set<string>
  likesUsed: number
  matches: Match[]
  messages: ChatMessage[]
  myVibes: Map<string, Vibe>
  /** Roadmap R2: other people's answers (seed) and mine, per place. */
  liveVotes: Map<string, Partial<Record<LiveQuestion, Record<string, number>>>>
  myLive: Map<string, Partial<Record<LiveQuestion, string>>>
  declaredMusic: Map<string, { genres: MusicGenre[]; lineup: string | null }>
  usuallyCrowd: Map<string, LiveStatus['usually']>
  /** Venues the simulated user manages (cannot vote on them). */
  managedVenueIds: Set<string>
  confirmedByMe: Set<string>
  eventsCreatedToday: number
  lostFound: LostFoundPost[]
  listeners: Set<(event: RealtimeEvent) => void>
}

const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString()

export function createWorldState(): WorldState {
  const places = createMockPlaces()
  const people = createMockPeople()
  const me = createMockMe()
  const state: WorldState = {
    places,
    people,
    me,
    attendance: { checkIn: null, going: null, lastCheckInAt: null },
    checkInsByPlace: new Map(),
    liked: new Set(),
    likesSeen: new Set(),
    likesSnapshots: new Map(),
    passed: [],
    blocked: new Set(),
    likesUsed: 0,
    matches: [],
    messages: [],
    myVibes: new Map(),
    liveVotes: new Map<string, Partial<Record<LiveQuestion, Record<string, number>>>>([
      [
        'v-aurora',
        {
          crowd: { busy: 4, packed: 6 },
          queue: { short: 5, long: 2 },
          music_like: { yes: 7, no: 1 },
          music_genre: { reggaeton: 5, commercial: 3 },
        },
      ],
      ['v-cobalto', { crowd: { normal: 2 } }],
    ]),
    myLive: new Map(),
    declaredMusic: new Map<string, { genres: MusicGenre[]; lineup: string | null }>([
      ['v-aurora', { genres: ['reggaeton', 'commercial'], lineup: null }],
      ['v-cobalto', { genres: ['indie'], lineup: null }],
    ]),
    usuallyCrowd: new Map<string, LiveStatus['usually']>([['v-aurora', 'packed']]),
    managedVenueIds: new Set(['v-cobalto']),
    confirmedByMe: new Set(),
    eventsCreatedToday: 0,
    lostFound: [
      {
        id: 'lf-1',
        placeId: 'v-aurora',
        mine: false,
        text: 'Se me ha caído una pulsera plateada cerca de la barra del fondo. ¡Gracias!',
        createdAt: minutesAgo(90),
        replies: [
          {
            id: 'lf-1-r1',
            mine: false,
            text: 'La tienen en el guardarropa 🙌',
            createdAt: minutesAgo(40),
          },
        ],
      },
    ],
    listeners: new Set(),
  }
  // Two existing matches with some history so Chats is not empty.
  for (const [personId, minutes] of [
    ['p-2', 600],
    ['p-13', 1500],
  ] as const) {
    const person = people.find((p) => p.id === personId)
    if (!person) continue
    const match: Match = {
      id: `m-${personId}`,
      person,
      context: contextFor(state, person),
      createdAt: minutesAgo(minutes),
    }
    state.matches.push(match)
  }
  state.messages.push(
    {
      id: 'msg-1',
      matchId: 'm-p-2',
      fromMe: false,
      text: '¡Hola! ¿Al final vas a la Aurora?',
      sentAt: minutesAgo(50),
      readAt: minutesAgo(45),
    },
    {
      id: 'msg-2',
      matchId: 'm-p-2',
      fromMe: true,
      text: '¡Sí! Llego sobre la una 🕺',
      sentAt: minutesAgo(44),
      readAt: minutesAgo(40),
    },
    {
      id: 'msg-3',
      matchId: 'm-p-2',
      fromMe: false,
      text: 'Genial, te busco en la barra del fondo',
      sentAt: minutesAgo(12),
      readAt: null,
    },
    {
      id: 'msg-4',
      matchId: 'm-p-13',
      fromMe: false,
      text: 'Me encantó tu Anthem 😄',
      sentAt: minutesAgo(1400),
      readAt: minutesAgo(1390),
    },
  )
  return state
}

export const placeById = (state: WorldState, id: string | null | undefined) =>
  id ? state.places.find((p) => p.id === id) : undefined

/** Where "I" am for distance purposes: current check-in, tonight's plan or the map centre. */
export function myReference(state: WorldState) {
  return (
    placeById(state, state.attendance.checkIn?.placeId ?? state.attendance.going?.placeId)
      ?.location ?? MOCK_CENTER
  )
}

export function contextFor(state: WorldState, person: MockPerson): Candidate['context'] {
  const now = state.attendance.checkIn?.placeId ?? null
  const tonight = state.attendance.going?.placeId ?? now
  const sameVenueNow = now !== null && person.placeNow === now
  const sameVenueTonight =
    !sameVenueNow &&
    tonight !== null &&
    (person.placeTonight === tonight || person.placeNow === tonight)
  const theirPlace = placeById(state, person.placeNow ?? person.placeTonight)
  const venue = sameVenueNow
    ? placeById(state, now)
    : sameVenueTonight
      ? placeById(state, tonight)
      : undefined
  const artist = person.anthem?.artist
  return {
    sameVenueNow,
    sameVenueTonight,
    distanceMeters: theirPlace
      ? Math.round(distanceMeters(myReference(state), theirPlace.location))
      : null,
    venueName: venue?.name ?? null,
    sharedArtist: artist && artist === state.me.anthem?.artist ? artist : null,
  }
}

export function emit(state: WorldState, event: RealtimeEvent) {
  state.listeners.forEach((listener) => listener(event))
}

/** Same rules as `private.place_live_status`: aggregates only, shown from 3 answers. */
export function liveStatusOf(state: WorldState, placeId: string): LiveStatus {
  const seed = state.liveVotes.get(placeId) ?? {}
  const mine = state.myLive.get(placeId) ?? {}
  const tallies = {} as LiveStatus['tallies']
  for (const question of LIVE_QUESTION_KEYS) {
    const counts: Record<string, number> = { ...(seed[question] ?? {}) }
    const answer = mine[question]
    if (answer) counts[answer] = (counts[answer] ?? 0) + 1
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0)
    tallies[question] = { total, counts: total >= 3 ? counts : null }
  }
  const isVenue = !placeById(state, placeId)?.event
  return {
    windowMinutes: 90,
    minVotes: 3,
    tallies,
    mine: { ...mine },
    declared: isVenue ? (state.declaredMusic.get(placeId) ?? { genres: [], lineup: null }) : null,
    usually: state.usuallyCrowd.get(placeId) ?? null,
  }
}
