/**
 * Verification levels (PRD 6.2). The service only ever receives booleans and
 * metadata (method, threshold, date, provider session). Never documents,
 * selfies, videos or face descriptors.
 */
export type VerificationLevel = 'age' | 'photo' | 'identity'

export type AgeMethod = 'facial_estimation' | 'document' | 'digital_id'

export type VerificationStatus =
  | { state: 'not_started' }
  | { state: 'pending'; providerSessionId: string }
  /** Automatic negative decision or borderline score: a human decides (PRD 6.2). */
  | { state: 'manual_review'; reason: 'requested' | 'borderline' }
  | { state: 'verified'; method?: AgeMethod; thresholdUsed?: number; verifiedAt: string }
  | { state: 'failed'; canRequestReview: boolean }
  /** "Possible minor" report or main photo changed: verify again. */
  | { state: 'reverification_required'; reason: 'possible_minor_report' | 'photo_changed' }

export type VerificationSnapshot = Record<VerificationLevel, VerificationStatus>

export const UNVERIFIED: VerificationSnapshot = {
  age: { state: 'not_started' },
  photo: { state: 'not_started' },
  identity: { state: 'not_started' },
}

/** Default Yoti facial age estimation threshold (PRD 6.2, configurable). */
export const DEFAULT_AGE_THRESHOLD = 21

/**
 * Actions that require verified majority (PRD 5.2 point 10). Exploring the map,
 * events, stats and search never does.
 */
export const AGE_GATED_ACTIONS = [
  'view_profiles',
  'like',
  'chat',
  'going_tonight',
  'visible_check_in',
  'create_event',
  'alcohol_promos',
] as const
export type AgeGatedAction = (typeof AGE_GATED_ACTIONS)[number]

export const isAgeVerified = (snapshot: VerificationSnapshot): boolean =>
  snapshot.age.state === 'verified'

/** Fail closed: anything but an explicit "verified" blocks the action. */
export function canPerform(
  _action: AgeGatedAction,
  snapshot: VerificationSnapshot | undefined,
): boolean {
  return snapshot !== undefined && isAgeVerified(snapshot)
}

/** "Foto verificada" decision from the face similarity score (PRD 6.2 level 2). */
export type PhotoMatchOutcome = 'verified' | 'manual_review' | 'not_matched'
export const PHOTO_MATCH_THRESHOLDS = { verified: 0.85, review: 0.6 } as const

export function classifyPhotoMatch(similarity: number): PhotoMatchOutcome {
  if (!Number.isFinite(similarity)) return 'not_matched'
  if (similarity > PHOTO_MATCH_THRESHOLDS.verified) return 'verified'
  if (similarity >= PHOTO_MATCH_THRESHOLDS.review) return 'manual_review'
  return 'not_matched'
}
