import { useTranslation } from 'react-i18next'

/** Three bouncing dots (transform only; static when motion is reduced). */
export function TypingIndicator({ name }: { name: string }) {
  const { t } = useTranslation()
  return (
    <div
      role="status"
      aria-label={t('chats.typing', { name })}
      className="glass inline-flex items-center gap-1 rounded-2xl rounded-bl-md px-4 py-3"
    >
      {[0, 0.15, 0.3].map((delay) => (
        <span
          key={delay}
          aria-hidden
          className="nl-eq-bar block size-2 rounded-full bg-muted-foreground"
          style={{ animationDelay: `${delay}s`, transformOrigin: 'center' }}
        />
      ))}
    </div>
  )
}
