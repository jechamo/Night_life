import type { ConsentChoices, ConsentKey } from '@/features/consents/model/consents'
import { DEFAULT_CONSENTS } from '@/features/consents/model/consents'
import type { SignedDocument } from '@/features/legal/model/legal'
import { UNVERIFIED, type VerificationSnapshot } from '@/features/verification/model/verification'
import type { PreferencesService } from '@/platform/preferences/preferences'

/**
 * Simulated backend state for Blocks 1-4. Persisted locally ONLY so testers keep
 * their progress across reloads, and it contains no personal data: no phone,
 * birthdate, name or photos (those stay in memory). Replaced by Supabase in Block 5.
 */
export interface MockState {
  onboarded: boolean
  signed: SignedDocument[]
  consents: ConsentChoices
  consentsUpdatedAt: Partial<Record<ConsentKey, string>>
  city: string | null
  verification: VerificationSnapshot
}

const KEY = 'mock_state'

export const initialMockState = (): MockState => ({
  onboarded: false,
  signed: [],
  consents: { ...DEFAULT_CONSENTS },
  consentsUpdatedAt: {},
  city: null,
  verification: structuredClone(UNVERIFIED),
})

export interface MockStore {
  read(): Promise<MockState>
  update(fn: (state: MockState) => MockState): Promise<MockState>
}

export function createMockStore(
  preferences: PreferencesService,
  seed?: Partial<MockState>,
): MockStore {
  let cache: MockState | null = seed ? { ...initialMockState(), ...seed } : null
  const read = async () => {
    if (cache) return cache
    const raw = await preferences.get(KEY)
    try {
      cache = raw
        ? { ...initialMockState(), ...(JSON.parse(raw) as Partial<MockState>) }
        : initialMockState()
    } catch {
      cache = initialMockState()
    }
    return cache
  }
  return {
    read,
    async update(fn) {
      const next = fn(await read())
      cache = next
      await preferences.set(KEY, JSON.stringify(next))
      return next
    },
  }
}

/** Small artificial latency so loading states are visible while testing. */
export const latency = (ms = 350) => new Promise<void>((resolve) => setTimeout(resolve, ms))
