import { Ban, ChevronLeft, Flag, HeartOff, Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { SafetySheet, type SafetyAction } from '@/features/matching/components/SafetySheet'
import { useMatches } from '@/features/matching/hooks/use-matching'
import { PhotoImage } from '@/shared/images/PhotoImage'
import { Button, ButtonLink } from '@/shared/ui/button'
import { Skeleton } from '@/shared/ui/skeleton'
import { MessageBubble } from './components/MessageBubble'
import { TypingIndicator } from './components/TypingIndicator'
import { useMarkRead, useMessages, useSendMessage, useTyping } from './hooks/use-chat'

const MAX_MESSAGE = 1000

/** Real-time chat (PRD 5.3) with typing and read indicators; delete match, block, report. */
export function ChatScreen() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const { matchId = '' } = useParams()
  const { data: matches } = useMatches()
  const match = matches?.find((m) => m.id === matchId)
  const { data: messages = [] } = useMessages(matchId)
  const typing = useTyping(matchId)
  const send = useSendMessage(matchId)
  const markRead = useMarkRead(matchId)
  const initialDraft = (location.state as { draft?: string } | null)?.draft ?? ''
  const [text, setText] = useState(initialDraft)
  const [action, setAction] = useState<SafetyAction | null>(null)
  const endRef = useRef<HTMLLIElement>(null)
  const { mutate: markAsRead } = markRead

  useEffect(() => {
    markAsRead()
  }, [markAsRead, messages.length])
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length, typing])

  if (!matches) return <Skeleton className="m-4 h-96" />
  if (!match)
    return (
      <ButtonLink to="/chats" className="m-4">
        {t('common.back')}
      </ButtonLink>
    )

  const submit = () => {
    const value = text.trim()
    if (!value) return
    send.mutate(value, { onSuccess: () => setText('') })
  }

  return (
    <div className="flex h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] min-h-0 flex-col">
      <header className="pt-safe px-safe glass-strong z-10 flex shrink-0 items-center gap-2 border-x-0 border-t-0 py-2">
        <ButtonLink to="/chats" variant="ghost" size="icon" aria-label={t('common.back')}>
          <ChevronLeft aria-hidden />
        </ButtonLink>
        <Link to={`/people/${match.person.id}`} className="flex flex-1 items-center gap-3">
          <PhotoImage
            src={match.person.photos[0]}
            sizes="40px"
            alt=""
            className="size-10 rounded-full object-cover"
          />
          <span className="font-semibold">{match.person.name}</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('safety.unmatch.cta')}
          onClick={() => setAction('unmatch')}
        >
          <HeartOff aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('safety.block.cta')}
          onClick={() => setAction('block')}
        >
          <Ban aria-hidden />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label={t('safety.report.cta')}
          onClick={() => setAction('report')}
        >
          <Flag aria-hidden />
        </Button>
      </header>
      <ul
        className="px-safe flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain py-4 [&>li]:shrink-0"
        aria-live="polite"
      >
        {messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}
        {typing && (
          <li>
            <TypingIndicator name={match.person.name} />
          </li>
        )}
        <li ref={endRef} aria-hidden="true" />
      </ul>
      <form
        className="px-safe glass-strong flex shrink-0 items-end gap-2 rounded-2xl py-2"
        onSubmit={(event) => {
          event.preventDefault()
          submit()
        }}
      >
        <label htmlFor="chat-input" className="sr-only">
          {t('chats.placeholder')}
        </label>
        <textarea
          id="chat-input"
          rows={1}
          value={text}
          maxLength={MAX_MESSAGE}
          placeholder={t('chats.placeholder')}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault()
              submit()
            }
          }}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl bg-surface px-4 py-2.5 text-base text-foreground outline-none placeholder:text-muted-foreground"
        />
        <Button
          type="submit"
          size="icon"
          aria-label={t('chats.send')}
          disabled={!text.trim() || send.isPending}
        >
          <Send aria-hidden />
        </Button>
      </form>
      <SafetySheet
        action={action}
        personId={match.person.id}
        personName={match.person.name}
        matchId={match.id}
        onClose={() => setAction(null)}
        onDone={(done) => {
          setAction(null)
          if (done !== 'report') void navigate('/chats', { replace: true })
        }}
      />
    </div>
  )
}
