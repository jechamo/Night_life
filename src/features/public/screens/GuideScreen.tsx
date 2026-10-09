import {
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChartColumn,
  Check,
  CreditCard,
  Gift,
  Heart,
  KeyRound,
  Lock,
  MapPin,
  Megaphone,
  MoonStar,
  Scale,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  UserRound,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import {
  formatPrice,
  productByCode,
  VENUE_PRICES,
  type ProductCode,
} from '@/features/premium/model/catalog'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { cn } from '@/shared/lib/cn'
import {
  EVENT_COVERS,
  SCENES,
  VENUE_COVERS,
  type IllustrationName,
  type ImageAsset,
} from '@/shared/images/catalog'
import { Illustration } from '@/shared/images/Illustration'
import { ThemeSignature } from '@/shared/images/ThemeSignature'
import { TintedScene } from '@/shared/images/TintedScene'
import { ButtonLink } from '@/shared/ui/button'
import { GlassCard } from '@/shared/ui/card'

/** Artwork already bundled with the app: venue/event covers, tinted scenes, clay figures. */
type SectionArt =
  | { kind: 'cover'; image: ImageAsset }
  | { kind: 'scene'; image: ImageAsset }
  | { kind: 'illustration'; name: IllustrationName }

interface GuideSectionDef {
  id: string
  title: string
  icon: LucideIcon
  art?: SectionArt
  items: readonly string[]
}

/**
 * Public guides (roadmap R1): what the app offers to people and to venues. They live in
 * the public website, so anyone can read them without an account. The copy describes
 * only what exists today; it is updated in every block that adds features.
 */
const USER_GUIDE = [
  {
    title: 'guide.user.sections.discover.title',
    id: 'discover',
    icon: MapPin,
    art: { kind: 'cover', image: VENUE_COVERS.club },
    items: [
      'guide.user.sections.discover.items.map',
      'guide.user.sections.discover.items.stats',
      'guide.user.sections.discover.items.search',
      'guide.user.sections.discover.items.place',
      'guide.user.sections.discover.items.venueSays',
      'guide.user.sections.discover.items.bookings',
    ],
  },
  {
    title: 'guide.user.sections.tonight.title',
    id: 'tonight',
    icon: MoonStar,
    art: { kind: 'cover', image: EVENT_COVERS.techno },
    items: [
      'guide.user.sections.tonight.items.going',
      'guide.user.sections.tonight.items.here',
      'guide.user.sections.tonight.items.swipe',
    ],
  },
  {
    title: 'guide.user.sections.dating.title',
    id: 'dating',
    icon: Heart,
    art: { kind: 'illustration', name: 'emptyChats' },
    items: [
      'guide.user.sections.dating.items.match',
      'guide.user.sections.dating.items.light',
      'guide.user.sections.dating.items.discreet',
      'guide.user.sections.dating.items.control',
    ],
  },
  {
    title: 'guide.user.sections.verification.title',
    id: 'verification',
    icon: BadgeCheck,
    art: { kind: 'illustration', name: 'verification' },
    items: [
      'guide.user.sections.verification.items.phone',
      'guide.user.sections.verification.items.age',
      'guide.user.sections.verification.items.badges',
    ],
  },
  {
    title: 'guide.user.sections.safety.title',
    id: 'safety',
    icon: ShieldCheck,
    art: { kind: 'scene', image: SCENES.safe },
    items: [
      'guide.user.sections.safety.items.sos',
      'guide.user.sections.safety.items.report',
      'guide.user.sections.safety.items.rules',
    ],
  },
  {
    title: 'guide.user.sections.events.title',
    id: 'events',
    icon: CalendarDays,
    art: { kind: 'cover', image: EVENT_COVERS.concert },
    items: [
      'guide.user.sections.events.items.create',
      'guide.user.sections.events.items.confirm',
      'guide.user.sections.events.items.vibe',
      'guide.user.sections.events.items.lost',
      'guide.user.sections.events.items.live',
    ],
  },
  {
    title: 'guide.user.sections.free.title',
    id: 'free',
    icon: Gift,
    items: [
      'guide.user.sections.free.items.core',
      'guide.user.sections.free.items.people',
      'guide.user.sections.free.items.trust',
      'guide.user.sections.free.items.themes',
    ],
  },
  {
    title: 'guide.user.sections.premium.title',
    id: 'premium',
    icon: Sparkles,
    items: [
      'guide.user.sections.premium.items.pass',
      'guide.user.sections.premium.items.vip',
      'guide.user.sections.premium.items.night',
      'guide.user.sections.premium.items.extras',
      'guide.user.sections.premium.items.status',
    ],
  },
  {
    title: 'guide.user.sections.payments.title',
    id: 'payments',
    icon: CreditCard,
    items: [
      'guide.user.sections.payments.items.buy',
      'guide.user.sections.payments.items.renew',
      'guide.user.sections.payments.items.withdraw',
      'guide.user.sections.payments.items.promo',
    ],
  },
  {
    title: 'guide.user.sections.privacy.title',
    id: 'privacy',
    icon: Lock,
    art: { kind: 'illustration', name: 'location' },
    items: [
      'guide.user.sections.privacy.items.location',
      'guide.user.sections.privacy.items.consents',
      'guide.user.sections.privacy.items.data',
    ],
  },
  {
    title: 'guide.user.sections.account.title',
    id: 'account',
    icon: UserRound,
    art: { kind: 'illustration', name: 'phoneOtp' },
    items: [
      'guide.user.sections.account.items.signup',
      'guide.user.sections.account.items.login',
      'guide.user.sections.account.items.delete',
    ],
  },
] as const satisfies readonly GuideSectionDef[]

const VENUE_GUIDE = [
  {
    title: 'guide.venues.sections.access.title',
    id: 'access',
    icon: KeyRound,
    art: { kind: 'cover', image: VENUE_COVERS.bar },
    items: [
      'guide.venues.sections.access.items.claim',
      'guide.venues.sections.access.items.evidence',
      'guide.venues.sections.access.items.review',
      'guide.venues.sections.access.items.help',
      'guide.venues.sections.access.items.invite',
    ],
  },
  {
    title: 'guide.venues.sections.free.title',
    id: 'free',
    icon: Store,
    art: { kind: 'cover', image: VENUE_COVERS.lounge },
    items: [
      'guide.venues.sections.free.items.profile',
      'guide.venues.sections.free.items.events',
      'guide.venues.sections.free.items.stats',
      'guide.venues.sections.free.items.music',
      'guide.venues.sections.free.items.team',
      'guide.venues.sections.free.items.photos',
      'guide.venues.sections.free.items.live',
      'guide.venues.sections.free.items.details',
      'guide.venues.sections.free.items.report',
      'guide.venues.sections.free.items.bookings',
    ],
  },
  {
    title: 'guide.venues.sections.sponsor.title',
    id: 'sponsor',
    icon: Megaphone,
    art: { kind: 'cover', image: VENUE_COVERS.terrace },
    items: [
      'guide.venues.sections.sponsor.items.featured',
      'guide.venues.sections.sponsor.items.plus',
      'guide.venues.sections.sponsor.items.top',
      'guide.venues.sections.sponsor.items.limits',
      'guide.venues.sections.sponsor.items.contract',
    ],
  },
  {
    title: 'guide.venues.sections.pro.title',
    id: 'pro',
    icon: ChartColumn,
    items: [
      'guide.venues.sections.pro.items.detail',
      'guide.venues.sections.pro.items.privacy',
      'guide.venues.sections.pro.items.billing',
    ],
  },
  {
    title: 'guide.venues.sections.flash.title',
    id: 'flash',
    icon: Zap,
    art: { kind: 'cover', image: EVENT_COVERS.open_air },
    items: [
      'guide.venues.sections.flash.items.what',
      'guide.venues.sections.flash.items.audience',
      'guide.venues.sections.flash.items.alcohol',
    ],
  },
  {
    title: 'guide.venues.sections.rules.title',
    id: 'rules',
    icon: Scale,
    items: [
      'guide.venues.sections.rules.items.label',
      'guide.venues.sections.rules.items.data',
      'guide.venues.sections.rules.items.filters',
    ],
  },
  {
    title: 'guide.venues.sections.status.title',
    id: 'status',
    icon: Tag,
    items: ['guide.venues.sections.status.items.now', 'guide.venues.sections.status.items.refunds'],
  },
] as const satisfies readonly GuideSectionDef[]

/** Items that describe features still behind their flag (shown only once it is on). */
const LIVE_STATUS_ITEMS: readonly string[] = [
  'guide.user.sections.events.items.live',
  'guide.venues.sections.free.items.music',
]
const SHOWCASE_ITEMS: readonly string[] = [
  'guide.user.sections.discover.items.venueSays',
  'guide.venues.sections.free.items.photos',
  'guide.venues.sections.free.items.live',
  'guide.venues.sections.free.items.details',
  'guide.venues.sections.free.items.report',
]
const BOOKING_ITEMS: readonly string[] = [
  'guide.user.sections.discover.items.bookings',
  'guide.venues.sections.free.items.bookings',
]
const PARTNER_ITEMS: readonly string[] = [
  'guide.venues.sections.access.items.invite',
  'guide.venues.sections.sponsor.items.contract',
  'guide.venues.sections.free.items.team',
]

/**
 * Prices shown in the guides come from the same catalogue as the checkout, so they never
 * drift; the copy says they are testing-phase prices.
 */
function useGuideText(): (key: string) => string {
  const { t, i18n } = useTranslation()
  const money = (cents: number) => formatPrice(cents, i18n.language)
  const product = (code: ProductCode) => money(productByCode(code)?.priceCents ?? 0)
  const prices = {
    passMonthly: product('pass_monthly'),
    passQuarterly: product('pass_quarterly'),
    passAnnual: product('pass_annual'),
    vip: product('vip_monthly'),
    oneNight: product('one_night'),
    spark1: product('sparks_1'),
    spark5: product('sparks_5'),
    spark15: product('sparks_15'),
    spotlight: product('spotlight_1'),
    paidDm: product('paid_dm_1'),
    featured: money(VENUE_PRICES.featured),
    featuredPlus: money(VENUE_PRICES.featured_plus),
    top: money(VENUE_PRICES.top),
    pro: money(VENUE_PRICES.pro),
  }
  // Guide keys are listed in constants above; extra variables are ignored by the others.
  const translate = t as unknown as (key: string, options: Record<string, string>) => string
  return (key) => translate(key, prices)
}

const COVER_SIZES = '(min-width: 768px) 736px, calc(100vw - 32px)'

/** Natural-colour cover that fades into the page so overlaid text keeps AA contrast. */
function CoverArt({
  image,
  priority = false,
  soft = false,
}: {
  image: ImageAsset
  priority?: boolean
  /** Banners without text on top only need a light fade into the card. */
  soft?: boolean
}) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <img
        src={image.src}
        srcSet={image.srcSet}
        sizes={COVER_SIZES}
        width={image.width}
        height={image.height}
        alt=""
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        className="size-full object-cover"
      />
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-t to-transparent',
          soft
            ? 'from-background/70 via-transparent via-50%'
            : 'from-background from-10% via-background/85 via-40%',
        )}
      />
    </div>
  )
}

