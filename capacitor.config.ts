import type { CapacitorConfig } from '@capacitor/cli'

// Block 11 (Annex B). The shell loads the bundle from `npm run build:native`
// (Vite mode `native`: no service worker, CSP meta tag). Owner decision 2026-10-10.
const config: CapacitorConfig = {
  appId: 'com.nightlifeconnect.app',
  appName: 'Nightlife Connect',
  webDir: 'dist-native',
  // Neon Noir shell colour while the WebView starts (same as the PWA manifest).
  backgroundColor: '#07060d',
  android: {
    allowMixedContent: false,
    // webContentsDebuggingEnabled keeps Capacitor's default: debug builds only, never release.
  },
  ios: {
    // Insets are applied by the CSS safe-area contract, not by the scroll view.
    contentInset: 'never',
  },
  plugins: {
    // Every theme is dark: light system-bar icons. CSS insets for Android WebView < 140.
    SystemBars: { insetsHandling: 'css', style: 'DARK' },
    // Edge-to-edge Android: resize the WebView so the chat input stays above the keyboard.
    Keyboard: { resizeOnFullScreen: true },
  },
}

export default config
