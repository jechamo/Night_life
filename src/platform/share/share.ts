import type { Result } from '@/shared/lib/result'

export interface SharePayload {
  title?: string
  text?: string
  url?: string
}

/** `copied` = no native share sheet, the link was copied to the clipboard instead. */
export type ShareOutcome = 'shared' | 'copied' | 'cancelled'
export type ShareError = 'unsupported' | 'failed'

export interface ShareService {
  share(payload: SharePayload): Promise<Result<ShareOutcome, ShareError>>
}