function GuideHero({
  art,
  title,
  lead,
  highlights,
}: {
  art: ReactNode
  title: string
  lead: string
  highlights: readonly { icon: LucideIcon; label: string }[]
}) {
  return (
    <header className="relative isolate mt-6 overflow-hidden rounded-theme border border-border">
      {art}
      <div className="relative flex min-h-80 flex-col justify-end p-5 pt-28 sm:p-8 sm:pt-36">
        <h1 className="text-3xl leading-tight font-semibold sm:text-4xl">{title}</h1>
        <p className="mt-2 max-w-prose text-muted-foreground">{lead}</p>
        <ul className="mt-4 flex flex-wrap gap-2">
          {highlights.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-sm"
            >
              <Icon className="size-4 text-primary" aria-hidden />
              {label}
            </li>
          ))}
        </ul>
      </div>
    </header>
  )
}

/** Visual index: one tile per section, jumping to it on the same page. */
function GuideContents({
  sections,
}: {
  sections: readonly { id: string; title: string; icon: LucideIcon }[]
}) {
  const { t } = useTranslation()
  return (
    <nav aria-label={t('guide.contents')} className="mt-6">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
        {sections.map(({ id, title, icon: Icon }) => (
          <li key={id}>
            <a
              href={`#guide-${id}`}
              className="glass flex h-full items-center gap-2 rounded-theme p-3 text-sm font-medium transition-opacity hover:opacity-80"
            >
              <Icon className="size-4 shrink-0 text-primary" aria-hidden />
              {title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

function GuideSection({
  id,
  title,
  icon: Icon,
  art,
  items,
}: {
  id: string
  title: string
  icon: LucideIcon
  art?: SectionArt
  items: string[]
}) {
  const headingId = `guide-${id}-title`
  return (
    <section id={`guide-${id}`} aria-labelledby={headingId} className="mt-6 scroll-mt-4">
      <GlassCard className="overflow-hidden p-0">
        {art && art.kind !== 'illustration' && (
          <div className="relative aspect-[16/7] bg-surface-raised sm:aspect-[16/5]">
            {art.kind === 'cover' ? (
              <CoverArt image={art.image} soft />
            ) : (
              <TintedScene image={art.image} />
            )}
          </div>
        )}
        <div className="p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon className="size-5" aria-hidden />
            </span>
            <h2 id={headingId} className="text-xl font-semibold">
              {title}
            </h2>
            {art?.kind === 'illustration' && (
              <Illustration name={art.name} className="mr-0 ml-auto size-20 shrink-0 sm:size-24" />
            )}
          </div>
          <ul className="mt-4 grid gap-3">
            {items.map((item) => (
              <li key={item} className="flex gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </GlassCard>
    </section>
  )
}

export function UserGuideScreen() {
  const { t } = useTranslation()
  const emailLogin = useFeatureFlag('email_login_enabled') === 'on'
  const liveStatus = useFeatureFlag('live_status_enabled') === 'on'
  const showcase = useFeatureFlag('venue_showcase_enabled') === 'on'
  const bookings = useFeatureFlag('venue_bookings_enabled') === 'on'
  const text = useGuideText()
  const sections = USER_GUIDE.map((section) => ({ ...section, title: t(section.title) }))
  return (
    <>
      <GuideHero
        art={<ThemeSignature sizes={COVER_SIZES} priority />}
        title={t('guide.user.title')}
        lead={t('guide.user.lead')}
        highlights={[
          { icon: MapPin, label: t('guide.user.highlights.map') },
          { icon: Heart, label: t('guide.user.highlights.people') },
          { icon: ShieldCheck, label: t('guide.user.highlights.safe') },
        ]}
      />
      <aside className="glass mt-4 flex flex-col gap-3 rounded-theme p-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Store className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="font-semibold">{t('guide.user.venueCallout.title')}</p>
            <p className="text-sm text-muted-foreground">{t('guide.user.venueCallout.body')}</p>
          </div>
        </div>
        <ButtonLink to="/guia/locales" variant="secondary" size="sm" className="w-full sm:w-auto">
          {t('guide.user.venueCallout.cta')}
          <ArrowRight aria-hidden />
        </ButtonLink>
      </aside>
      <GuideContents sections={sections} />
      {sections.map((section) => (
        <GuideSection
          key={section.id}
          {...section}
          items={section.items
            .filter((item) => liveStatus || !LIVE_STATUS_ITEMS.includes(item))
            .filter((item) => showcase || !SHOWCASE_ITEMS.includes(item))
            .filter((item) => bookings || !BOOKING_ITEMS.includes(item))
            .map((item) =>
              // Sign-in copy follows the email sign-in flag (roadmap R1).
              item === 'guide.user.sections.account.items.login' && emailLogin
                ? t('guide.user.sections.account.items.loginEmail')
                : text(item),
            )}
        />
      ))}
      <nav className="mt-10 grid gap-2 text-sm">
        <Link className="text-primary underline" to="/legal/premium">
          {t('guide.links.premiumTerms')}
        </Link>
        <Link className="text-primary underline" to="/guia/locales">
          {t('guide.links.otherUser')}
        </Link>
        <Link className="text-primary underline" to="/">
          {t('guide.links.openApp')}
        </Link>
      </nav>
    </>
  )
}

export function VenueGuideScreen() {
  const { t } = useTranslation()
  const liveStatus = useFeatureFlag('live_status_enabled') === 'on'
  const partners = useFeatureFlag('venue_partners_enabled') === 'on'
  const showcase = useFeatureFlag('venue_showcase_enabled') === 'on'
  const bookings = useFeatureFlag('venue_bookings_enabled') === 'on'
  const text = useGuideText()
  const sections = VENUE_GUIDE.map((section) => ({ ...section, title: t(section.title) }))
  return (
    <>
      <GuideHero
        art={<CoverArt image={VENUE_COVERS.nightclub} priority />}
        title={t('guide.venues.title')}
        lead={t('guide.venues.lead')}
        highlights={[
          { icon: Store, label: t('guide.venues.highlights.profile') },
          { icon: Users, label: t('guide.venues.highlights.stats') },
          { icon: Megaphone, label: t('guide.venues.highlights.visibility') },
        ]}
      />
      <GuideContents sections={sections} />
      {sections.map((section) => (
        <GuideSection
          key={section.id}
          {...section}
          items={section.items
            .filter((item) => liveStatus || !LIVE_STATUS_ITEMS.includes(item))
            .filter((item) => partners || !PARTNER_ITEMS.includes(item))
            .filter((item) => showcase || !SHOWCASE_ITEMS.includes(item))
            .filter((item) => bookings || !BOOKING_ITEMS.includes(item))
            .map(text)}
        />
      ))}
      <nav className="mt-10 grid gap-2 text-sm">
        <Link className="text-primary underline" to="/legal/venues">
          {t('guide.links.terms')}
        </Link>
        <Link className="text-primary underline" to="/legal/ranking">
          {t('guide.links.ranking')}
        </Link>
        <Link className="text-primary underline" to="/legal/contact">
          {t('guide.links.contact')}
        </Link>
        <Link className="text-primary underline" to="/guia">
          {t('guide.links.otherVenue')}
        </Link>
      </nav>
    </>
  )
}
