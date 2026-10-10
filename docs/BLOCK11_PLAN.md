# Plan del Bloque 11 — 2026-10-10

Autorizado por el propietario con «Comienza el bloque 11». Fuente de verdad: PRD 3.3–3.5,
6.13, 11.2 (Bloque 11), 11.3 y Anexo B; `MONETIZATION.md` (decisiones aprobadas),
`PROVIDERS.md` y `NATIVE.md`. `main` actualizada a `09e3ebb` antes de empezar.

Condiciones del propietario (10/10/2026):

- La web debe seguir funcionando igual: Stripe TEST, PWA y panel de locales sin cambios.
- Cada dispositivo compra en su sitio: web → Stripe; iOS → App Store; Android → Google Play.
  En este bloque las tiendas se emulan con **RevenueCat Test Store** (un único catálogo).
- Aún no hay cuentas de desarrollador de Apple ni Google: nada de firmas, fichas ni
  sandbox de tiendas (Bloque 12). Secretos ya creados en Supabase: `REVENUECAT_SDK_TEST`
  y `REVENUECAT_SECRET`.

Decisiones del propietario (10/10/2026):

- appId / bundle id: `com.nightlifeconnect.app`.
- Autorizados `@aparajita/capacitor-secure-storage` y `@aparajita/capacitor-biometric-auth`
  (MIT) porque no hay plugin oficial `@capacitor/*` para Keychain/Keystore ni biometría.
- `REVENUECAT_SDK_TEST` = clave pública del SDK (Test Store); `REVENUECAT_SECRET` = clave
  secreta de la API. El webhook usará un secreto propio adicional (`REVENUECAT_WEBHOOK_AUTH`).
- El bloque se divide: **11a** = fases A y D; **11b** = fases B y C, con el catálogo de
  RevenueCat (todos los productos de pago, incluidos los añadidos entre los bloques 10 y 11:
  patrocinios, Estadísticas Pro, contratos/partners y extras del escaparate) y su guía.
  Los productos se preparan para test y live, pero hasta el Bloque 12 solo se aplica test.

## Fases (cada una con commit y pruebas)

### A. Contenedor Capacitor y plataforma nativa (11a)

1. Dependencias oficiales `@capacitor/*` 8.x (PRD 3.5): core, cli, android, ios, app,
   browser, camera, device, filesystem, geolocation, haptics, preferences, share,
   status-bar, keyboard, splash-screen. `capacitor.config.ts` (`webDir: dist`).
2. `android/` generado y versionado (compila en Android Studio, ya instalado en el equipo).
   `ios/` generado y versionado, pero su compilación exige macOS + Xcode (Bloque 12).
3. `createNativePlatform()` con adaptadores `*.native.ts` por puerto. `main.tsx` elige la
   factory por runtime **antes** de crear servicios; la nativa se carga con `import()`
   dinámico para que el bundle web no cambie. Sin fallback silencioso a la web en nativo.
4. Sesión de Supabase en almacenamiento seguro nativo (Keychain/Keystore), retornos por
   enlaces profundos (`appUrlOpen`), navegador del sistema, safe areas/StatusBar/Keyboard.
5. Permisos con textos ES/EN (`Info.plist`, `AndroidManifest.xml`), 18+ en la ficha
   pendiente del Bloque 12.

### B. Compras en tiendas con RevenueCat (TEST) (11b)

1. Puerto `storeBilling` en `src/platform` (web: no disponible; nativo:
   `@revenuecat/purchases-capacitor`, autorizado en `MONETIZATION.md` §6.2, MIT).
   `appUserID` = id de Supabase (`logIn` tras la sesión, `logOut` al salir). Sin compras
   anónimas.
2. La clave pública del SDK no se compila en la app: la Edge Function `store-config` la
   entrega solo a testers con `payments_mode=test`, `store_payments_enabled=on` y audiencia
   permitida. Con el flag apagado la app nativa muestra «Próximamente».
3. El cliente nunca concede ventajas: tras comprar o restaurar llama a `store-sync`, que
   consulta RevenueCat (`GET /v1/subscribers/{id}` con `REVENUECAT_SECRET`) y aplica el
   resultado en Supabase mediante RPC de servicio idempotente (`private.store_apply`).
4. `revenuecat-webhook`: valida la cabecera `Authorization` (secreto propio), ignora el
   payload salvo `app_user_id`/id de evento y reconcilia desde la API (práctica recomendada
   por RevenueCat). Responde 200 solo tras aplicar; idempotente por id de evento.
5. Migración aditiva: proveedor `test_store` además de `stripe/apple/google` en
   suscripciones, eventos, facturas, entitlements y créditos; `plans.store_product_id_test`;
   `mode = test` para Test Store y sandbox. Las compras web y nativas comparten
   entitlements y ledger de créditos (catálogo único).
