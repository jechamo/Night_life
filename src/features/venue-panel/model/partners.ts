import { z } from 'zod'

/**
 * Roadmap R3 «Partners y contratos»: the company behind a venue, its offline contract and
 * the advantages it grants, one-time invitations and the venue team. Mirrors the server
 * (`private.venue_*` tables); every value from the network is parsed here.
 */
export const CONTRACT_TIERS = ['none', 'featured', 'featured_plus', 'top'] as const
export type ContractTier = (typeof CONTRACT_TIERS)[number]
export const BENEFIT_KEYS = [
  'sponsor_featured',
  'sponsor_featured_plus',
  'sponsor_top',
  'pro_stats',
] as const
export type VenueBenefitKey = (typeof BENEFIT_KEYS)[number]
export const BENEFIT_SOURCES = ['contract', 'stripe', 'invoice'] as const
export type BenefitSource = (typeof BENEFIT_SOURCES)[number]
export type ManagerRole = 'owner' | 'staff'

/** Spanish CIF, NIF or NIE (same expression as the database check). */
export const TAX_ID_RE = /^([ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]|[0-9]{8}[A-Z]|[XYZ][0-9]{7}[A-Z])$/
export const normalizeTaxId = (value: string) => value.toUpperCase().replace(/[^A-Z0-9]/g, '')
export const isTaxId = (value: string) => TAX_ID_RE.test(normalizeTaxId(value))

/** Invitation codes look like `3F9A-0C21-B7D4`. */
export const INVITE_CODE_RE = /^[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/
export function normalizeInviteCode(value: string): string {
  const raw = value.toUpperCase().replace(/[^0-9A-Z]/g, '')
  return raw.length === 12 ? `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8)}` : raw
}
export const isInviteCode = (value: string) => INVITE_CODE_RE.test(normalizeInviteCode(value))

const role = z.enum(['owner', 'staff'])
const date = z.string().min(1)

export const invitationSchema = z.object({
  id: z.string(),
  code: z.string(),
  expiresAt: z.string(),
  role,
})
export type Invitation = z.infer<typeof invitationSchema>

const contractSchema = z.object({
  id: z.string(),
  reference: z.string(),
  tier: z.enum(CONTRACT_TIERS),
  pro: z.boolean(),
  startsOn: date,
  endsOn: date,
  termsVersion: z.string(),
  status: z.enum(['draft', 'active', 'ended']),
})
export type PartnerContract = z.infer<typeof contractSchema>

const partnerVenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string().nullable().catch(null),
  managers: z.array(
    z.object({
      userId: z.string(),
      name: z.string().nullable().catch(null),
      role,
      since: z.string(),
    }),
  ),
  invitations: z.array(
    z.object({
      id: z.string(),
      role,
      expiresAt: z.string(),
      status: z.enum(['pending', 'used', 'revoked', 'expired']),
    }),
  ),
})
export type PartnerVenue = z.infer<typeof partnerVenueSchema>

export const partnerAccountSchema = z.object({
  id: z.string(),
  legalName: z.string(),
  taxId: z.string(),
  contactName: z.string(),
  billingEmail: z.string(),
  contactPhone: z.string().nullable().catch(null),
  notes: z.string().nullable().catch(null),
  status: z.enum(['active', 'ended']),
  isTest: z.boolean(),
  createdAt: z.string(),
  venues: z.array(partnerVenueSchema),
  contracts: z.array(contractSchema),
})
export type PartnerAccount = z.infer<typeof partnerAccountSchema>

export interface PartnerInput {
  id?: string
  legalName: string
  taxId: string
  contactName: string
  billingEmail: string
  contactPhone: string
  notes: string
  isTest: boolean
  status?: 'active' | 'ended'
}

export interface ContractInput {
  accountId: string
  reference: string
  tier: ContractTier
  pro: boolean
  startsOn: string
  endsOn: string
}

const benefitSchema = z.object({
  key: z.enum(BENEFIT_KEYS),
  source: z.enum(BENEFIT_SOURCES),
  from: z.string().nullable().catch(null),
  until: z.string().nullable().catch(null),
})
export type VenueBenefit = z.infer<typeof benefitSchema>

export const venuePartnerStateSchema = z.object({
  role: role.nullable().catch(null),
  account: z.object({ legalName: z.string() }).nullable().catch(null),
  contract: z
    .object({
      reference: z.string(),
      tier: z.enum(CONTRACT_TIERS),
      pro: z.boolean(),
      startsOn: date,
      endsOn: date,
    })
    .nullable()
    .catch(null),
  // Unknown benefit keys or sources (future server versions) are dropped, not fatal.
  benefits: z
    .array(z.unknown())
    .catch([])
    .transform((items) =>
      items.flatMap((item) => {
        const parsed = benefitSchema.safeParse(item)
        return parsed.success ? [parsed.data] : []
      }),
    ),
  termsCurrent: z.string().nullable().catch(null),
  termsAccepted: z.boolean().catch(false),
})
export type VenuePartnerState = z.infer<typeof venuePartnerStateSchema>

export const venueTeamSchema = z.object({
  members: z.array(
    z.object({
      userId: z.string(),
      name: z.string(),
      role,
      since: z.string(),
      me: z.boolean(),
    }),
  ),
  invitations: z.array(z.object({ id: z.string(), role, expiresAt: z.string() })),
})
export type VenueTeam = z.infer<typeof venueTeamSchema>

export const invitePreviewSchema = z.object({
  venueName: z.string(),
  city: z.string().nullable().catch(null),
  role,
  accountName: z.string().nullable().catch(null),
  alreadyManager: z.boolean(),
  termsVersion: z.string().nullable().catch(null),
})
export type InvitePreview = z.infer<typeof invitePreviewSchema>
