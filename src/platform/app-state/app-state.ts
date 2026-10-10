/**
 * Port for the app lifecycle (Block 11): foreground/background changes (biometric
 * lock on return) and the Android hardware back button. The web implementation
 * maps visibility changes and has no back button of its own (the browser owns it).
 */
export interface AppStateService {
  /** `true` when the app comes to the foreground, `false` when it leaves it. */
  onActiveChange(handler: (active: boolean) => void): () => void
  /** Hardware back button (Android). Never fires on the web. */
  onBackButton(handler: () => void): () => void
  /** Leaves the app (Android back on the first screen). No-op on the web. */
  exit(): void
}
