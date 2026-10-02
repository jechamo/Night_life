import { Pencil, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LOST_FOUND_MAX_CHARS } from '@/features/attendance/model/attendance'
import { Button } from '@/shared/ui/button'
import { TextAreaField } from '@/shared/ui/text-field'
import { useLostFound, useLostFoundAction } from '../hooks/use-lost-found'

/** Lost & found (PRD 6.8): post, reply, edit and delete; 280 chars; gone after 48 h. */
export function LostFoundPanel({ placeId }: { placeId: string }) {
  const { t, i18n } = useTranslation()
  const { data: posts = [] } = useLostFound(placeId)
  const action = useLostFoundAction(placeId)
  const [text, setText] = useState('')
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [editing, setEditing] = useState<string | null>(null)
  const error = action.data

  const submit = () => {
    const payload = editing
      ? { kind: 'edit' as const, postId: editing, text }
      : replyTo
        ? { kind: 'reply' as const, postId: replyTo, text }
        : { kind: 'post' as const, text }
    action.mutate(payload, {
      onSuccess: (problem) => {
        if (problem) return
        setText('')
        setReplyTo(null)
        setEditing(null)
      },
    })
  }

  const time = (iso: string) =>
    new Date(iso).toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' })

  return (
    <section aria-labelledby="lost-found" className="space-y-3">
      <h3 id="lost-found" className="text-lg font-semibold">
        {t('places.lostFound.title')}
      </h3>
      {posts.length === 0 && (
        <p className="text-sm text-muted-foreground">{t('places.lostFound.empty')}</p>
      )}
      <ul className="space-y-2">
        {posts.map((post) => (
          <li key={post.id} className="rounded-2xl bg-surface-raised p-3 text-sm">
            <p className="whitespace-pre-wrap">{post.text}</p>
            <p className="font-label mt-1 text-xs text-muted-foreground">{time(post.createdAt)}</p>
            {post.replies.map((reply) => (
              <p key={reply.id} className="mt-2 border-l-2 border-primary pl-2">
                {reply.text}
              </p>
            ))}
            <div className="mt-1 flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setReplyTo(post.id)
                  setEditing(null)
                }}
              >
                {t('places.lostFound.reply')}
              </Button>
              {post.mine && (
                <>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('places.lostFound.edit')}
                    onClick={() => {
                      setEditing(post.id)
                      setReplyTo(null)
                      setText(post.text)
                    }}
                  >
                    <Pencil aria-hidden />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    aria-label={t('places.lostFound.delete')}
                    onClick={() => action.mutate({ kind: 'delete', postId: post.id })}
                  >
                    <Trash2 aria-hidden />
                  </Button>
                </>
              )}
            </div>
          </li>
        ))}
      </ul>
      <TextAreaField
        label={
          editing
            ? t('places.lostFound.edit')
            : replyTo
              ? t('places.lostFound.reply')
              : t('places.lostFound.new')
        }
        maxLength={LOST_FOUND_MAX_CHARS}
        counter={`${text.length}/${LOST_FOUND_MAX_CHARS}`}
        value={text}
        onChange={(event) => setText(event.target.value)}
        error={error ? t(`places.lostFound.errors.${error}`) : undefined}
      />
      <Button size="sm" disabled={action.isPending || text.trim() === ''} onClick={submit}>
        {t('places.lostFound.publish')}
      </Button>
    </section>
  )
}
