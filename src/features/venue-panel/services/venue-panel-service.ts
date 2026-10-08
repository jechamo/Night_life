import type { LiveStatus, MusicGenre } from '@/features/places/model/live-status'
import type {
  DoorState,
  NoticeKind,
  OfferKind,
  VenueExtras,
  VenueNotice,
  VenuePhotos,
  VenueReport,
} from '@/features/places/model/showcase'
import type { Result } from '@/shared/lib/result'
import type {
  Invitation,
  InvitePreview,
  ManagerRole,
  VenuePartnerState,
  VenueTeam,
} from '../model/partners'

export type SponsorshipTier = 'featured' | 'featured_plus' | 'top'

export interface ManagedVenue {
  placeId: string
  name: string
  claimStatus: 'pending' | 'approved' | 'rejected'
  description: string
  hours: string
  price: 1 | 2 | 3 | 4
  sponsorship: {
    tier: SponsorshipTier
    status: 'requested' | 'active'
    from: string
    to: string
  } | null
}

/** Aggregated, thresholded stats only (PRD 4.3): never individual data. */
export interface VenueStats {
  pro?: boolean
  zoneAverageCheckIns?: number | null
  byHour: { hour: number; people: number }[]
  averageAge: number | null
  greenPercent: number | null
  checkInsWeek: number
  goingTonight: number
}

/** Port for the free venue panel (PRD 6.10). */
export interface VenuePanelService {
  billingState?(placeId: string): Promise<{
    pro: boolean
    subscription: {
      id: string
      status: string
      currentPeriodEnd: string
      canManage?: boolean
    } | null
    /** Roadmap R3: Pro bought through Stripe or included in a contract. */
    proSource?: 'stripe' | 'contract' | null
  }>
  myVenues(): Promise<ManagedVenue[]>
  createFlashAlert(
    placeId: string,
    input: {
      title: string
      body: string
      startsAt: string
      endsAt: string
      containsAlcohol: boolean
    },
  ): Promise<void>
  flashAlerts(
    placeId: string,
  ): Promise<{ id: string; title: string; body: string; endsAt: string }[]>
  /** With `venue_partners_enabled`, the server also requires the current venue terms. */
  claim(
    placeId: string,
    evidence: string,
  ): Promise<Result<ManagedVenue, 'already_claimed' | 'terms_required'>>
  update(
    placeId: string,
    patch: Partial<Pick<ManagedVenue, 'description' | 'hours' | 'price'>>,
  ): Promise<ManagedVenue>
  stats(placeId: string): Promise<VenueStats>
  requestSponsorship(
    placeId: string,
    tier: SponsorshipTier,
    from: string,
    to: string,
  ): Promise<ManagedVenue>
  /** Roadmap R2: styles (max 3) and tonight's line-up declared by the venue. */
  setMusic(placeId: string, genres: MusicGenre[], lineup: string): Promise<LiveStatus>
  createOfficialEvent(
    placeId: string,
    input: { title: string; startsAt: string; endsAt: string; description: string },
  ): Promise<void>
  // Roadmap R3 (flag `venue_partners_enabled`, checked by the server).
  partnerState(placeId: string): Promise<VenuePartnerState>
  team(placeId: string): Promise<VenueTeam>
  inviteStaff(placeId: string): Promise<Result<Invitation, 'team_limit'>>
  cancelInvite(placeId: string, inviteId: string): Promise<void>
  removeManager(placeId: string, userId: string): Promise<void>
  previewInvite(code: string): Promise<Result<InvitePreview, 'invalid_code'>>
  redeemInvite(
    code: string,
    acceptTerms: boolean,
  ): Promise<
    Result<
      { placeId: string; role: ManagerRole },
      'invalid_code' | 'already_manager' | 'terms_required'
    >
  >
  // Roadmap R4 (flag `venue_showcase_enabled`, checked by the server).
  photos(placeId: string): Promise<VenuePhotos>
  /** `blob` must already be re-encoded without metadata (`usePlatform().images`). */
  uploadPhoto(placeId: string, blob: Blob): Promise<Result<VenuePhotos, 'photo_limit'>>
  removePhoto(placeId: string, photoId: string): Promise<VenuePhotos>
  setCoverPhoto(placeId: string, photoId: string): Promise<VenuePhotos>
  saveExtras(placeId: string, extras: VenueExtras): Promise<VenueExtras>
  setNotice(
    placeId: string,
    notice: { kind: 'door'; value: DoorState } | { kind: OfferKind; until: string },
  ): Promise<VenueNotice[]>
  clearNotice(placeId: string, kind: NoticeKind): Promise<VenueNotice[]>
  report(placeId: string): Promise<VenueReport>
}