6. UI nativa: Premium usa la tienda (precios del producto de la tienda), botón
   «Restaurar compras», Mi suscripción muestra «Gestionar en App Store / Google Play» para
   suscripciones de tienda (cancelación y reembolsos los gestiona la tienda). En nativo no
   se ofrece Stripe ni se enlaza a la web para pagar (normas de las tiendas); las compras de
   locales (B2B) indican que se gestionan en el panel web, sin enlace.
7. La web no cambia: misma ruta Stripe; una suscripción comprada en la app se ve en la web
   como «gestionada en la tienda».

### C. Modo viaje (`travel_mode`, ventaja del Pase según `MONETIZATION.md`) (11b)

Explorar y aparecer en otra ciudad antes de llegar, detrás de `travel_mode_enabled` y del
entitlement `travel_mode`, validado en servidor (RPC), con caducidad y sin revelar la
ubicación real. Web y nativo.

### D. Desbloqueo biométrico (requisito anotado en `ROADMAP_2026-10.md`) (11a)

Opción en Ajustes para pedir Face ID / huella al volver a la app sobre la sesión guardada.
No concede roles ni entitlements; con fallo o sin hardware, se usa el bloqueo normal.

## Fuera del bloque (Bloque 12)

Cuentas de desarrollador, firma, compilación iOS en Mac, productos reales de App Store /
Google Play, sandbox de tiendas, push real (APNs/FCM), fichas 18+, privacy manifest y
publicación. La clave de Test Store **nunca** va en una build de release (RevenueCat
la hace fallar a propósito).

## Verificación

`npm run check`, build web idéntico en comportamiento, E2E existentes, pruebas unitarias de
adaptadores y de la selección de factory, SQL de `store_apply` (idempotencia, test/live,
roles, flag apagado), webhook con cabecera inválida → 401, `npm audit`, Advisors,
compilación Android debug y compra/restauración Test Store en emulador.

No se inicia el bloque 12 sin OK explícito del propietario.

## Plan detallado del Bloque 11b — 10/10/2026

OK del propietario el 10/10/2026. Clave v2 de RevenueCat con lectura y escritura; proyecto
`proj1484f178`; `REVENUECAT_WEBHOOK_AUTH` creado en Supabase y webhook sandbox configurado.
Tarifa vigente revisada (gratis hasta 2.500 $ de ingresos mensuales registrados; Test Store
no genera ingresos). Al terminar: todo fusionado en `main` para copiar el repositorio.

1. **Migración aditiva `store_billing`:** proveedor `test_store` (además de
   `stripe/apple/google`) en suscripciones, eventos, facturas y entitlements;
   `purchase_orders.provider` y `store_transaction_id` (único); `plans.store_product_test`
   (identificador en Test Store = código del plan); `private.store_apply` (solo
   `service_role`, idempotente) que traduce el estado de RevenueCat a pedidos, suscripciones,
   ventajas, créditos, recibos y patrocinios; `public.store_start_venue_order` para reservar
   el local antes de comprar; el desistimiento propio se niega a compras de tienda (lo
   gestiona la tienda).
2. **Edge Functions:** `store-config` (clave pública del SDK y mapa de productos, solo si
   `store_payments_enabled`, modo test y tester), `store-sync` (lee el cliente en la API v2 y
   aplica), `revenuecat-webhook` (cabecera `Authorization`, reconcilia desde la API) y
   `store-admin` (admin con MFA: estado de la clave/catálogo y creación idempotente de los
   productos que falten en Test Store). Nada se concede por el contenido del webhook.
3. **App:** puerto `storeBilling` (web: no disponible; nativo:
   `@revenuecat/purchases-capacitor`), compra y «Restaurar compras» en Premium, gestión en la
   tienda en Mi suscripción, compras de locales con reserva previa, tarjeta de catálogo de
   tiendas en Admin › Pagos. La web sigue con Stripe y muestra las suscripciones de tienda
   como «gestionadas en la tienda».
4. **Modo viaje:** `private.travel_plans`, ciudad efectiva validada en servidor (flag,
   entitlement `travel_mode`, fechas ≤ 30 días) usada por el swipe y el Foco; tarjeta en Perfil.
5. **Catálogo y guía:** `docs/STORE_CATALOG.md` con todos los productos de pago (consumo y
   locales), identificadores test/live, tipo, duración y precio.
6. **Pruebas y puerta:** SQL (`store.sql`, `travel.sql`), unitarias, E2E, Advisors, audit,
   CORS/401 de las funciones nuevas y compra/restauración Test Store en el emulador.
