import { z } from 'zod'
import type { VenueInput } from '@/features/admin/model/venue'
import type { AdminRow, AdminService } from '@/features/admin/services/admin-service'
import { VENUE_TYPES } from '@/shared/domain/venue-types'
import { ROLES, type Role } from '@/shared/session/roles'
import { invokeFunction, type Db } from './client'
import type { Json } from './database.types'
import { must } from './errors'

const count = z.number().int().nonnegative()
const providerQuotasSchema = z.array(
  z.object({
    capability: z.enum(['mapbox', 'google_places']),
    mode: z.literal('free_quota'),
    sku: z.string(),
    available: z.boolean(),
    canCall: z.boolean(),
    editable: z.boolean(),
    hasToken: z.boolean().catch(false),
    expiresAt: z.string().nullable(),
    dailyBudget: count,
    dailyUsed: count,
    monthlyBudget: count,
    monthlyUsed: count,
    freeMonthlyAllowance: count,
    safetyMargin: count,
    observedProviderUsage: count,
    usageObservedAt: z.string().nullable(),
    maxBudget: count,
    increaseStep: z.number().int().positive(),
  }),
)

const venuesSchema = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum(VENUE_TYPES),
    city: z.string().catch(''),
    address: z.string().catch(''),
    description: z.string().catch(''),
    hours: z.string().catch(''),
    price: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .nullable()
      .catch(null),
    phone: z.string().catch(''),
    website: z.string().catch(''),
    music: z.array(z.string()).catch([]),
    dressCode: z.string().catch(''),
    minAge: z.number().nullable().catch(null),
    notes: z.string().catch(''),
    openingHours: z
      .array(z.object({ day: z.number(), opens: z.string(), closes: z.string() }))
      .catch([]),
    isTest: z.boolean(),
    locationSource: z.string(),
    lat: z.number().nullable(),
    lng: z.number().nullable(),
  }),
)

const countSchema = z.object({ count: z.number() })
const osmResultSchema = z.object({
  found: count,
  added: count,
  updated: count,
  kept: count,
  skipped: count,
})
const catalogueResultSchema = z.object({
  added: count,
  updated: count,
  skipped: count,
})
const OSM_ERRORS: Record<number, string> = {
  403: 'forbidden',
  429: 'rate_limited',
  503: 'provider_busy',
}
const simResultSchema = z.object({
  eventsBackdated: z.number(),
  attendanceExpired: z.number(),
  lostExpired: z.number(),
})

function venuePayload(v: VenueInput) {
  return {
    name: v.name.trim(),
    type: v.type,
    city: v.city.trim(),
    address: v.address.trim(),
    description: v.description.trim(),
    hours: v.hours.trim(),
    ...(v.price ? { price: v.price } : {}),
    phone: v.phone.trim(),
    website: v.website.trim(),
    music: v.music,
    dressCode: v.dressCode.trim(),
    minAge: v.minAge,
    notes: v.notes.trim(),
    openingHours: v.openingHours.map((p) => ({ day: p.day, opens: p.opens, closes: p.closes })),
    lat: v.lat,
    lng: v.lng,
  }
}

const ROLE_ACTION = /^(grant|revoke)_(tester|venue_manager|admin)$/

function asNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0)
}

/**
 * Admin over Supabase (ADR 0009): flags, settings, users/roles, audit, dashboard,
 * verification reviews, test data and TOTP MFA are real (role admin + aal2 checked by
 * every RPC). The queues of Blocks 7-9 (moderation, claims, payments…) remain simulated.
 */
