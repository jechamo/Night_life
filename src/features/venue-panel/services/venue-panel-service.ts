import type { Result } from '@/shared/lib/result'

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
  claim(placeId: string, evidence: string): Promise<Result<ManagedVenue, 'already_claimed'>>
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
  createOfficialEvent(
    placeId: string,
    input: { title: string; startsAt: string; endsAt: string; description: string },
  ): Promise<void>
}
