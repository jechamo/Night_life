# Arquitectura — Nightlife Connect

Documento vivo (PRD 3.4). Decisiones detalladas en [`adr/`](./adr).

## Roadmap R3 — partners y contratos

Modelo en `venue-panel/model/partners.ts` (zod). Admin: `AdminPartnersScreen` → hooks de
`use-admin` → `AdminService.partners/savePartner/linkPartnerVenue/createContract/
contractAction/inviteVenueOwner/...` → `admin.ts` (RPC `admin_*`). Local: `PlanCard`,
`TeamCard`, `RedeemInviteScreen` → `use-venue-panel` → `VenuePanelService.partnerState/
team/inviteStaff/previewInvite/redeemInvite/...` → `business.ts`. El enlace público
`/invitacion/:code` guarda el código con `usePendingInvite` (preferencias de `usePlatform`) y
`usePostAuthPath` lo retoma tras el alta o el login. En el servidor, `venue_entitlements` es
el registro de ventajas que no vienen de Stripe; los niveles de patrocinio crean además una
fila `sponsorships` enlazada para que mapa, Inicio, swipe y Flash sigan igual.

## Roadmap R2 — «Cómo está ahora»

`PlaceDetails` pinta `LiveStatusSection` solo con `live_status_enabled`. Flujo: UI →
`useLiveStatus/useReportLiveStatus` (`use-places`, clave `['places', id, 'live-status']`,
refresco cada 2 min) → `PlacesService.liveStatus/reportLiveStatus` → adaptador Supabase
(RPC `place_live_status`, `report_place_status`) o simulador. El panel del local usa
`MusicCard` → `useSetVenueMusic` → `VenuePanelService.setMusic` (`venue_set_music`). El
modelo (`places/model/live-status.ts`) replica las listas cerradas del servidor y
`parseLiveStatus` descarta cualquier valor desconocido.

## Roadmap R1 — email y guías

`/login` elige método según `email_login_enabled`: `EmailLoginStep` (código por email,
`OnboardingService.requestEmailOtp/verifyEmailOtp`) o el `PhoneStep` existente. Ajustes ›
Cuenta usa `getAccountEmail/changeEmail` mediante `use-account-email`. Las guías
(`/guia`, `/guia/locales`) reutilizan `PublicLayout`; sus claves i18n están tipadas una a
una para que falte una traducción sea un error de compilación.

## Inicio sin mapa — previo al bloque 11

`/home` recibe agregados mediante UI → hooks → `DashboardService` → adaptador
Supabase. `home_summary` calcula rankings de toda la ciudad y totales sociales
en servidor; no reutiliza las listas acotadas del mapa ni de conversaciones.
`/places/:placeId` consulta `place_detail` por ID y reutiliza `PlaceDetails`.
Solo la acción explícita «Ver en el mapa» entra en Descubre y puede reservar carga.

La ciudad explícita se comparte mediante preferencias del puerto de plataforma.
Sin GPS consentido se usa el centro de la ciudad. Los favoritos se guardan por
usuario mediante RPC idempotente, RLS y claves foráneas con borrado en cascada.
Home/favoritos/fichas se actualizan mediante Realtime, reconexión y foco.

Los likes vistos usan un snapshot opaco de servidor y recibos individuales de
emisor/fecha: confirmar una carga no consume likes posteriores ni de otra sesión.
El snapshot pertenece al usuario y caduca en una hora; los recibos persisten.
El evento Realtime `home` invalida el dashboard, sin generar un bucle de aperturas
de likes. El corazón de Esta Noche conserva el total recibido.

Las variables CSS `--nl-safe-area-*` son el contrato común de insets; el dueño de
cada pantalla añade su separación visual una sola vez. El empaquetado Capacitor
y los adaptadores nativos se mantienen en el bloque 11. Publicación: `GITFLOW.md`.

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
e2e/              regresión de navegador con Playwright sobre el backend simulado
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
Desde el Bloque 9 las colas administrativas, moderación, panel de locales y derechos
usan adaptadores Supabase. Los mocks quedan para tests y desarrollo sin backend.
Desde el Bloque 10, producción sin configuración Supabase falla al arrancar.
Las máquinas de estado de compra y suscripción, la idempotencia y los outboxes
transaccionales se ejecutan en servidor.

## Pagos y operaciones (Bloque 9)

- `billing.ts` y `business.ts` implementan los servicios de Premium, moderación y
  locales. Los hooks orquestan consultas/mutaciones y la UI usa `platform` para
  navegar a Checkout y Portal, sin SDK de Stripe en el navegador.
- `create-checkout-session` autentica, crea un pedido persistido y comprueba el
  precio del catálogo en Stripe. `stripe-webhook` verifica la firma, consulta el
  estado actual del proveedor y aplica la transición por RPC de servicio.
