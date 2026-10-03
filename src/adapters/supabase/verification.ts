import { z } from 'zod'
import type { VerificationSnapshot } from '@/features/verification/model/verification'
import type { VerificationService } from '@/features/verification/services/verification-service'
import { isAllowedExternalUrl } from '@/platform/in-app-browser/allowlist'
import { err, ok } from '@/shared/lib/result'
import { currentUserId, invokeFunction, type Db } from './client'
import { must } from './errors'

const statusSchema = z.discriminatedUnion('state', [
  z.object({ state: z.literal('not_started') }),
  z.object({ state: z.literal('pending'), providerSessionId: z.string().min(1) }),
  z.object({ state: z.literal('manual_review'), reason: z.enum(['requested', 'borderline']) }),
  z.object({
    state: z.literal('verified'),
    verifiedAt: z.iso.datetime({ offset: true }),
    method: z.enum(['facial_estimation', 'document', 'digital_id']).optional(),
    thresholdUsed: z.number().finite().optional(),
  }),
  z.object({ state: z.literal('failed'), canRequestReview: z.boolean() }),
  z.object({
    state: z.literal('reverification_required'),
    reason: z.enum(['possible_minor_report', 'photo_changed']),
  }),
])

const snapshotSchema = z.object({ age: statusSchema, photo: statusSchema, identity: statusSchema })
const redirectSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('external'), url: z.string() }),
  z.object({ type: z.literal('internal'), path: z.string() }),
])

/** Malformed or unavailable backend data never becomes a verified result. */
export function parseVerificationSnapshot(value: unknown): VerificationSnapshot {
  return snapshotSchema.parse(value)
}

/** No selfie, document, score or client assertion of success crosses this adapter. */
export function createVerificationService(db: Db): VerificationService {
  return {
    async getSnapshot() {
      if (!(await currentUserId(db))) throw new Error('not_authenticated')
      return parseVerificationSnapshot(must(await db.rpc('verification_snapshot')))
    },
    async start(level, method, consent, simulate) {
      if (level !== 'age' && consent !== true) return err('unavailable')
      const result = await invokeFunction<unknown>(db, 'verification', {
        action: 'start',
        level,
        ...(method ? { method } : {}),
        ...(consent === true ? { consent: true } : {}),
        ...(simulate === true ? { source: 'simulator' } : {}),
      })
      const redirect = redirectSchema.safeParse(result.data)
      if (result.failed || !redirect.success) return err('unavailable')
      const value = redirect.data
      if (value.type === 'external') {
        if (
          !isAllowedExternalUrl(value.url, [
            { host: 'yoti.com', allowSubdomains: true },
            { host: 'veriff.com', allowSubdomains: true },
            { host: 'veriff.me', allowSubdomains: true },
          ])
        )
          return err('unavailable')
      } else if (value.path !== `/verification/sandbox?level=${level}`) {
        return err('unavailable')
      }
      return ok(value)
    },
    async requestHumanReview(level) {
      return parseVerificationSnapshot(
        must(await db.rpc('request_verification_review', { p_level: level })),
      )
    },
    async simulateResult(level, outcome) {
      return parseVerificationSnapshot(
        must(await db.rpc('simulate_verification_result', { p_level: level, p_outcome: outcome })),
      )
    },
  }
}
