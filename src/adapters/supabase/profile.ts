import {
  ONBOARDING_CONSENTS,
  DEFAULT_CONSENTS,
  type ConsentKey,
} from '@/features/consents/model/consents'
import type { ConsentService } from '@/features/consents/services/consent-service'
import type { InterestedIn } from '@/features/onboarding/model/onboarding-machine'
import type { ProfileService } from '@/features/profile/services/profile-service'
import type { SafetyService } from '@/features/safety/services/safety-service'
import { currentUserId, type Db } from './client'
import { must } from './errors'

const SIGNED_URL_SECONDS = 60 * 30
const INTERESTS: readonly InterestedIn[] = ['women', 'men', 'non_binary']

function ageFrom(birthdate: string, now = new Date()): number {
  const b = new Date(`${birthdate}T00:00:00Z`)
  let age = now.getUTCFullYear() - b.getUTCFullYear()
  const beforeBirthday =
    now.getUTCMonth() < b.getUTCMonth() ||
    (now.getUTCMonth() === b.getUTCMonth() && now.getUTCDate() < b.getUTCDate())
  if (beforeBirthday) age -= 1
  return age
}

async function requireUser(db: Db): Promise<string> {
  const uid = await currentUserId(db)
  if (!uid) throw new Error('not_authenticated')
  return uid
}

/** My own profile: private row (RLS) + short-lived signed URLs for my photos. */
export function createProfileService(db: Db): ProfileService {
  const getMine: ProfileService['getMine'] = async () => {
    const uid = await requireUser(db)
    const [profile, prefs, verification] = await Promise.all([
      db.from('profiles').select('*').eq('id', uid).single(),
      db.from('user_preferences').select('*').eq('user_id', uid).maybeSingle(),
      db.from('verification_status').select('photo_verified').eq('user_id', uid).maybeSingle(),
    ])
    const p = must(profile)
    const signed = p.photos.length
      ? must(await db.storage.from('profile-photos').createSignedUrls(p.photos, SIGNED_URL_SECONDS))
      : []
    return {
      id: p.id,
      name: p.name,
      age: ageFrom(p.birthdate),
      gender: p.gender,
      bio: p.bio,
      photos: signed.flatMap((s) => (s.signedUrl ? [s.signedUrl] : [])),
      photoVerified: verification.data?.photo_verified ?? false,
      trafficLight: p.traffic_light,
      anthem: null,
      discreet: p.discreet,
      interestedIn: (prefs.data?.interested_in ?? []).filter((i): i is InterestedIn =>
        (INTERESTS as readonly string[]).includes(i),
      ),
      ageMin: prefs.data?.age_min ?? 18,
      ageMax: prefs.data?.age_max ?? 60,
    }
  }
  return {
    getMine,
    async update(patch) {
      const { error } = await db.rpc('update_my_profile', {
        p: {
          ...(patch.bio !== undefined ? { bio: patch.bio } : {}),
          ...(patch.trafficLight ? { trafficLight: patch.trafficLight } : {}),
          ...(patch.discreet !== undefined ? { discreet: patch.discreet } : {}),
          ...(patch.interestedIn ? { interestedIn: [...patch.interestedIn] } : {}),
          ...(patch.ageMin !== undefined ? { ageMin: patch.ageMin } : {}),
          ...(patch.ageMax !== undefined ? { ageMax: patch.ageMax } : {}),
        },
      })
      if (error) throw error
      return getMine()
    },
  }
}

/** Latest record per consent wins; changes are appended by `save_consents`. */
export function createConsentService(db: Db): ConsentService {
  const getMine: ConsentService['getMine'] = async () => {
    const uid = await currentUserId(db)
    if (!uid) return { choices: { ...DEFAULT_CONSENTS }, city: null, updatedAt: {} }
    const [records, profile] = await Promise.all([
      db
        .from('consent_records')
        .select('consent_key, granted, created_at')
        .eq('user_id', uid)
        .eq('kind', 'consent')
        .order('created_at', { ascending: false }),
      db.from('profiles').select('city').eq('id', uid).maybeSingle(),
    ])
    const choices = { ...DEFAULT_CONSENTS }
    const updatedAt: Partial<Record<ConsentKey, string>> = {}
    for (const r of must(records)) {
      const key = r.consent_key as ConsentKey | null
      if (!key || !(ONBOARDING_CONSENTS as readonly string[]).includes(key) || updatedAt[key])
        continue
      choices[key] = r.granted
      updatedAt[key] = r.created_at
    }
    return { choices, city: profile.data?.city ?? null, updatedAt }
  }
  return {
    getMine,
    async save(choices, city) {
      const { error } = await db.rpc('save_consents', {
        p_choices: { ...choices },
        p_city: city ?? '',
      })
      if (error) throw error
      return getMine()
    },
  }
}

/** SOS Lite contacts: the only table the owner writes directly (RLS own rows, max 3). */
export function createSafetyService(db: Db): SafetyService {
  const list = async (uid: string) =>
    must(
      await db
        .from('emergency_contacts')
        .select('id, name, phone')
        .eq('user_id', uid)
        .order('created_at'),
    )
  return {
    async contacts() {
      const uid = await currentUserId(db)
      return uid ? list(uid) : []
    },
    async saveContacts(next) {
      const uid = await requireUser(db)
      must(await db.from('emergency_contacts').delete().eq('user_id', uid).select('id'))
      if (next.length) {
        must(
          await db
            .from('emergency_contacts')
            .insert(next.slice(0, 3).map((c) => ({ user_id: uid, name: c.name, phone: c.phone })))
            .select('id'),
        )
      }
      return list(uid)
    },
  }
}
