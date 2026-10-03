# Arquitectura — Nightlife Connect

Documento vivo (PRD 3.4). Decisiones detalladas en [`adr/`](./adr).

## Visión general

SPA pura (React 19 + Vite 8, sin SSR) alojada en Vercel, instalable como PWA y preparada
para empaquetarse con Capacitor (Anexo B). Backend en Supabase (`Nightlife_Connect`,
eu-west-1) a partir del Bloque 5.

```
UI (componentes)  →  hooks (estado/orquestación)  →  servicios (datos, Edge Functions)  →  adaptadores
                                                                                         ├─ Supabase (Bloque 5+)
                                                                                         ├─ plataforma (src/platform)
                                                                                         └─ proveedores (Stripe, Veriff/Yoti, Mapbox…)
```

Las dependencias van en un solo sentido. La UI nunca importa `@supabase/*` ni
implementaciones `*.web.ts` de la plataforma (ESLint lo impide).

## Estructura

```
src/
  app/            arranque, proveedores, router, layout (AppShell, TabBar)
  features/       una carpeta por funcionalidad (components, hooks, services, types, tests)
    onboarding/ legal/ consents/ verification/      (Bloque 2)
    places/ attendance/ matching/ chats/ events/    (Bloque 3)
    premium/ admin/ venue-panel/ privacy/ moderation/ safety/ public/  (Bloque 4)
    discover/ tonight/ chats/ profile/ themes/ settings/ design-kit/
  shared/
    ui/           componentes base estilo ShadCN (Button, Chip, Badge, BottomSheet…)
    theme/        registro de temas, generador de CSS, contraste AA, ThemeProvider
    motion/       tokens de movimiento, presets, reducir movimiento, View Transitions
    flags/        feature flags (fallo cerrado), política del paywall, FeatureGate
    entitlements/ ventajas (única fuente de verdad de permisos de pago)
    session/      roles
    services/     contenedor de servicios (inyección de dependencias)
    errors/       Error Boundaries por pantalla
    config/       entorno público y claves de preferencias
    domain/       constantes de dominio (tipos de lugar)
    lib/          utilidades puras (Result, cn)
  platform/       puertos + adaptadores web de funciones del dispositivo (ADR 0003)
  i18n/           i18next ES/EN con claves tipadas
  adapters/       adaptadores Supabase (único sitio con @supabase/*, ADR 0009)
  mocks/          datos y servicios simulados (tests y funciones aún sin backend)
  styles/         Tailwind, fuentes autoalojadas, tokens generados
  assets/fonts/   woff2 variables (OFL) + licencias
scripts/          generador de tokens de tema
supabase/         migraciones versionadas, Edge Functions (Deno) y tests de RLS
docs/             PRD, progreso, arquitectura, API, seguridad, ADR
```

## Patrones aplicados (PRD 3.4)

| Patrón               | Implementación actual                                                          |
| -------------------- | ------------------------------------------------------------------------------ |
| Adapter              | `src/platform/*/*.web.ts`                                                      |
| Strategy             | `PaymentProvider` (stripe_web / disabled / tiendas), temas (`ThemeDefinition`) |
| Factory              | `createWebPlatform`, `selectPaymentProvider`, `createMockServices`             |
| Repository / Service | `FlagService`, `EntitlementService`, `SessionService`                          |
| Facade               | `CheckoutGateway` (Edge Functions de pago, Bloque 9)                           |
| Guard / Policy       | `FeatureGate`, `resolvePaywallState`, `canPurchase`, `isAllowedExternalUrl`    |
| Feature flag         | `useFeatureFlag` (frontend) / `feature_enabled()` (SQL, Bloque 5)              |
| Result tipado        | `Result<T, E>` en servicios y plataforma: nunca se lanza a la UI               |

State machine: onboarding (`onboardingReducer`) y estados de verificación (Bloque 2).
Observer: `RealtimeBridge` escribe los eventos realtime en la caché de TanStack Query (Bloque 3).
Policy: catálogo único (`premium/model/catalog.ts`) con IVA, desistimiento y transiciones de
suscripción puras (Bloque 4). Rutas: la web pública (`/legal`) y el admin tienen su propio
layout fuera del `AppShell`; el admin exige rol + segundo factor y `RequireOnboarded`
redirige a `/suspended` si la cuenta está suspendida. El back-office simulado
(`src/mocks/backoffice`) es mutable para que el admin cambie flags y roles en directo.
Pendientes por bloque: State machines (7, 9), Idempotency key y
Transactional outbox (9).

## Backend (Bloque 5)

- Raíz de composición `src/app/services.ts`: Supabase si hay `VITE_SUPABASE_*`, mocks si no.
- Escrituras sensibles por RPC (`private` + envoltorios en `public`) y Edge Functions.
- `SessionBridge` (Observer) invalida la caché al entrar/salir o completar el MFA.

## Estado y datos

- TanStack Query es la única caché de cliente. Desde el Bloque 7, `RealtimeBridge` (en el
  `AppShell`) escucha el Broadcast privado `place-stats:live|test` y escribe las cifras en
  la caché de lugares. Desde el Bloque 8 escucha además el buzón privado
  `social:<user_id>`: match para ambos, mensajes, lectura, escritura y retirada.
- Matching y chat usan adaptadores reales con Zod. El servidor comprueba compatibilidad
  y ventajas, serializa likes por usuario/pareja y persiste los mensajes. Los Broadcast
  sociales contienen IDs; las RPC vuelven a autorizar los datos al cargar.
- El historial del chat usa páginas de 100 y un cursor `(created_at, id)`; la caché
  reconcilia páginas, envíos y notificaciones por ID. La pila usa IDs de perfiles para
  no saltarse tarjetas cuando cambia la lista del servidor.
- Anthem de prueba se persiste en el perfil y reproduce una muestra propia mediante
  `platform.audio`. La integración externa de Spotify espera acceso autorizado.
- El mapa real (Mapbox GL JS) se carga con `lazy()` solo tras una reserva concedida por
  `reserve_map_load()`; si no, se usa el mapa de prueba (ADR 0010).
- Reintentos con _backoff_ exponencial (máx. 8 s) en consultas; sin reintentos en mutaciones.
- Preferencias no sensibles (tema, idioma, reducir movimiento) vía `platform.preferences`,
  leídas antes del primer render.

## Diseño y movimiento

- Tokens por tema → CSS variables `--nl-*` → utilidades Tailwind (ADR 0004).
- Solo se anima `transform` y `opacity`. Transiciones 150-400 ms con _springs_ de
  `visualDuration`. Reducir movimiento → fundidos.
- Diseño táctil: `100dvh`, `safe-area-inset`, objetivos ≥ 44 px, nada depende de _hover_,
  todo gesto tiene botón alternativo (p. ej., la ficha se cierra arrastrando o con ✕).

## PWA

- `vite-plugin-pwa` (generateSW). El _service worker_ precachea solo el _shell_
  (JS, CSS, HTML, fuentes, iconos). `runtimeCaching: []` ⇒ nunca cachea respuestas de API
  ni datos personales (PRD 3.1).

## Calidad

- `npm run check` = `tsc -b` (estricto, sin `any`) + ESLint (0 avisos) + Prettier + Vitest.
- Build sin advertencias; _vendor chunks_ estables (react, motion, data, ui).
