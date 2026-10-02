import { Check, CheckCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/shared/lib/cn'
import { riseIn } from '@/shared/motion/presets'
import { useMotionTokens } from '@/shared/motion/MotionPreferencesProvider'
import type { ChatMessage } from '../services/chat-service'

/** Plain-text bubble (never HTML) with sent/read ticks. */
export function MessageBubble({ message }: { message: ChatMessage }) {
  const { t, i18n } = useTranslation()
  const tokens = useMotionTokens()
  const time = new Date(message.sentAt).toLocaleTimeString(i18n.language, {
    hour: '2-digit',
    minute: '2-digit',
  })
  return (
    <motion.li
      variants={riseIn}
      initial="hidden"
      animate="visible"
      transition={tokens.spring.snappy}
      className={cn('flex', message.fromMe ? 'justify-end' : 'justify-start')}
    >
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-4 py-2',
          message.fromMe
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'glass rounded-bl-md',
        )}
      >
        <p className="break-words whitespace-pre-wrap">{message.text}</p>
        <p
          className={cn(
            'font-label mt-0.5 flex items-center justify-end gap-1 text-[0.65rem]',
            message.fromMe ? 'text-primary-foreground' : 'text-muted-foreground',
          )}
        >
          {time}
          {message.fromMe &&
            (message.readAt ? (
              <CheckCheck className="size-3.5" aria-label={t('chats.read')} />
            ) : (
              <Check className="size-3.5" aria-label={t('chats.sent')} />
            ))}
        </p>
      </div>
    </motion.li>
  )
}
