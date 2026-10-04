import { MessageCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMatches } from '@/features/matching/hooks/use-matching'
import { PhotoImage } from '@/shared/images/PhotoImage'
import { EmptyState } from '@/shared/ui/empty-state'
import { ScreenHeader } from '@/shared/ui/screen-header'
import { Section } from '@/shared/ui/section'
import { Skeleton } from '@/shared/ui/skeleton'
import { useChatSummaries } from './hooks/use-chat'

/** Chats (PRD 5.3): new matches on top, then conversations. */
export function ChatsScreen() {
  const { t, i18n } = useTranslation()
  const { data: matches, isPending } = useMatches()
  const { data: summaries = [] } = useChatSummaries()

  if (isPending) return <Skeleton className="m-4 h-64" />
  if (!matches || matches.length === 0) {
    return (
      <>
        <ScreenHeader title={t('tabs.chats')} />
        <EmptyState
          icon={MessageCircle}
          illustration="emptyChats"
          title={t('chats.empty.title')}
          description={t('chats.empty.body')}
        />
      </>
    )
  }

  const withSummary = matches.map((match) => ({
    match,
    summary: summaries.find((s) => s.matchId === match.id),
  }))
  const fresh = withSummary.filter(({ summary }) => !summary?.last)
  const conversations = withSummary
    .filter(({ summary }) => summary?.last)
    .sort((a, b) => Date.parse(b.summary!.last!.sentAt) - Date.parse(a.summary!.last!.sentAt))

  return (
    <>
      <ScreenHeader title={t('tabs.chats')} />
      {fresh.length > 0 && (
        <Section title={t('chats.newMatches')}>
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
            {fresh.map(({ match }) => (
              <li key={match.id} className="shrink-0">
                <Link to={`/chats/${match.id}`} className="flex w-20 flex-col items-center gap-1">
                  <PhotoImage
                    src={match.person.photos[0]}
                    sizes="64px"
                    alt=""
                    className="size-16 rounded-full border-2 border-primary object-cover shadow-[0_0_16px_var(--nl-glow)]"
                  />
                  <span className="truncate text-sm">{match.person.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title={t('chats.conversations')}>
        <ul className="glass divide-y divide-border overflow-hidden rounded-theme">
          {conversations.map(({ match, summary }) => (
            <li key={match.id}>
              <Link
                to={`/chats/${match.id}`}
                className="flex min-h-16 items-center gap-3 px-4 py-3 transition-opacity active:opacity-70"
              >
                <PhotoImage
                  src={match.person.photos[0]}
                  sizes="48px"
                  alt=""
                  className="size-12 shrink-0 rounded-full object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{match.person.name}</span>
                  {match.contactKind === 'paid_dm' && (
                    <span className="text-xs text-primary">{t('chats.paidContact')}</span>
                  )}
                  <span className="block truncate text-sm text-muted-foreground">
                    {summary?.last?.fromMe ? `${t('chats.you')}: ` : ''}
                    {summary?.last?.text}
                  </span>
                </span>
                <span className="flex flex-col items-end gap-1">
                  <span className="font-label text-xs text-muted-foreground">
                    {summary?.last &&
                      new Date(summary.last.sentAt).toLocaleTimeString(i18n.language, {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                  </span>
                  {(summary?.unread ?? 0) > 0 && (
                    <span
                      className="flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-xs font-bold text-primary-foreground"
                      aria-label={t('chats.unread', { count: summary?.unread })}
                    >
                      {summary?.unread}
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Section>
    </>
  )
}