export function createAdminService(db: Db, base: AdminService): AdminService {
  const service: AdminService = {
    ...base,
    mode: 'live',

    async dashboard() {
      const [simulated, real, reviews] = await Promise.all([
        base.dashboard(),
        db.rpc('admin_dashboard'),
        db.rpc('admin_verification_reviews'),
      ])
      const d = (real.data ?? {}) as Record<string, unknown>
      if (real.error) return simulated
      return {
        ...simulated,
        users: asNumber(d.users),
        ageVerifiedPercent: asNumber(d.ageVerifiedPercent),
        matchesToday: asNumber(d.matchesToday),
        pendingVerifications: reviews.error ? 0 : (reviews.data ?? []).length,
      }
    },

    async list(section) {
      if (section === 'verifications') {
        const rows = must(await db.rpc('admin_verification_reviews'))
        return rows.map((r): AdminRow => ({
          id: r.id,
          title: r.user_name,
          subtitle: r.level,
          status: 'pending',
          createdAt: r.created_at,
          facts: [
            r.provider,
            r.mode,
            r.method,
            ...(r.reason ? [r.reason] : []),
            ...(r.is_test ? ['is_test'] : []),
          ],
        }))
      }
      if (section === 'audit') {
        const rows = must(
          await db
            .from('admin_audit_log')
            .select('id, action, detail, created_at')
            .order('created_at', { ascending: false })
            .limit(200),
        )
        return rows.map((r): AdminRow => ({
          id: String(r.id),
          title: r.action,
          subtitle: r.detail,
          status: 'logged',
          createdAt: r.created_at,
          facts: [],
        }))
      }
      if (section === 'users') {
        const rows = must(await db.rpc('admin_list_users', { p_query: '', p_limit: 100 }))
        return rows.map((u): AdminRow => ({
          id: u.id,
          title: u.name,
          subtitle: u.phone_hint,
          status: 'active',
          createdAt: u.created_at,
          facts: u.is_test ? ['is_test', ...u.roles] : u.roles,
        }))
      }
      return base.list(section)
    },

    async act(section, id, action, note) {
      if (section === 'verifications' && (action === 'approve' || action === 'reject')) {
        const { error } = await db.rpc('admin_resolve_verification', {
          p_session: id,
          p_approve: action === 'approve',
          p_note: note ?? '',
        })
        if (error) throw error
        return
      }
      const match = section === 'users' ? ROLE_ACTION.exec(action) : null
      if (!match) return base.act(section, id, action, note)
      const role = match[2] as Role
      if (!(ROLES as readonly string[]).includes(role)) return
      const { error } = await db.rpc('admin_set_role', {
        p_user: id,
        p_role: role,
        p_granted: match[1] === 'grant',
      })
      if (error) throw error
    },

    async setFlag(key, value) {
      const { error } = await db.rpc('admin_set_flag', { p_key: key, p_value: String(value) })
      if (error) throw error
    },

    async settings() {
      const rows = must(
        await db
          .from('app_settings')
          .select('key, value, min_value, max_value')
          .eq('kind', 'setting')
          .order('key'),
      )
      const known = await base.settings()
      return known.map((s) => {
        const row = rows.find((r) => r.key === s.key)
        return row
          ? {
              key: s.key,
              value: Number(row.value),
              min: row.min_value ?? s.min,
              max: row.max_value ?? s.max,
            }
          : s
      })
    },

    async setSetting(key, value) {
      const { error } = await db.rpc('admin_set_setting', { p_key: key, p_value: value })
      if (error) throw error
    },

    async runTestTool(tool) {
      if (tool === 'purge_test_data') {
        const { data, error } = await db.rpc('purge_test_data')
        return error ? 'disabled' : String(data)
      }
      if (tool === 'generate_test_city') {
        const { data, failed } = await invokeFunction<{ created: number }>(db, 'test-tools', {
          action: 'generate_people',
          count: 12,
        })
        return failed || !data ? 'disabled' : String(data.created)
      }
      try {
        if (tool === 'fill_venue') {
          const venue = (await service.venues()).find((v) => v.isTest)
          return venue ? String(await service.fillTestVenue(venue.id, 25)) : 'none'
        }
        if (tool === 'expire_everything') {
          const result = simResultSchema.parse(must(await db.rpc('sim_advance_expiry')))
          return `${result.eventsBackdated} / ${result.attendanceExpired} / ${result.lostExpired}`
        }
        if (tool === 'import_events') return String(await service.importTestEvents('Madrid', 3))
      } catch {
        return 'disabled'
      }
      return base.runTestTool(tool)
    },

    async providerQuotas() {
      return providerQuotasSchema.parse(must(await db.rpc('admin_provider_access')))
    },

    async configureProvider(change) {
      const { error } = await db.rpc('admin_configure_provider', {
        p_capability: change.capability,
        p_daily: change.dailyBudget,
        p_monthly: change.monthlyBudget,
        p_enabled: change.enabled,
        ...(change.observedProviderUsage !== undefined
          ? { p_observed_usage: change.observedProviderUsage }
          : {}),
      })
      if (error) throw error
    },

    async setMapToken(token) {
      const { error } = await db.rpc('admin_set_map_token', { p_token: token })
      if (error) throw error
    },

    async venues(query) {
      const q = query?.trim()
      return venuesSchema.parse(
        must(await db.rpc('admin_list_venues', q ? { p_query: q.slice(0, 80) } : {})),
      )
    },

    async importOsmVenues(city) {
      const result = await db.functions.invoke<unknown>('osm-import', { body: { city } })
      if (result.error) {
        const status = (result.error as { context?: { status?: number } }).context?.status
        throw new Error(OSM_ERRORS[status ?? 0] ?? 'failed')
      }
      return osmResultSchema.parse(result.data)
    },

    async importCatalogue(rows) {
      const items = JSON.parse(JSON.stringify(rows)) as Json
      return catalogueResultSchema.parse(
        must(await db.rpc('admin_import_catalogue', { p_items: items })),
      )
    },

    async deleteVenue(id) {
      const { error } = await db.rpc('admin_delete_venue', { p_venue: id })
      if (error) throw error
    },

    async createVenue(input) {
      return must(await db.rpc('admin_create_venue', { p: venuePayload(input) }))
    },

    async updateVenue(id, input) {
      const { error } = await db.rpc('update_venue_details', {
        p_venue: id,
        p: venuePayload(input),
      })
      if (error) throw error
    },

    async seedTestVenues() {
      return countSchema.parse(must(await db.rpc('sim_seed_places'))).count
    },

    async fillTestVenue(id, count) {
      const result = must(await db.rpc('sim_fill_venue', { p_venue: id, p_count: count }))
      return z.object({ added: z.number() }).parse(result).added
    },

    async importTestEvents(city, count) {
      const result = must(await db.rpc('sim_import_events', { p_city: city, p_count: count }))
      return countSchema.parse(result).count
    },

    async mfaStatus() {
      const [{ data: factors }, { data: level }] = await Promise.all([
        db.auth.mfa.listFactors(),
        db.auth.mfa.getAuthenticatorAssuranceLevel(),
      ])
      return {
        enrolled: (factors?.totp.length ?? 0) > 0,
        verified: level?.currentLevel === 'aal2',
      }
    },

    async enrollMfa() {
      const { data: existing } = await db.auth.mfa.listFactors()
      // An abandoned enrolment leaves an unverified factor; clear it before retrying.
      for (const factor of existing?.all ?? []) {
        if (factor.status === 'unverified') await db.auth.mfa.unenroll({ factorId: factor.id })
      }
      const { data, error } = await db.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Nightlife admin',
      })
      if (error) throw error
      return { qrCode: data.totp.qr_code, secret: data.totp.secret, uri: data.totp.uri }
    },

    async verifyMfa(code) {
      const { data: factors } = await db.auth.mfa.listFactors()
      const factor = factors?.all.find((f) => f.factor_type === 'totp')
      if (!factor) return false
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code })
      return !error
    },
  }
  return service
}
