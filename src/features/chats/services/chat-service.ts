export interface ChatMessage {
  id: string
  matchId: string
  fromMe: boolean
  text: string
  sentAt: string
  readAt: string | null
}

export interface ChatSummary {
  matchId: string
  last: ChatMessage | null
  unread: number
}

/** Port for chat (Supabase Realtime in Block 8). Messages are plain text, never HTML. */
export interface ChatService {
  summaries(): Promise<ChatSummary[]>
  messages(matchId: string, before?: { sentAt: string; id: string }): Promise<ChatMessage[]>
  send(matchId: string, text: string): Promise<ChatMessage>
  markRead(matchId: string): Promise<void>
  setTyping(matchId: string, typing: boolean): void
}
