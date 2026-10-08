import { z } from 'zod'
import { parseLiveStatus } from '@/features/places/model/live-status'
import type { VenuePanelService } from '@/features/venue-panel/services/venue-panel-service'
import type { ModerationService } from '@/features/moderation/services/moderation-service'
import { err, ok } from '@/shared/lib/result'
import type { Db } from './client'
import { must } from './errors'
import { withRealAccountStatus } from './privacy'

export const managedVenueSchema = z.object({
  placeId: z.string(),
  name: z.string(),
  claimStatus: z.enum(['pending', 'approved', 'rejected']),
  description: z.string(),
  hours: z.string(),
  price: z
    .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
    .nullable()
    .transform((v) => v ?? 1),
  sponsorship: z
    .object({
      tier: z.enum(['featured', 'featured_plus', 'top']),
      status: z.enum(['requested', 'active']),
      from: z.string(),
      to: z.string(),
    })
    .nullable(),
})
const decision = z.object({
  id: z.string(),
  action: z.enum(['warning', 'content_removed', 'suspension', 'ban']),
  reason: z.string(),
  explanation: z.string(),
  createdAt: z.string(),
  appeal: z
    .object({ status: z.enum(['pending', 'accepted', 'rejected']), text: z.string() })
    .nullable(),
})
export function createModerationService(db: Db, base: ModerationService): ModerationService {
  return {
    ...withRealAccountStatus(db, base),
    async myReports() {
      return z
        .array(
          z.object({
            id: z.string(),
            aboutName: z.string(),
            reason: z.string(),
            createdAt: z.string(),
            status: z.enum(['open', 'actioned', 'dismissed']),
          }),
        )
        .parse(must(await db.rpc('moderation_reports')))
    },
    async decisions() {
      return z.array(decision).parse(must(await db.rpc('moderation_decisions')))
    },
    async appeal(id, text) {
      const r = must(await db.rpc('moderation_appeal', { p_decision: id, p_text: text }))
      return r && typeof r === 'object' && !Array.isArray(r) && r.error
        ? err('already_appealed')
        : ok(decision.parse(r))
    },
    async submitIllegalContentNotice(input) {
      return must(await db.rpc('submit_illegal_content_notice', { p: { ...input } }))
    },
  }
}
export function createVenuePanelService(db: Db): VenuePanelService {
  return {
    async billingState(id) {
      return z
        .object({
          pro: z.boolean(),
          subscription: z
            .object({
              id: z.string(),
              status: z.string(),
              currentPeriodEnd: z.string(),
              canManage: z.boolean().optional(),
            })
            .nullable(),
        })
        .parse(must(await db.rpc('venue_billing_state', { p_venue: id })))
    },
    async myVenues() {
      return z.array(managedVenueSchema).parse(must(await db.rpc('managed_venues')))
    },
    async claim(id, evidence) {
      const r = must(await db.rpc('venue_claim', { p_venue: id, p_evidence: evidence }))
      return r && typeof r === 'object' && !Array.isArray(r) && r.error
        ? err('already_claimed')
        : ok(managedVenueSchema.parse(r))
    },
    async update(id, patch) {
      return managedVenueSchema.parse(
        must(await db.rpc('venue_edit', { p_venue: id, p: { ...patch } })),
      )
    },
    async stats(id) {
      return z
        .object({
          byHour: z.array(z.object({ hour: z.number(), people: z.number() })),
          pro: z.boolean().optional(),
          zoneAverageCheckIns: z.number().nullable().optional(),
          averageAge: z.number().nullable(),
          greenPercent: z.number().nullable(),
          checkInsWeek: z.number(),
          goingTonight: z.number(),
        })
        .parse(must(await db.rpc('venue_stats', { p_venue: id })))
    },
    async requestSponsorship(id, tier, from, to) {
      return managedVenueSchema.parse(
        must(
          await db.rpc('venue_sponsorship', { p_venue: id, p_tier: tier, p_from: from, p_to: to }),
        ),
      )
    },
    async setMusic(id, genres, lineup) {
      return parseLiveStatus(
        must(await db.rpc('venue_set_music', { p_venue: id, p_genres: genres, p_lineup: lineup })),
      )
    },
    async createOfficialEvent(id, input) {
      must(await db.rpc('venue_official_event', { p_venue: id, p: { ...input } }))
    },
    async createFlashAlert(id, input) {
      must(await db.rpc('venue_flash_alert', { p_venue: id, p: { ...input } }))
    },
    async flashAlerts(id) {
      return z
        .array(
          z.object({ id: z.string(), title: z.string(), body: z.string(), endsAt: z.string() }),
        )
        .parse(must(await db.rpc('visible_flash_alerts', { p_venue: id })))
    },
  }
}
