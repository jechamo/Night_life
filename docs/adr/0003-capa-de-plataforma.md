# ADR 0003 — Capa de plataforma para Capacitor

- **Estado:** aceptada (Bloque 1)

## Decisión

`src/platform/` expone un objeto `Platform` con 12 servicios (ubicación, cámara, vibración,
almacenamiento seguro, preferencias, compartir, ID de dispositivo, biometría,
notificaciones, enlaces profundos, navegador externo y descargas) más la estrategia de
pagos. Cada servicio es un puerto (interfaz) con implementación web
(`*.web.ts`); el Anexo B añadirá `*.native.ts` con plugins oficiales `@capacitor/*`.

- Los componentes obtienen la plataforma con `usePlatform()`.
- ESLint (`no-restricted-properties` / `no-restricted-globals`) **prohíbe** usar
  `navigator.geolocation`, `mediaDevices`, `vibrate`, `share`, `clipboard`,
  `localStorage`, `Notification`, `window.open`, `URL.createObjectURL`, etc. fuera de
  `src/platform/`. Romper la regla rompe el build.
- La vibración y la biometría son no-op en web (excluidas del MVP).
- El navegador externo solo navega a hosts de una lista blanca (Yoti, Stripe, Spotify)
  con HTTPS y sin credenciales en la URL (6.15 A01/API7).
- La sesión de Supabase usará `toSupabaseAuthStorage(platform.secureStorage)` (3.3.4).
- Las preferencias se leen **antes** del primer render (`loadInitialSettings`), de forma
  asíncrona a propósito: el almacenamiento nativo es asíncrono.
