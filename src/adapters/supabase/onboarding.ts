import type { OnboardingService } from '@/features/onboarding/services/onboarding-service'
import type { Platform } from '@/platform'
import { PREFERENCE_KEYS } from '@/shared/config/preferences'
import { err, ok } from '@/shared/lib/result'
import { currentUserId, type Db } from './client'
import { errorCode, errorStatus } from './errors'

const RESEND_AFTER_SECONDS = 60
const PHOTO_BUCKET = 'profile-photos'

const extensionFor = (type: string) =>
  type === 'image/png' ? 'png' : type === 'image/jpeg' ? 'jpg' : 'webp'

/**
 * Phone + OTP with Supabase Auth (PRD 5.2.4). Before sending an SMS the server checks
 * banned phone/device HMACs and abuse limits (`check_signup`); Auth adds its own OTP
 * limits. `complete()` uploads the EXIF-free photos and creates everything else in
 * ONE server transaction (`complete_onboarding`), which re-validates the data.
 */
export function createOnboardingService(db: Db, platform: Platform): OnboardingService {
  return {
    async getStatus() {
      const uid = await currentUserId(db)
      if (!uid) return 'pending'
      const { data } = await db.from('profiles').select('onboarded_at').eq('id', uid).maybeSingle()
      return data?.onboarded_at ? 'completed' : 'pending'
    },

    async requestOtp(phone) {
      const deviceId = await platform.deviceId.getDeviceId()
      const check = await db.rpc('check_signup', { p_phone: phone, p_device_id: deviceId })
      if (check.error) return err('network')
      if (check.data === 'blocked') return err('blocked')
      if (check.data === 'rate_limited') return err('rate_limited')
      if (check.data !== 'ok') return err('invalid_phone')
      const { error } = await db.auth.signInWithOtp({ phone })
      if (!error) return ok({ resendAfterSeconds: RESEND_AFTER_SECONDS })
      if (errorStatus(error) === 429) return err('rate_limited')
      if (errorCode(error) === 'validation_failed') return err('invalid_phone')
      return err('network')
    },

    async verifyOtp(phone, code) {
      const { error } = await db.auth.verifyOtp({ phone, token: code, type: 'sms' })
      if (!error) return ok(undefined)
      if (errorStatus(error) === 429) return err('too_many_attempts')
      if (errorCode(error) === 'otp_expired' || errorStatus(error) === 403) return err('wrong_code')
      return err('network')
    },

    async complete(data) {
      const uid = await currentUserId(db)
      if (!uid || !data.profile || !data.birthdate) return err('network')
      const photos: string[] = []
      for (const blob of data.profile.photos) {
        const path = `${uid}/${crypto.randomUUID()}.${extensionFor(blob.type)}`
        const upload = await db.storage
          .from(PHOTO_BUCKET)
          .upload(path, blob, { contentType: blob.type || 'image/webp', upsert: false })
        if (upload.error) return err('network')
        photos.push(path)
      }
      const language = (await platform.preferences.get(PREFERENCE_KEYS.language)) ?? 'es'
      const { error } = await db.rpc('complete_onboarding', {
        p: {
          birthdate: data.birthdate,
          name: data.profile.name,
          gender: data.profile.gender,
          bio: data.profile.bio,
          photos,
          signed: (data.signed ?? []).map((s) => ({ slug: s.slug, version: s.version })),
          consents: { ...data.consents },
          city: data.city ?? null,
          preferences: data.preferences
            ? {
                interestedIn: [...data.preferences.interestedIn],
                ageMin: data.preferences.ageMin,
                ageMax: data.preferences.ageMax,
              }
            : null,
          themeId: data.themeId ?? 'neon-noir',
          language: language === 'en' ? 'en' : 'es',
          email: data.email ?? null,
          deviceId: await platform.deviceId.getDeviceId(),
        },
      })
      if (error) {
        await db.storage.from(PHOTO_BUCKET).remove(photos)
        return err('network')
      }
      // Optional email: Supabase Auth sends the confirmation link (PRD 5.2.4 "verificado").
      if (data.email) await db.auth.updateUser({ email: data.email })
      return ok(undefined)
    },

    /** Testing tool "Reiniciar onboarding": with a real backend it signs out. */
    async reset() {
      await db.auth.signOut({ scope: 'local' })
    },
  }
}
