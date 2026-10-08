import type {
  Invitation,
  ManagerRole,
  PartnerAccount,
  PartnerContract,
  VenueBenefit,
} from '@/features/venue-panel/model/partners'

/**
 * Simulated R3 back-office shared by the mock admin and the mock venue panel: companies,
 * contracts, links, invitations and teams. `me` is the signed-in simulated person.
 */
export const ME = 'me'

export interface MockManager {
  userId: string
  name: string
  role: ManagerRole
  since: string
}

export interface MockInvitation extends Invitation {
  venueId: string
  accountId: string | null
  usedAt: string | null
  revokedAt: string | null
}

export interface MockPartnerState {
  accounts: Omit<PartnerAccount, 'venues' | 'contracts'>[]
  contracts: (PartnerContract & { accountId: string })[]
  /** venueId → accountId */
  links: Record<string, string>
  invitations: MockInvitation[]
  /** venueId → managers */
  managers: Record<string, MockManager[]>
}

export function createMockPartnerState(): MockPartnerState {
  return {
    accounts: [],
    contracts: [],
    links: {},
    invitations: [],
    // Bar Cobalto is managed by the simulated person since Block 4 (now as owner).
    managers: {
      'v-cobalto': [{ userId: ME, name: 'Tú', role: 'owner', since: new Date().toISOString() }],
    },
  }
}

const today = () => new Date().toISOString().slice(0, 10)

export function newInviteCode(): string {
  const hex = Array.from({ length: 12 }, () => '0123456789ABCDEF'[Math.floor(Math.random() * 16)])
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 8).join('')}-${hex.slice(8).join('')}`
}

export function createInvitation(
  state: MockPartnerState,
  venueId: string,
  role: ManagerRole,
): MockInvitation {
  const invitation: MockInvitation = {
    id: `inv-${crypto.randomUUID()}`,
    code: newInviteCode(),
    venueId,
    accountId: state.links[venueId] ?? null,
    role,
    expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
    usedAt: null,
    revokedAt: null,
  }
  state.invitations.unshift(invitation)
  return invitation
}

export const invitationStatus = (i: MockInvitation) =>
  i.usedAt
    ? ('used' as const)
    : i.revokedAt
      ? ('revoked' as const)
      : Date.parse(i.expiresAt) <= Date.now()
        ? ('expired' as const)
        : ('pending' as const)

/** Active contract of the company a venue belongs to (if any). */
export function activeContract(state: MockPartnerState, venueId: string) {
  const accountId = state.links[venueId]
  return accountId
    ? state.contracts.find(
        (c) =>
          c.accountId === accountId &&
          c.status === 'active' &&
          c.startsOn <= today() &&
          c.endsOn >= today(),
      )
    : undefined
}

export function contractBenefits(state: MockPartnerState, venueId: string): VenueBenefit[] {
  const contract = activeContract(state, venueId)
  if (!contract) return []
  const benefits: VenueBenefit[] = []
  if (contract.tier !== 'none')
    benefits.push({
      key: `sponsor_${contract.tier}`,
      source: 'contract',
      from: contract.startsOn,
      until: contract.endsOn,
    })
  if (contract.pro)
    benefits.push({
      key: 'pro_stats',
      source: 'contract',
      from: contract.startsOn,
      until: contract.endsOn,
    })
  return benefits
}
