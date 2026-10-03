import type { AdminVenue, VenueInput } from '@/features/admin/model/venue'
import type { AdminRow, AdminService, AdminSection } from '@/features/admin/services/admin-service'
import { isMutuallyCompatible } from '@/features/matching/model/matching'
import type { Match } from '@/features/matching/services/matching-service'
import { isEvent, type Place } from '@/features/places/model/types'
import type { PremiumService } from '@/features/premium/services/premium-service'
import type { MockStore } from '../mock-store'
import { contextFor, emit, type WorldState } from '../world/world-state'
import { audit, type MockConfig } from './config'

type Wait = () => Promise<void>

function toAdminVenue(p: Place): AdminVenue {
  return {
    id: p.id,
    name: p.name,
    type: p.type === 'event' ? 'club' : p.type,
    city: p.city ?? 'Madrid',
    address: p.address,
    description: p.description ?? '',
    hours: p.hours,
    price: p.price,
    phone: p.phone ?? '',
    website: p.website ?? '',
    music: [...(p.music ?? [])],
    dressCode: p.dressCode ?? '',
    minAge: p.minAge ?? null,
    notes: '',
    openingHours: [...(p.openingHours ?? [])],
    isTest: true,
    locationSource: 'owner',
    lat: p.location.lat,
    lng: p.location.lng,
  }
}

function fromVenueInput(id: string, v: VenueInput): Place {
  return {
    id,
    name: v.name,
    type: v.type,
    location: { lat: v.lat, lng: v.lng },
    address: v.address,
    price: v.price,
    hours: v.hours,
    openNow: true,
    rating: null,
    sponsored: false,
    stats: { people: 0, averageAge: null, greenPercent: null, ratio: null, goingTonight: 0 },
    vibes: { fire: 0, music: 0, chill: 0, packed: 0, friendly: 0 },
    city: v.city,
    description: v.description,
    phone: v.phone,
    website: v.website,
    openingHours: v.openingHours,
    music: v.music,
    dressCode: v.dressCode,
    ...(v.minAge !== null ? { minAge: v.minAge } : {}),
  }
}

/** Statuses an admin action moves a row to (decisions are always explained & audited). */
const RESULT: Record<string, string> = {
  approve: 'approved',
  reject: 'rejected',
  dismiss: 'dismissed',
  warn: 'warned',
  suspend: 'suspended',
  accept: 'accepted',
  lift: 'lifted',
  activate: 'active',
  end: 'ended',
  done: 'done',
  hide: 'hidden',
  restore: 'restored',
  delete: 'deleted',
  publish: 'active',
  revoke: 'revoked',
}

