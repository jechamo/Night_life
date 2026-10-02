import type { VenueType } from '@/shared/domain/venue-types'

/** Fictional venue used only by the component kit (Block 1). Never real places or people. */
export const SAMPLE_VENUE: {
  name: string
  type: VenueType
  people: number
  averageAge: number
  greenPercent: number
} = {
  name: 'Sala Aurora (demo)',
  type: 'nightclub',
  people: 128,
  averageAge: 27,
  greenPercent: 64,
}
