import { describe, expect, it } from 'vitest'
import type { ChatMessage } from '../services/chat-service'
import { mergeMessages } from './messages'

const message: ChatMessage = {
  id: 'a',
  matchId: 'match',
  fromMe: true,
  text: 'Hi',
  sentAt: '2026-10-04T00:00:00Z',
  readAt: null,
}
describe('Block 8 message reconciliation', () => {
  it('deduplicates an echo arriving before the send response and updates read receipts', () => {
    const read = { ...message, readAt: '2026-10-04T00:00:01Z' }
    expect(mergeMessages([message], [message, read])).toEqual([read])
  })
  it('preserves older pages and sorts same-time messages deterministically', () => {
    const newer = { ...message, id: 'z', sentAt: '2026-10-04T00:01:00Z' }
    expect(mergeMessages([newer], [{ ...message, id: 'b' }, message])).toEqual([
      message,
      { ...message, id: 'b' },
      newer,
    ])
  })
})
