import type { Result } from '@/shared/lib/result'

export interface AudioService {
  playTestSample(): Promise<Result<void, 'failed'>>
  stop(): void
}
