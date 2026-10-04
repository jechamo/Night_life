import type { Result } from '@/shared/lib/result'

export interface MyReport {
  id: string
  aboutName: string
  reason: string
  createdAt: string
  status: 'open' | 'actioned' | 'dismissed'
}

/** Explained decision about my account (DSA art. 17) that I can appeal. */
export interface ModerationDecision {
  id: string
  action: 'warning' | 'content_removed' | 'suspension' | 'ban'
  reason: string
  explanation: string
  createdAt: string
  appeal: { status: 'pending' | 'accepted' | 'rejected'; text: string } | null
}

export interface ModerationService {
  myReports(): Promise<MyReport[]>
  decisions(): Promise<ModerationDecision[]>
  appeal(decisionId: string, text: string): Promise<Result<ModerationDecision, 'already_appealed'>>
  /** Public DSA notice of illegal content (no login). */
  submitIllegalContentNotice(input: {
    url: string
    reason: string
    explanation: string
    email: string
    goodFaith: boolean
  }): Promise<string>
  accountStatus(): Promise<'active' | 'suspended'>
}
