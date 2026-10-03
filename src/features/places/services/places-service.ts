import type { Result } from '@/shared/lib/result'
import type { LatLng, Place, Vibe } from '../model/types'

export interface LostFoundReply {
  id: string
  mine: boolean
  text: string
  createdAt: string
}

/** Lost & found posts: 280 chars, 48 h, only after a check-in in the last 12 h (PRD 6.8). */
export interface LostFoundPost {
  id: string
  placeId: string
  mine: boolean
  text: string
  createdAt: string
  replies: readonly LostFoundReply[]
}

export type EventReportReason = 'fake' | 'dangerous' | 'inappropriate'
export type EventCategory = 'party' | 'concert' | 'meetup' | 'other'

export interface CreateEventInput {
  title: string
  category: EventCategory
  placeName: string
  address: string
  location: LatLng
  startsAt: string
  endsAt: string
  description: string
  publicPlaceConfirmed: boolean
}

export type CreateEventError = 'not_verified' | 'daily_limit' | 'duplicate' | 'not_public'
export type LostFoundError = 'no_recent_check_in' | 'too_long' | 'empty'

/**
 * One Mapbox map load is reserved on the server before the public token is handed
 * out (ADR 0010). Without a grant the illustrated test map is shown.
 */
export type MapAccess =
  | { granted: true; token: string }
  | { granted: false; reason: 'no_token' | 'quota' | 'unavailable' }

/** Port for venues and events (Supabase + PostGIS from Block 7). */
export interface PlacesService {
  /** Venues nearest to `area` (up to 200) plus live events; without area, the first 200. */
  list(area?: LatLng): Promise<Place[]>
  reserveMapLoad(): Promise<MapAccess>
  myVibe(placeId: string): Promise<Vibe | null>
  voteVibe(placeId: string, vibe: Vibe): Promise<Result<Place, 'no_check_in'>>
  confirmEvent(placeId: string): Promise<Result<Place, 'already_confirmed' | 'not_unconfirmed'>>
  reportEvent(placeId: string, reason: EventReportReason): Promise<void>
  createEvent(input: CreateEventInput): Promise<Result<Place, CreateEventError>>
  lostAndFound(placeId: string): Promise<LostFoundPost[]>
  postLostFound(placeId: string, text: string): Promise<Result<LostFoundPost, LostFoundError>>
  replyLostFound(postId: string, text: string): Promise<Result<LostFoundPost, LostFoundError>>
  editLostFound(postId: string, text: string): Promise<Result<LostFoundPost, LostFoundError>>
  deleteLostFound(postId: string): Promise<void>
}
