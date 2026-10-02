import type { AttendanceState } from '@/features/attendance/services/attendance-service'
import type { ChatMessage } from '@/features/chats/services/chat-service'
import { distanceMeters } from '@/features/places/model/geo'
import type { MatchingProfile, Candidate } from '@/features/matching/model/people'
import type { Match } from '@/features/matching/services/matching-service'
import type { LostFoundPost } from '@/features/places/services/places-service'
import type { Place, Vibe } from '@/features/places/model/types'
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
  passed: string[]
  blocked: Set<string>
  likesUsed: number
  matches: Match[]
  messages: ChatMessage[]
  myVibes: Map<string, Vibe>
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
    passed: [],
    blocked: new Set(),
    likesUsed: 0,
    matches: [],
    messages: [],
    myVibes: new Map(),
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
