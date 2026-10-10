/**
 * Native entry of the platform layer. Only `main.tsx` imports it, and only with a
 * dynamic `import()` inside the Capacitor shell, so the web bundle never loads the
 * native plugins.
 */
export { createNativePlatform } from './create-native-platform'
