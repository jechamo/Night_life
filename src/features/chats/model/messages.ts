import type { ChatMessage } from '../services/chat-service'

/** Reconcile RPC responses and Broadcast without duplicate bubbles or stale read receipts. */
export function mergeMessages(
  existing: readonly ChatMessage[],
  incoming: readonly ChatMessage[],
): ChatMessage[] {
  const messages = new Map(existing.map((m) => [m.id, m]))
  for (const message of incoming) messages.set(message.id, message)
  return [...messages.values()].sort(
    (a, b) => a.sentAt.localeCompare(b.sentAt) || a.id.localeCompare(b.id),
  )
}
