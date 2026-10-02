import type { MatchingProfile } from '@/features/matching/model/people'

export type ProfilePatch = Partial<
  Pick<MatchingProfile, 'bio' | 'trafficLight' | 'discreet' | 'interestedIn' | 'ageMin' | 'ageMax'>
>

export interface ProfileService {
  getMine(): Promise<MatchingProfile>
  update(patch: ProfilePatch): Promise<MatchingProfile>
}
