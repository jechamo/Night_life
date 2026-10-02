import { parseFlags, SAFE_FLAG_DEFAULTS, type FeatureFlags } from './flags'

/** Port: where raw flag values come from (mock now, `app_settings` from Block 5). */
export interface FlagSource {
  load(): Promise<unknown>
}

export interface FlagService {
  getAll(): Promise<FeatureFlags>
}

/** Single entry point for flags (PRD 3.2). Never throws: failures fall back closed. */
export function createFlagService(source: FlagSource): FlagService {
  return {
    async getAll() {
      try {
        return parseFlags(await source.load())
      } catch {
        return { ...SAFE_FLAG_DEFAULTS }
      }
    },
  }
}
