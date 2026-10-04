import type { AdminRow, AdminSection, AdminSetting } from '@/features/admin/services/admin-service'
import type {
  ModerationDecision,
  MyReport,
} from '@/features/moderation/services/moderation-service'
import type { PremiumState } from '@/features/premium/services/premium-service'
import type { Entitlement } from '@/shared/entitlements/entitlements'
import type { FeatureFlags } from '@/shared/flags/flags'
import type { Role } from '@/shared/session/roles'

/**
 * Mutable simulated back-office (Blocks 1-4): flags, roles, entitlements, settings and
 * the audit log live here so the admin panel can change them at runtime and the app
 * reacts (PRD 11.2 Block 4: "el paywall cambia según los flags simulados").
 */
export interface MockConfig {
  flags: FeatureFlags
  roles: Role[]
  entitlements: Entitlement[]
  settings: AdminSetting[]
  premium: PremiumState
  promoCodes: {
    code: string
    productCode: string
    days: number
    maxUses: number
    uses: number
    expiresAt: string
  }[]
  redeemAttempts: number
  rows: Record<
    Exclude<
      AdminSection,
      'audit' | 'events' | 'subscriptions' | 'entitlements' | 'promoCodes' | 'users'
    >,
    AdminRow[]
  >
  audit: AdminRow[]
  myReports: MyReport[]
  decisions: ModerationDecision[]
  suspended: boolean
  mfaOk: boolean
}

const ago = (h: number) => new Date(Date.now() - h * 3_600_000).toISOString()
const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString()

export function createMockConfig(
  flags: FeatureFlags,
  roles: readonly Role[],
  entitlements: readonly Entitlement[],
): MockConfig {
  return {
    flags: { ...flags },
    roles: [...roles],
    entitlements: [...entitlements],
    settings: [
      { key: 'free_daily_likes', value: 5, min: 1, max: 50 },
      { key: 'age_threshold', value: 21, min: 18, max: 25 },
      { key: 'check_in_radius_m', value: 150, min: 50, max: 300 },
      { key: 'stats_min_people', value: 5, min: 5, max: 20 },
      { key: 'event_confirmations', value: 3, min: 2, max: 10 },
      { key: 'reports_strike_window_h', value: 6, min: 1, max: 48 },
      { key: 'sponsorship_slots', value: 3, min: 1, max: 10 },
    ],
    premium: {
      subscription: null,
      oneNightUntil: null,
      credits: { spark: 0, spotlight: 0, paid_dm: 0 },
      invoices: [],
      notifyMe: false,
    },
    promoCodes: [
      {
        code: 'NITE-TEST-0001',
        productCode: 'vip_monthly',
        days: 7,
        maxUses: 100,
        uses: 3,
        expiresAt: inDays(30),
      },
    ],
    redeemAttempts: 0,
    rows: {
      escalations: [],
      verifications: [
        {
          id: 'vr-1',
          title: 'Usuario #4821',
          subtitle: 'Foto verificada · coincidencia 72 %',
          status: 'pending',
          createdAt: ago(2),
          facts: ['borderline'],
        },
        {
          id: 'vr-2',
          title: 'Usuario #1177',
          subtitle: 'Mayoría de edad · revisión pedida por el usuario',
          status: 'pending',
          createdAt: ago(5),
          facts: ['requested'],
        },
        {
          id: 'vr-3',
          title: 'Usuario #9302',
          subtitle: 'Reporte «posible menor» · suspensión cautelar',
          status: 'pending',
          createdAt: ago(1),
          facts: ['possible_minor', 'urgent'],
        },
      ],
      reports: [
        {
          id: 'rp-1',
          title: 'Usuario #5510',
          subtitle: '3 reportes válidos en 6 h · acoso',
          status: 'open',
          createdAt: ago(1),
          facts: ['3 strikes', 'auto-suspended'],
        },
        {
          id: 'rp-2',
          title: 'Usuario #2048',
          subtitle: '1 reporte · perfil falso',
          status: 'open',
          createdAt: ago(9),
          facts: ['fake_profile'],
        },
        {
          id: 'rp-3',
          title: 'Evento «Fiesta techno en el Almacén»',
          subtitle: '1 reporte · falso',
          status: 'open',
          createdAt: ago(3),
          facts: ['event'],
        },
      ],
      appeals: [
        {
          id: 'ap-1',
          title: 'Usuario #3391',
          subtitle: '«La suspensión fue un error, no era yo»',
          status: 'pending',
          createdAt: ago(20),
          facts: ['suspension'],
        },
      ],
      bans: [
        {
          id: 'bn-1',
          title: 'HMAC tel. 9f3a…c21e',
          subtitle: 'Acoso reiterado · permanente',
          status: 'active',
          createdAt: ago(240),
          facts: ['phone', 'device'],
        },
      ],
      claims: [
        {
          id: 'cl-1',
          title: 'Pub Candil',
          subtitle: 'Solicitante: Gestión Candil S.L. · factura de luz adjunta',
          status: 'pending',
          createdAt: ago(30),
          facts: ['venue_manager'],
        },
      ],
      sponsorships: [
        {
          id: 'sp-1',
          title: 'Club Órbita',
          subtitle: 'Destacado Plus · 1-31 oct · factura F-2026-014',
          status: 'active',
          createdAt: ago(48),
          facts: ['featured_plus'],
        },
      ],
      paymentEvents: [],
      dataRequests: [
        {
          id: 'dr-1',
          title: 'Usuario #7710',
          subtitle: 'Exportación de datos',
          status: 'open',
          createdAt: ago(72),
          facts: [`vence ${inDays(27).slice(0, 10)}`],
        },
      ],
      legalDocs: [
        ...[
          'legal_notice',
          'terms',
          'community',
          'privacy',
          'cookies',
          'ranking',
          'venues',
          'sponsorship',
          'third_parties',
        ].map((slug) => ({
          id: slug,
          title: slug,
          subtitle: 'v1.0 · borrador para revisión legal',
          status: 'active',
          createdAt: ago(48),
          facts: ['ES', 'EN'],
        })),
        {
          id: 'premium',
          title: 'premium',
          subtitle: 'v1.0 · se publica al activar los pagos',
          status: 'inactive',
          createdAt: ago(48),
          facts: ['ES', 'EN'],
        },
      ],
    },
    audit: [],
    myReports: [],
    decisions: [
      {
        id: 'dc-1',
        action: 'warning',
        reason: 'community_guidelines',
        explanation:
          'Un mensaje tuyo fue reportado por insistir tras un «no». Te recordamos las Normas de la Comunidad. No hay más consecuencias.',
        createdAt: ago(30),
        appeal: null,
      },
    ],
    suspended: false,
    mfaOk: false,
  }
}

export function audit(config: MockConfig, action: string, detail: string) {
  config.audit.unshift({
    id: crypto.randomUUID(),
    title: action,
    subtitle: detail,
    status: 'logged',
    createdAt: new Date().toISOString(),
    facts: ['admin@test'],
  })
}
