import { Check } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useFeatureFlag } from '@/shared/flags/use-feature-flag'
import { GlassCard } from '@/shared/ui/card'

/**
 * Public guides (roadmap R1): what the app offers to people and to venues. They live in
 * the public website, so anyone can read them without an account. The copy describes
 * only what exists today; it is updated in every block that adds features.
 */
const USER_GUIDE = [
  {
    title: 'guide.user.sections.discover.title',
    items: [
      'guide.user.sections.discover.items.map',
      'guide.user.sections.discover.items.stats',
      'guide.user.sections.discover.items.search',
      'guide.user.sections.discover.items.place',
    ],
  },
  {
    title: 'guide.user.sections.tonight.title',
    items: [
      'guide.user.sections.tonight.items.going',
      'guide.user.sections.tonight.items.here',
      'guide.user.sections.tonight.items.swipe',
    ],
  },
  {
    title: 'guide.user.sections.dating.title',
    items: [
      'guide.user.sections.dating.items.match',
      'guide.user.sections.dating.items.light',
      'guide.user.sections.dating.items.discreet',
      'guide.user.sections.dating.items.control',
    ],
  },
  {
    title: 'guide.user.sections.verification.title',
    items: [
      'guide.user.sections.verification.items.phone',
      'guide.user.sections.verification.items.age',
      'guide.user.sections.verification.items.badges',
    ],
  },
  {
    title: 'guide.user.sections.safety.title',
    items: [
      'guide.user.sections.safety.items.sos',
      'guide.user.sections.safety.items.report',
      'guide.user.sections.safety.items.rules',
    ],
  },
  {
    title: 'guide.user.sections.events.title',
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
    items: [
      'guide.user.sections.free.items.core',
      'guide.user.sections.free.items.people',
      'guide.user.sections.free.items.trust',
      'guide.user.sections.free.items.themes',
    ],
  },
  {
    title: 'guide.user.sections.premium.title',
    items: [
      'guide.user.sections.premium.items.pass',
      'guide.user.sections.premium.items.vip',
      'guide.user.sections.premium.items.night',
      'guide.user.sections.premium.items.extras',
      'guide.user.sections.premium.items.status',
    ],
  },
  {
    title: 'guide.user.sections.privacy.title',
    items: [
      'guide.user.sections.privacy.items.location',
      'guide.user.sections.privacy.items.consents',
      'guide.user.sections.privacy.items.data',
    ],
  },
  {
    title: 'guide.user.sections.account.title',
    items: [
      'guide.user.sections.account.items.signup',
      'guide.user.sections.account.items.login',
      'guide.user.sections.account.items.delete',
    ],
  },
] as const

const VENUE_GUIDE = [
  {
    title: 'guide.venues.sections.access.title',
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
    items: [
      'guide.venues.sections.free.items.profile',
      'guide.venues.sections.free.items.events',
      'guide.venues.sections.free.items.stats',
      'guide.venues.sections.free.items.music',
      'guide.venues.sections.free.items.team',
    ],
  },
  {
    title: 'guide.venues.sections.sponsor.title',
    items: [
      'guide.venues.sections.sponsor.items.featured',
      'guide.venues.sections.sponsor.items.plus',
      'guide.venues.sections.sponsor.items.top',
      'guide.venues.sections.sponsor.items.limits',
    ],
  },
  {
    title: 'guide.venues.sections.pro.title',
    items: [
      'guide.venues.sections.pro.items.detail',
      'guide.venues.sections.pro.items.privacy',
      'guide.venues.sections.pro.items.billing',
    ],
  },
  {
    title: 'guide.venues.sections.flash.title',
    items: [
      'guide.venues.sections.flash.items.what',
      'guide.venues.sections.flash.items.audience',
      'guide.venues.sections.flash.items.alcohol',
    ],
  },
  {
    title: 'guide.venues.sections.rules.title',
    items: [
      'guide.venues.sections.rules.items.label',
      'guide.venues.sections.rules.items.data',
      'guide.venues.sections.rules.items.filters',
    ],
  },
  {
    title: 'guide.venues.sections.status.title',
    items: ['guide.venues.sections.status.items.now'],
  },
] as const

/** Items that describe features still behind their flag (shown only once it is on). */
const LIVE_STATUS_ITEMS: readonly string[] = [
  'guide.user.sections.events.items.live',
  'guide.venues.sections.free.items.music',
]
const PARTNER_ITEMS: readonly string[] = [
  'guide.venues.sections.access.items.invite',
  'guide.venues.sections.free.items.team',
]

function GuideSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="mt-8">
      <h2 className="text-xl font-semibold">{title}</h2>
      <GlassCard className="mt-3">
        <ul className="grid gap-3">
          {items.map((item) => (
            <li key={item} className="flex gap-3">
              <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </GlassCard>
    </section>
  )
}

export function UserGuideScreen() {
  const { t } = useTranslation()
  const emailLogin = useFeatureFlag('email_login_enabled') === 'on'
  const liveStatus = useFeatureFlag('live_status_enabled') === 'on'
  return (
    <>
      <h1 className="mt-8 text-3xl font-semibold">{t('guide.user.title')}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{t('guide.user.lead')}</p>
      {USER_GUIDE.map((section) => (
        <GuideSection
          key={section.title}
          title={t(section.title)}
          items={section.items
            .filter((item) => liveStatus || !LIVE_STATUS_ITEMS.includes(item))
            .map((item) =>
              // Sign-in copy follows the email sign-in flag (roadmap R1).
              item === 'guide.user.sections.account.items.login' && emailLogin
                ? t('guide.user.sections.account.items.loginEmail')
                : t(item),
            )}
        />
      ))}
      <nav className="mt-10 grid gap-2 text-sm">
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
  return (
    <>
      <h1 className="mt-8 text-3xl font-semibold">{t('guide.venues.title')}</h1>
      <p className="mt-2 max-w-prose text-muted-foreground">{t('guide.venues.lead')}</p>
      {VENUE_GUIDE.map((section) => (
        <GuideSection
          key={section.title}
          title={t(section.title)}
          items={section.items
            .filter((item) => liveStatus || !LIVE_STATUS_ITEMS.includes(item))
            .filter((item) => partners || !PARTNER_ITEMS.includes(item))
            .map((item) => t(item))}
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