export function createMockAdminService(
  config: MockConfig,
  world: WorldState,
  store: MockStore,
  premium: PremiumService,
  wait: Wait,
): AdminService {
  const derived = (section: AdminSection): AdminRow[] | null => {
    switch (section) {
      case 'events':
        return world.places.filter(isEvent).map((p) => ({
          id: p.id,
          title: p.name,
          subtitle: `${p.address} · ${p.event.confirmations} confirmaciones · ${p.event.fakeReports} reportes`,
          status: p.event.status,
          createdAt: p.event.createdAt,
          facts: [p.event.origin],
        }))
      case 'subscriptions':
        return config.premium.subscription
          ? [
              {
                id: config.premium.subscription.id,
                title: 'Tú (tester)',
                subtitle: `${config.premium.subscription.productCode} · ${config.premium.subscription.provider}`,
                status: config.premium.subscription.status,
                createdAt: config.premium.subscription.startedAt,
                facts: ['test'],
              },
            ]
          : []
      case 'entitlements':
        return config.entitlements.map((e, i) => ({
          id: `${e.key}-${i}`,
          title: e.key,
          subtitle: `origen ${e.source} · hasta ${e.endsAt?.slice(0, 10) ?? 'sin fin'}`,
          status: e.status,
          createdAt: e.startsAt,
          facts: [e.source],
        }))
      case 'promoCodes':
        return config.promoCodes.map((p) => ({
          id: p.code,
          title: p.code,
          subtitle: `${p.productCode} · ${p.days} días · ${p.uses}/${p.maxUses} usos`,
          status: Date.parse(p.expiresAt) > Date.now() ? 'active' : 'expired',
          createdAt: p.expiresAt,
          facts: [],
        }))
      case 'audit':
        return config.audit
      case 'users':
        return [
          {
            id: 'me',
            title: 'Tú (cuenta simulada)',
            subtitle: '••• 222',
            status: 'active',
            createdAt: new Date(Date.now() - 86_400_000).toISOString(),
            facts: [...config.roles],
          },
        ]
      default:
        return null
    }
  }

  return {
    async dashboard() {
      await wait()
      const open = (rows: AdminRow[]) =>
        rows.filter((r) => ['open', 'pending'].includes(r.status)).length
      return {
        users: 1 + world.people.length,
        ageVerifiedPercent: 62,
        matchesToday: world.matches.length,
        pendingReports: open(config.rows.reports),
        pendingVerifications: open(config.rows.verifications),
        pendingClaims: open(config.rows.claims),
        openDataRequests: open(config.rows.dataRequests),
        testRevenueCents: config.premium.invoices
          .filter((i) => i.status === 'paid')
          .reduce((a, i) => a + i.amountCents, 0),
      }
    },
    async list(section) {
      await wait()
      return [...(derived(section) ?? config.rows[section as keyof MockConfig['rows']])]
    },
    async act(section, id, action, note) {
      await wait()
      const status = RESULT[action] ?? action
      if (section === 'events') {
        world.places = world.places.map((p) =>
          p.id === id && isEvent(p) ? { ...p, event: { ...p.event, status: status as never } } : p,
        )
      } else if (section === 'users') {
        const [verb, ...rest] = action.split('_')
        const role = rest.join('_') as (typeof config.roles)[number]
        config.roles =
          verb === 'grant'
            ? [...new Set([...config.roles, role])]
            : config.roles.filter((r) => r !== role)
      } else if (section === 'entitlements') {
        const index = Number(id.split('-').at(-1))
        config.entitlements = config.entitlements.map((e, i) =>
          i === index ? { ...e, status: 'revoked' } : e,
        )
      } else if (section in config.rows) {
        const rows = config.rows[section as keyof MockConfig['rows']]
        const row = rows.find((r) => r.id === id)
        if (row) row.status = status
      }
      audit(config, `${section}.${action}`, `${id}${note ? ` · ${note}` : ''}`)
    },
    async setFlag(key, value) {
      await wait()
      const before = config.flags[key]
      config.flags = { ...config.flags, [key]: value }
      audit(config, 'flag.update', `${key}: ${String(before)} → ${String(value)}`)
    },
    settings: () => Promise.resolve(config.settings.map((s) => ({ ...s }))),
    async setSetting(key, value) {
      await wait()
      const setting = config.settings.find((s) => s.key === key)
      if (!setting) return
      const clamped = Math.min(setting.max, Math.max(setting.min, value))
      audit(config, 'setting.update', `${key}: ${setting.value} → ${clamped}`)
      setting.value = clamped
    },
    // Provider billing controls exist only in the real backend; no mock success.
    providerQuotas: () => Promise.resolve([]),
    configureProvider: () => Promise.reject(new Error('provider_not_available')),
    setMapToken: () => Promise.reject(new Error('provider_not_available')),
    async venues() {
      await wait()
      return world.places.filter((p) => !isEvent(p)).map(toAdminVenue)
    },
    async createVenue(input) {
      await wait()
      const id = `v-${crypto.randomUUID()}`
      world.places = [...world.places, fromVenueInput(id, input)]
      audit(config, 'venue.create', id)
      return id
    },
    async updateVenue(id, input) {
      await wait()
      world.places = world.places.map((p) =>
        p.id === id ? { ...fromVenueInput(id, input), stats: p.stats, vibes: p.vibes } : p,
      )
      audit(config, 'venue.update', id)
    },
    // The illustrated world already is the test catalogue; seeding adds nothing new.
    seedTestVenues: () => Promise.resolve(0),
    async fillTestVenue(id, count) {
      await wait()
      const place = world.places.find((p) => p.id === id)
      if (!place) return 0
      const stats = { ...place.stats, people: place.stats.people + count }
      world.places = world.places.map((p) => (p.id === id ? { ...p, stats } : p))
      emit(world, { type: 'stats', placeId: id, stats })
      return count
    },
    importTestEvents: () => Promise.reject(new Error('provider_not_available')),
    async createPromoCode({ productCode, days, maxUses }) {
      await wait()
      const block = () =>
        Array.from(
          { length: 4 },
          () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)],
        ).join('')
      const code = `${block()}-${block()}-${block()}`
      config.promoCodes.unshift({
        code,
        productCode,
        days,
        maxUses,
        uses: 0,
        expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      })
      audit(config, 'promo.create', `${code} · ${productCode}`)
      return code
    },
    async grantEntitlement({ user, key, days }) {
      await wait()
      config.entitlements.push({
        key,
        source: 'admin',
        status: 'active',
        startsAt: new Date().toISOString(),
        endsAt: days ? new Date(Date.now() + days * 86_400_000).toISOString() : null,
      })
      audit(config, 'entitlement.grant', `${user} · ${key}`)
    },
    async runTestTool(tool) {
      await wait()
      // Test tools are double-gated server-side: role tester/admin + test_tools_enabled (PRD 6.15 API5).
      if (config.flags.test_tools_enabled !== 'on') return 'disabled'
      audit(config, `test_tool.${tool}`, 'ok')
      switch (tool) {
        case 'fill_venue': {
          const place = world.places.find((p) => p.id === 'v-candil') ?? world.places[0]!
          const stats = {
            ...place.stats,
            people: place.stats.people + 25,
            averageAge: 27,
            greenPercent: 60,
            ratio: { women: 50, men: 45, other: 5 },
          }
          world.places = world.places.map((p) => (p.id === place.id ? { ...p, stats } : p))
          emit(world, { type: 'stats', placeId: place.id, stats })
          return place.name
        }
        case 'test_like_me': {
          const person = world.people.find(
            (p) =>
              isMutuallyCompatible(world.me, p, world.blocked) &&
              !world.matches.some((m) => m.person.id === p.id),
          )
          if (!person) return 'none'
          const match: Match = {
            id: `m-${person.id}`,
            person,
            context: contextFor(world, person),
            createdAt: new Date().toISOString(),
          }
          world.matches.unshift(match)
          emit(world, { type: 'match', match })
          return person.name
        }
        case 'send_test_messages': {
          const match = world.matches[0]
          if (!match) return 'none'
          const message = {
            id: crypto.randomUUID(),
            matchId: match.id,
            fromMe: false,
            text: '👋 Mensaje de prueba',
            sentAt: new Date().toISOString(),
            readAt: null,
          }
          world.messages.push(message)
          emit(world, { type: 'message', message })
          return match.person.name
        }
        case 'simulate_stripe_webhook':
          await premium.completeTestPurchase('vip_monthly')
          return 'vip_monthly'
        case 'simulate_yoti_webhook':
          await store.update((s) => ({
            ...s,
            verification: {
              ...s.verification,
              age: {
                state: 'verified',
                method: 'facial_estimation',
                thresholdUsed: 21,
                verifiedAt: new Date().toISOString(),
              },
            },
          }))
          return 'age'
        case 'expire_everything':
          world.places = world.places.map((p) =>
            isEvent(p) && p.event.status === 'unconfirmed'
              ? {
                  ...p,
                  event: {
                    ...p.event,
                    createdAt: new Date(Date.now() - 25 * 3_600_000).toISOString(),
                  },
                }
              : p,
          )
          world.attendance = { ...world.attendance, checkIn: null, going: null }
          world.lostFound = world.lostFound.map((p) => ({
            ...p,
            createdAt: new Date(Date.now() - 49 * 3_600_000).toISOString(),
          }))
          return 'ok'
        case 'import_events':
          return 'disabled'
        case 'reset_likes':
          world.likesUsed = 0
          return 'ok'
        case 'simulate_suspension':
          config.suspended = true
          return 'ok'
        case 'purge_test_data':
          world.matches = []
          world.messages = []
          world.liked.clear()
          world.passed = []
          return 'ok'
        case 'generate_test_city':
          return `${world.places.length} / ${world.people.length}`
      }
    },
    async setSimulatedRoles(roles) {
      await wait()
      config.roles = [...roles]
      audit(config, 'roles.simulate', roles.join(', '))
    },
    mode: 'mock',
    mfaStatus: () => Promise.resolve({ enrolled: true, verified: config.mfaOk }),
    enrollMfa: () => Promise.resolve({ qrCode: '', secret: 'MOCK-TOTP-SECRET', uri: '' }),
    async verifyMfa(code) {
      await wait()
      config.mfaOk = code === '123456'
      if (config.mfaOk) audit(config, 'admin.mfa', 'TOTP ok')
      return config.mfaOk
    },
  }
}