- `billing-account`, `create-portal-session` y `request-withdrawal` comparten
  autenticación y gestión de suscripción. Ventajas solo por entitlements;
  créditos por ledger con origen único. Test y simulación son estados explícitos.
- `pg_cron` caduca ventajas, concede el lote VIP semanal y prepara avisos cada
  cinco minutos. `pg_net` llama a `billing-worker` con una clave privada en Vault;
  reclama avisos/PDF con leases y reintentos. La retención tiene además un job diario.
- `delete-account` y el worker comparten la retirada de Stripe, Storage, Veriff y
  Auth. Los errores de retirada externa se reintentan mediante una cola privada;
  se conserva únicamente evidencia legal mínima y facturación sin vínculo al usuario.
- Moderación y reclamaciones requieren revisión humana; una apelación necesita
  revisor independiente. Desde el cierre funcional del 05/10, el panel contrata
  patrocinio mediante Stripe TEST con cupos por ciudad y reservas pendientes de 24 h.
  El webhook activa 30 días una sola vez y el reembolso completo lo termina.
  Destacado etiqueta el pin; Plus prioriza listados; Top precede a Plus y habilita
  Flash, que filtra destinatarios en servidor por edad y consentimiento.

### Ventajas sociales y locales (cierre de los bloques 8/9)

- `premium_social_state`, `premium_spark`, `premium_spotlight` e `premium_incognito`
  usan hooks/servicios/adaptadores. El ledger y los efectos sociales se escriben
  en la misma transacción, con locks por usuario/pareja/saldo y origen único.
  El aviso de Chispa no revela al emisor; el Broadcast solo invalida consultas propias.
- Foco ordena candidatos compatibles durante 30 min en un local con check-in o
  la ciudad del perfil. Prioridad VIP ordena likes entrantes y candidatos; Incógnito
  filtra candidatos, ficha directa y fotos salvo likes salientes/matches existentes.
  Vencer la ventaja deja de aplicar el filtro, sin cambiar los bloqueos ni la edad.
- Cinco temas base gratuitos y dos extras autorizados por `premium_themes`.
  `ThemeProvider` usa el entitlement del servidor y vuelve a un tema base al perderlo.
  Las tarjetas de locales patrocinados requieren proximidad y apertura; como máximo
  una tras cada diez decisiones del deck, sin red de anuncios ni datos de terceros.
- Pedidos y suscripciones B2B llevan `venue_id`; una suscripción Pro no concede
  un Pase personal. Checkout exige gestor del local; cancelación/Portal exige titular
  del pago incluso si deja de gestionar el local. Las facturas propias permiten entrar
  al Portal desde Mi suscripción. El precio se verifica por modo, importe, moneda e
  intervalo/count, incluidos el Pase trimestral y anual.
- Estadísticas básicas gratuitas; Pro autoriza series horarias y agregados de edad/
  semáforo. Comparativa a 5 km solo con al menos cinco personas y tres locales.
  TEST/LIVE se separan en créditos, ventajas, suscripciones, patrocinios y tarjetas.

## Backend (Bloque 5)

- Raíz de composición `src/app/services.ts`: Supabase si hay `VITE_SUPABASE_*`;
  mocks solo en desarrollo. Producción sin configuración falla cerrada.
- Escrituras sensibles por RPC (`private` + envoltorios en `public`) y Edge Functions.
- `SessionBridge` (Observer) invalida la caché al entrar/salir o completar el MFA.
- El contador de generación cambia en el evento Auth antes de notificar observers.
  `useSessionMutation` descarta callbacks de una sesión anterior; exportaciones,
  PDF y navegación externa usan el mismo guard. Cancelar queries no cancela mutaciones.

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
- `appUpdates` registra el worker solo en producción web y publica conexión y
  disponibilidad de actualización. `AppStatus` ofrece recarga explícita ES/EN;
  primera instalación y cambio de controller no recargan formularios automáticamente.
  Focus/online/visibilidad y un intervalo revisan versiones; los errores de chunks
  permiten recuperar con una recarga online. El worker no borra Auth.
- Pantallas importadas con `React.lazy`, Suspense accesible y boundary por pantalla.
  Mapbox conserva su gate de reserva y queda fuera de HTML inicial/precache.
- `sw.js` sin caché HTTP duradera; assets con hash inmutables. No hay adaptadores
  nativos todavía: contratos y pasos en [NATIVE.md](./NATIVE.md).

## Calidad

- `npm run check` = `tsc -b` (estricto, sin `any`) + ESLint (0 avisos) + Prettier + Vitest.
- Build correcto; _vendor chunks_ estables (react, motion, data, ui). Aviso conocido
  de tamaño del chunk diferido de Mapbox (1,86 MB), fuera del precache.
