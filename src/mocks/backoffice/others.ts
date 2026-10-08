import type { ModerationService } from '@/features/moderation/services/moderation-service'
import type { PrivacyService } from '@/features/privacy/services/privacy-service'
import type { SafetyService, EmergencyContact } from '@/features/safety/services/safety-service'
import type {
  ManagedVenue,
  VenuePanelService,
} from '@/features/venue-panel/services/venue-panel-service'
import { err, ok } from '@/shared/lib/result'
import type { MockStore } from '../mock-store'
import { liveStatusOf, type WorldState } from '../world/world-state'
import { normalizeInviteCode } from '@/features/venue-panel/model/partners'
import { MOCK_LEGAL_VERSION } from '../legal-documents.mock'
import { audit, type MockConfig } from './config'
import { createMockShowcasePanel } from './showcase'
import {
  activeContract,
  contractBenefits,
  createInvitation,
  invitationStatus,
  ME,
} from './partners'

type Wait = () => Promise<void>

export function createMockVenuePanelService(
  world: WorldState,
  config: MockConfig,
  wait: Wait,
  store?: MockStore,
): VenuePanelService {
  const partners = config.partners
  const requirePartners = () => {
    if (config.flags.venue_partners_enabled !== 'on') throw new Error('disabled')
  }
  const termsAccepted = async () =>
    !!store && (await store.read()).signed.some((d) => d.slug === 'venues')
  const myRole = (placeId: string) =>
    partners.managers[placeId]?.find((m) => m.userId === ME)?.role ?? null
  const requireOwner = (placeId: string) => {
    requirePartners()
    if (myRole(placeId) !== 'owner') throw new Error('forbidden')
  }
  /** Contract sponsorships show up like any active sponsorship (as on the server). */
  const withContract = (venue: ManagedVenue): ManagedVenue => {
    const contract = activeContract(partners, venue.placeId)
    return contract && contract.tier !== 'none'
      ? {
          ...venue,
          sponsorship: {
            tier: contract.tier,
            status: 'active',
            from: contract.startsOn,
            to: contract.endsOn,
          },
        }
      : venue
  }
  const venueFrom = (
    placeId: string,
    claimStatus: ManagedVenue['claimStatus'],
  ): ManagedVenue | null => {
    const place = world.places.find((p) => p.id === placeId)
    return place
      ? {
          placeId,
          name: place.name,
          claimStatus,
          description: '',
          hours: place.hours,
          price: place.price ?? 2,
          sponsorship: null,
        }
      : null
  }
  let venues: ManagedVenue[] = [venueFrom('v-cobalto', 'approved')!]
  const replace = (placeId: string, fn: (v: ManagedVenue) => ManagedVenue) => {
    venues = venues.map((v) => (v.placeId === placeId ? fn(v) : v))
    return venues.find((v) => v.placeId === placeId)!
  }
  return {
    ...createMockShowcasePanel(config, world, wait),
    myVenues: () => Promise.resolve(venues.map(withContract)),
    createFlashAlert: () => Promise.resolve(),
    async setMusic(placeId, genres, lineup) {
      await wait()
      world.declaredMusic.set(placeId, { genres: [...genres], lineup: lineup.trim() || null })
      world.places = world.places.map((p) =>
        p.id === placeId ? { ...p, music: [...new Set(genres)].sort() } : p,
      )
      return liveStatusOf(world, placeId)
    },
    flashAlerts: () => Promise.resolve([]),
    async claim(placeId, evidence) {
      await wait()
      if (config.flags.venue_partners_enabled === 'on' && !(await termsAccepted()))
        return err('terms_required')
      if (venues.some((v) => v.placeId === placeId)) return err('already_claimed')
      const venue = venueFrom(placeId, 'pending')
      if (!venue) return err('already_claimed')
      venues = [...venues, venue]
      config.rows.claims.unshift({
        id: `cl-${placeId}`,
        title: venue.name,
        subtitle: `Prueba: ${evidence.slice(0, 80)}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        facts: ['venue_manager'],
      })
      return ok(venue)
    },
    async update(placeId, patch) {
      await wait()
      world.places = world.places.map((p) =>
        p.id === placeId
          ? {
              ...p,
              ...(patch.hours ? { hours: patch.hours } : {}),
              ...(patch.price ? { price: patch.price } : {}),
            }
          : p,
      )
      return replace(placeId, (v) => ({ ...v, ...patch }))
    },
    async stats(placeId) {
      await wait()
      const place = world.places.find((p) => p.id === placeId)
      const peak = Math.max(place?.stats.people ?? 0, 8)
      const curve = [0.05, 0.1, 0.2, 0.35, 0.55, 0.8, 1, 0.85, 0.5, 0.2]
      return {
        byHour: curve.map((c, i) => ({ hour: (20 + i) % 24, people: Math.round(peak * c) })),
        averageAge: place && place.stats.people >= 5 ? place.stats.averageAge : null,
        greenPercent: place && place.stats.people >= 5 ? place.stats.greenPercent : null,
        checkInsWeek: peak * 6,
        goingTonight: place?.stats.goingTonight ?? 0,
      }
    },
    async requestSponsorship(placeId, tier, from, to) {
      await wait()
      const venue = replace(placeId, (v) => ({
        ...v,
        sponsorship: { tier, status: 'requested', from, to },
      }))
      config.rows.sponsorships.unshift({
        id: `sp-${placeId}`,
        title: venue.name,
        subtitle: `${tier} · ${from} → ${to} · factura pendiente`,
        status: 'requested',
        createdAt: new Date().toISOString(),
        facts: [tier],
      })
      return venue
    },
    async createOfficialEvent(placeId, input) {
      await wait()
      const place = world.places.find((p) => p.id === placeId)
      if (!place) return
      world.places.push({
        ...place,
        id: `e-${crypto.randomUUID()}`,
        name: input.title,
        type: 'event',
        sponsored: false,
        stats: { people: 0, averageAge: null, greenPercent: null, ratio: null, goingTonight: 0 },
        event: {
          status: 'official',
          origin: 'venue',
          startsAt: input.startsAt,
          endsAt: input.endsAt,
          createdAt: new Date().toISOString(),
          confirmations: 0,
          fakeReports: 0,
          description: input.description,
        },
      })
    },
    async partnerState(placeId) {
      await wait()
      requirePartners()
      const accountId = partners.links[placeId]
      const account = partners.accounts.find((a) => a.id === accountId)
      const contract = activeContract(partners, placeId)
      const venue = venues.find((v) => v.placeId === placeId)
      const fromContract = contractBenefits(partners, placeId)
      const invoice =
        venue?.sponsorship?.status === 'active' && !fromContract.some((b) => b.key !== 'pro_stats')
          ? [
              {
                key: `sponsor_${venue.sponsorship.tier}` as const,
                source: 'invoice' as const,
                from: venue.sponsorship.from,
                until: venue.sponsorship.to,
              },
            ]
          : []
      return {
        role: myRole(placeId),
        account: account ? { legalName: account.legalName } : null,
        contract: contract
          ? {
              reference: contract.reference,
              tier: contract.tier,
              pro: contract.pro,
              startsOn: contract.startsOn,
              endsOn: contract.endsOn,
            }
          : null,
        benefits: [...fromContract, ...invoice],
        termsCurrent: MOCK_LEGAL_VERSION,
        termsAccepted: await termsAccepted(),
      }
    },
    async team(placeId) {
      await wait()
      requireOwner(placeId)
      return {
        members: (partners.managers[placeId] ?? []).map((m) => ({ ...m, me: m.userId === ME })),
        invitations: partners.invitations
          .filter((i) => i.venueId === placeId && invitationStatus(i) === 'pending')
          .map(({ id, role, expiresAt }) => ({ id, role, expiresAt })),
      }
    },
    async inviteStaff(placeId) {
      await wait()
      requireOwner(placeId)
      const pending = partners.invitations.filter(
        (i) => i.venueId === placeId && invitationStatus(i) === 'pending',
      )
      if (pending.length >= 5) return err('team_limit')
      const { id, code, expiresAt, role } = createInvitation(partners, placeId, 'staff')
      audit(config, 'invite.staff', placeId)
      return ok({ id, code, expiresAt, role })
    },
    async cancelInvite(placeId, inviteId) {
      await wait()
      requireOwner(placeId)
      const invitation = partners.invitations.find(
        (i) => i.id === inviteId && i.venueId === placeId && i.role === 'staff',
      )
      if (!invitation) throw new Error('not found')
      invitation.revokedAt = new Date().toISOString()
    },
    async removeManager(placeId, userId) {
      await wait()
      requireOwner(placeId)
      if (userId === ME) throw new Error('forbidden')
      partners.managers[placeId] = (partners.managers[placeId] ?? []).filter(
        (m) => !(m.userId === userId && m.role === 'staff'),
      )
    },
    async previewInvite(code) {
      await wait()
      requirePartners()
      const invitation = partners.invitations.find(
        (i) => i.code === normalizeInviteCode(code) && invitationStatus(i) === 'pending',
      )
      const place = invitation && world.places.find((p) => p.id === invitation.venueId)
      if (!invitation || !place) return err('invalid_code')
      return ok({
        venueName: place.name,
        city: place.city ?? null,
        role: invitation.role,
        accountName:
          partners.accounts.find((a) => a.id === invitation.accountId)?.legalName ?? null,
        alreadyManager: myRole(invitation.venueId) !== null,
        termsVersion: MOCK_LEGAL_VERSION,
      })
    },
    async redeemInvite(code, acceptTerms) {
      await wait()
      requirePartners()
      const invitation = partners.invitations.find(
        (i) => i.code === normalizeInviteCode(code) && invitationStatus(i) === 'pending',
      )
      if (!invitation) return err('invalid_code')
      const placeId = invitation.venueId
      if (myRole(placeId) !== null) return err('already_manager')
      if (!acceptTerms) return err('terms_required')
      invitation.usedAt = new Date().toISOString()
      partners.managers[placeId] = [
        ...(partners.managers[placeId] ?? []),
        { userId: ME, name: 'Tú', role: invitation.role, since: invitation.usedAt },
      ]
      await store?.update((s) => ({
        ...s,
        signed: [
          ...s.signed.filter((d) => d.slug !== 'venues'),
          { slug: 'venues', version: MOCK_LEGAL_VERSION, signedAt: invitation.usedAt! },
        ],
      }))
      if (!venues.some((v) => v.placeId === placeId)) {
        const venue = venueFrom(placeId, 'approved')
        if (venue) venues = [...venues, venue]
      } else
        venues = venues.map((v) => (v.placeId === placeId ? { ...v, claimStatus: 'approved' } : v))
      if (!config.roles.includes('venue_manager')) config.roles.push('venue_manager')
      audit(config, 'invite.redeem', placeId)
      return ok({ placeId, role: invitation.role })
    },
  }
}

export function createMockPrivacyService(
  world: WorldState,
  store: MockStore,
  config: MockConfig,
  wait: Wait,
): PrivacyService {
  const requests = [] as Awaited<ReturnType<PrivacyService['requests']>>
  return {
    async exportMyData() {
      await wait()
      const due = new Date(Date.now() + 30 * 86_400_000).toISOString()
      requests.unshift({
        id: crypto.randomUUID(),
        kind: 'export',
        createdAt: new Date().toISOString(),
        dueAt: due,
        status: 'done',
      })
      const s = await store.read()
      // Everything we hold about the user, machine-readable (GDPR art. 15/20).
      return {
        exportedAt: new Date().toISOString(),
        profile: world.me,
        verification: s.verification,
        consents: s.consents,
        signedDocuments: s.signed,
        attendance: world.attendance,
        matches: world.matches.map((m) => ({
          id: m.id,
          with: m.person.name,
          createdAt: m.createdAt,
        })),
        messagesSent: world.messages
          .filter((m) => m.fromMe)
          .map(({ text, sentAt }) => ({ text, sentAt })),
        premium: { subscription: config.premium.subscription, invoices: config.premium.invoices },
      }
    },
    requestRight: async (kind) => {
      await wait()
      requests.unshift({
        id: crypto.randomUUID(),
        kind,
        createdAt: new Date().toISOString(),
        dueAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        status: 'open',
      })
    },
    requests: () => Promise.resolve([...requests]),
    requestDeletionCode: () => wait(),
    async deleteAccount(otp) {
      await wait()
      if (otp !== '123456') return err('wrong_code')
      // Active subscriptions are cancelled before erasure (PRD 6.12 G).
      config.premium.subscription = null
      world.matches = []
      world.messages = []
      await store.update((s) => ({
        ...s,
        onboarded: false,
        signed: [],
        verification: {
          age: { state: 'not_started' },
          photo: { state: 'not_started' },
          identity: { state: 'not_started' },
        },
      }))
      audit(config, 'account.delete', 'self-service')
      return ok(undefined)
    },
    async logoutEverywhere() {
      await wait()
    },
  }
}

export function createMockModerationService(config: MockConfig, wait: Wait): ModerationService {
  return {
    myReports: () => Promise.resolve([...config.myReports]),
    decisions: () => Promise.resolve(config.decisions.map((d) => ({ ...d }))),
    async appeal(decisionId, text) {
      await wait()
      const decision = config.decisions.find((d) => d.id === decisionId)
      if (!decision || decision.appeal) return err('already_appealed')
      decision.appeal = { status: 'pending', text }
      config.rows.appeals.unshift({
        id: `ap-${decisionId}`,
        title: 'Tú',
        subtitle: `«${text.slice(0, 80)}»`,
        status: 'pending',
        createdAt: new Date().toISOString(),
        facts: [decision.action],
      })
      return ok({ ...decision })
    },
    async submitIllegalContentNotice({ url, reason }) {
      await wait()
      const id = `DSA-${Date.now().toString(36).toUpperCase()}`
      config.rows.reports.unshift({
        id,
        title: `Aviso DSA ${id}`,
        subtitle: `${reason} · ${url.slice(0, 60)}`,
        status: 'open',
        createdAt: new Date().toISOString(),
        facts: ['dsa_notice'],
      })
      return id
    },
    accountStatus: () => Promise.resolve(config.suspended ? 'suspended' : 'active'),
  }
}

export function createMockSafetyService(wait: Wait): SafetyService {
  let contacts: EmergencyContact[] = []
  return {
    contacts: () => Promise.resolve([...contacts]),
    async saveContacts(next) {
      await wait()
      contacts = next.slice(0, 3).map((c) => ({ ...c, id: crypto.randomUUID() }))
      return [...contacts]
    },
  }
}
