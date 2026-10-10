# Inventario de API — Edge Functions y RPC

## Puerta del Bloque 10

Inventario remoto: 13 Edge Functions ACTIVE, todas utilizadas. `osm-import`
mantiene `verify_jwt=true`; las restantes conservan autenticación propia existente
con `getUser`, firma de proveedor o clave de worker. Desactivar la validación de
gateway no hace pública una operación protegida: se prueban sus guards HTTP.

| Operación                            | Cambio / autorización                                            | Límite                                                      |
| ------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------------------- |
| `complete_onboarding`                | Teléfono confirmado de Auth y bans persistidos antes de escribir | Dispositivo acotado; hashes históricos compatibles          |
| `check_signup`                       | Precheck anónimo auxiliar; no protege por sí solo Auth OTP       | 5/h teléfono, 20/h IP; no sustituye límites nativos de Auth |
| `sign_documents`                     | Usuario propio, versión actual, serialización e idempotencia     | 1–8 entradas; repetir no añade evidencia duplicada          |
| `reserve_document_email`             | Solo service_role; destinatario confirmado                       | 3/h usuario y 50/día global, incluidos fallos               |
| `signed-documents`, `billing-worker` | Reservan la misma cuota antes de PDF/SMTP                        | 429 directo; outbox reintenta con lease/backoff             |
| `test-tools`                         | Perfil activo antes de rol/flag y sandbox                        | No ejecuta herramientas con perfil suspendido               |
| Admin RPC/RLS                        | `private.is_admin`: activo, onboarded, rol y aal2                | Sin autoridad residual por suspensión/ban                   |
| Storage `profile-photos` INSERT      | Propietario, perfil activo/alta elegible, nombre plano UUID      | 10 objetos, 5 MiB, PNG/JPEG/WebP; UPDATE denegado           |
| Borrado Storage                      | Carpetas antiguas recursivas, rutas propias, progreso            | 100 solicitudes, profundidad 20; fallo antes de borrar Auth |

La cuota de email no incluye avisos de facturación, cuyo outbox es independiente.
Las pruebas HTTP de las 13 funciones y exposición de esquemas se reproducen con
`npm run test:network:10`. Detalle en [BLOCK10_TESTS.md](./BLOCK10_TESTS.md).

Documento vivo (PRD 3.4, 6.15 API9). Cada entrada: propósito, autenticación, rol y límites.
Se eliminan las funciones sin uso. Las simulaciones exigen rol y herramientas de prueba;
las verificaciones simuladas no están disponibles en modo live.

## Estado (Bloques 5–6)

Backend base, Auth, legal, herramientas y verificación están desplegados en Nightlife_Connect.
Veriff usa una integración Test. Desde el Bloque 7, lugares, asistencia, eventos y estadísticas
son reales; desde el Bloque 8, matching y chat también usan RPC y Broadcast privados.
Los pagos mantienen sus mocks hasta el Bloque 9.

## Puertos de cliente ya definidos (contratos a implementar)

| Puerto (frontend)                                                                  | Implementación prevista                                                          | Bloque |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------ |
| `FlagSource.load()`                                                                | Lectura de `app_settings` (flags) vía servicio Supabase                          | 5      |
| `EntitlementService.getMine()`                                                     | Tabla `entitlements` (RLS: solo el propietario)                                  | 5      |
| `SessionService.getRoles()`                                                        | Tabla `user_roles` (RLS)                                                         | 5      |
| `OnboardingService` (OTP, alta, estado)                                            | Supabase Auth (teléfono + OTP) + Edge Function de alta (límites, HMAC de baneos) | 5      |
| `LegalService` (documentos y firmas)                                               | Tablas `legal_documents` y `consent_records`                                     | 5      |
| `ConsentService`                                                                   | `consent_records` (append-only)                                                  | 5      |
| `VerificationService` (estado, inicio, revisión)                                   | Veriff Test, Yoti alternativo y simulación persistida + `verification_status`    | 6      |
| `PlacesService` (lugares, eventos, Vibe Check, objetos perdidos)                   | PostGIS + RPC/Edge Functions (límites, ciclo de vida con pg_cron)                | 7      |
| `AttendanceService` (check-in 150 m, Esta Noche Voy)                               | Edge Function de check-in (distancia en servidor, solo lugar+hora)               | 7      |
| `MatchingService` (candidatos, likes, matches, bloqueos, reportes)                 | RPC/Edge Functions con compatibilidad y límites en servidor                      | 8-9    |
| `ChatService`                                                                      | Tabla `messages` + Realtime (RLS: solo participantes)                            | 8      |
| `ProfileService`                                                                   | `profiles` / vista pública                                                       | 5      |
| `RealtimeService`                                                                  | Supabase Realtime (estadísticas, match, mensajes)                                | 7-8    |
| `PremiumService` (estado, compra, cancelar, desistir, canjear, DM de pago)         | Edge Functions de pago + `entitlements`/`credits`/`invoices` (RLS)               | 9      |
| `AdminService` (dashboard, colas, acciones, flags, ajustes, códigos, herramientas) | RPC `security definer` con rol admin + `aal2`, auditadas                         | 5-9    |
| `VenuePanelService` (claims, ficha, estadísticas, eventos, patrocinio)             | RPC con rol `venue_manager` y estadísticas agregadas con umbral                  | 7-9    |
| `PrivacyService` (exportar, borrar con OTP, sesiones)                              | Edge Functions `export-my-data` y `delete-account` (reautenticación)             | 9      |
| `ModerationService` (reportes, decisiones, apelaciones, aviso DSA, estado)         | Tablas de moderación + Edge Function pública de avisos DSA (límite por IP)       | 9      |
| `SafetyService` (contactos SOS)                                                    | Tabla `emergency_contacts` (RLS: solo el propietario)                            | 9      |
| `CheckoutGateway.createCheckoutSession()`                                          | Edge Function `create-checkout-session`                                          | 9      |
| `CheckoutGateway.createPortalSession()`                                            | Edge Function `create-portal-session`                                            | 9      |

## Previstas (PRD)

| Función                   | Propósito                                         | Auth         | Rol                                     | Límites                        | Bloque |
| ------------------------- | ------------------------------------------------- | ------------ | --------------------------------------- | ------------------------------ | ------ |
| `create-checkout-session` | Stripe Checkout (suscripción / pago único)        | JWT          | usuario (+ política de flags)           | por usuario                    | 9      |
| `create-portal-session`   | Portal de cliente de Stripe                       | JWT          | usuario con suscripción                 | por usuario                    | 9      |
| `request-withdrawal`      | Desistimiento                                     | JWT          | usuario                                 | por usuario                    | 9      |
| `stripe-webhook`          | Eventos de Stripe → entitlements                  | Firma Stripe | —                                       | idempotente (`payment_events`) | 9      |
| `yoti-webhook`            | Resultado de verificación → `verification_status` | Firma Yoti   | —                                       | idempotente                    | 6      |
| Simuladores de prueba     | Afluencia, likes, webhooks, caducidades           | JWT          | tester/admin **y** `test_tools_enabled` | por usuario                    | 5-9    |

## Implementado (Bloque 5)

RPC en `public` = envoltorios `SECURITY INVOKER` de implementaciones en `private`
(no expuesto). Todas validan la sesión y lo que reciben.

| Función                  | Propósito                                           | Auth               | Rol / condición                                | Límites                           |
| ------------------------ | --------------------------------------------------- | ------------------ | ---------------------------------------------- | --------------------------------- |
| `check_signup`           | Bans HMAC (teléfono/dispositivo) antes del SMS      | anon o JWT         | —                                              | 20/h por IP, 5/h por teléfono     |
| `complete_onboarding`    | Crea perfil, firma, consentimientos y preferencias  | JWT                | propio                                         | una vez por cuenta                |
| `sign_documents`         | Reaceptación de versiones nuevas                    | JWT                | propio                                         | solo versión vigente              |
| `save_consents`          | Cambios de consentimiento (añade registros)         | JWT                | propio                                         | —                                 |
| `update_my_profile`      | Bio, semáforo, discreto, tema, idioma, preferencias | JWT                | propio (+ consentimiento art. 9)               | lista blanca de campos            |
| `search_public_profiles` | Perfiles visibles (columnas seguras)                | JWT                | edad, consentimiento y compatibilidad de ambos | máx. 50, 120/h                    |
| `feature_enabled`        | Lectura de un flag                                  | anon o JWT         | —                                              | —                                 |
| `has_entitlement`        | ¿Tengo la ventaja X?                                | JWT                | propio                                         | —                                 |
| `admin_set_flag`         | Cambiar un flag (valor permitido)                   | JWT                | admin + aal2, auditado                         | —                                 |
| `admin_set_setting`      | Cambiar un límite (rango)                           | JWT                | admin + aal2, auditado                         | min/max                           |
| `admin_list_users`       | Usuarios con teléfono enmascarado                   | JWT                | admin + aal2, auditado                         | máx. 200                          |
| `admin_set_role`         | Dar/quitar roles                                    | JWT                | admin + aal2, auditado                         | no quitarse admin a sí mismo      |
| `admin_dashboard`        | Recuentos                                           | JWT                | admin + aal2                                   | —                                 |
| `purge_test_data`        | Borra todo lo `is_test`                             | JWT                | tester/admin **y** `test_tools_enabled`        | auditado                          |
| Edge `signed-documents`  | PDF firmado / envío por email                       | JWT (`verify_jwt`) | propio                                         | email solo a dirección confirmada |
| Edge `delete-account`    | Borrar cuenta y fotos                               | JWT                | propio, inicio de sesión < 10 min              | —                                 |
| Edge `test-tools`        | Generar personas `is_test`                          | JWT                | tester/admin **y** flag                        | máx. 30 por llamada               |

## Implementado (Bloque 6)

| Función                          | Propósito                                         | Autenticación / condición                                                   | Límites                                                          |
| -------------------------------- | ------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Edge `verification`              | Crear sesión y URL alojada o simulación explícita | JWT propio, alta terminada, no ban; Test exige tester/admin y flag          | 5 sesiones/h por usuario, disponibilidad/caducidad por capacidad |
| Edge `veriff-webhook`            | Minimizar y persistir decisiones                  | HMAC del cuerpo original + cliente Veriff                                   | 16 KiB, evento idempotente, asociación de sesión comprobada      |
| Edge `yoti-webhook`              | Alternativa de edad                               | Firma RSA-PSS                                                               | No activado para llamadas live                                   |
| `verification_snapshot`          | Estados y gates del propietario                   | JWT, sandbox/live según rol/flags                                           | Solo propios                                                     |
| `begin_verification`             | Reservar sesión de nivel                          | JWT, rol/flags/consentimiento y registro de acceso                          | 5/h                                                              |
| `begin_simulated_verification`   | Elegir simulación persistida                      | JWT, tester/admin, herramientas, sandbox, consentimiento opcional por nivel | 5/h; sin proveedor externo                                       |
| `simulate_verification_result`   | Resultado de sesión simulada propia               | JWT, tester/admin, herramientas, sandbox y proveedor simulator              | Sesión activa propia                                             |
| `complete_provider_verification` | Aplicar evento firmado mínimo                     | Solo service_role                                                           | Idempotencia, orden, caducidad; revisión humana definitiva       |
| `request_verification_review`    | Pedir revisión                                    | JWT, sesión propia y estado admitido                                        | Auditado                                                         |
| `admin_verification_reviews`     | Cola real de revisión                             | Admin + aal2                                                                | Sin imágenes/documentos                                          |
| `admin_resolve_verification`     | Aprobar/rechazar revisión                         | Admin + aal2, sin autoaprobación ni cuentas baneadas                        | Auditado                                                         |
| `record_verification_cleanup`    | Auditar resultado HTTP de borrado del proveedor   | Solo service_role; sesión Veriff final                                      | Sin cuerpos ni datos personales                                  |

## Implementado (Bloque 7)

Todas son envoltorios `public` SECURITY INVOKER sobre funciones `private`. Sin Edge
Functions nuevas: Google Places y eventos externos siguen desactivados (ADR 0010).

| Función                                                                        | Propósito                                          | Autenticación / condición                                    | Límites                                                                           |
| ------------------------------------------------------------------------------ | -------------------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `search_places`, `list_cities`, `get_place_stats`                              | Lugares cercanos y estadísticas                    | JWT registrado; `is_test` solo para tester/admin             | 120 búsquedas/h; umbral < 5 personas                                              |
| `check_in`, `check_out`, `set_going`, `cancel_going`, `my_attendance`          | Asistencia                                         | JWT registrado; check-in a ≤ 150 m                           | 30/h por acción; un check-in activo                                               |
| `who_is_there`                                                                 | Perfiles visibles en el local                      | JWT, edad verificada                                         | Solo perfiles visibles                                                            |
| `create_event`, `get_event`, `confirm_event`, `report_event`, `list_events`    | Eventos de usuario                                 | JWT registrado                                               | 2 eventos/día, 30 confirmaciones/h, 30 reportes/h; sin confirmar → borrado a 24 h |
| `vote_vibe`, `my_vibe`                                                         | Vibe Check                                         | JWT con check-in en el local                                 | 60/h                                                                              |
| `lost_found_list`, `_post`, `_reply`, `_edit`, `_delete`                       | Objetos perdidos                                   | JWT registrado; editar/borrar solo lo propio                 | 30/h                                                                              |
| `update_venue_details`                                                         | Editar ficha                                       | Gestor del local o admin, auditado                           | Longitudes acotadas; la app solo muestra webs https                               |
| `reserve_map_load`                                                             | Reservar 1 carga de Mapbox y obtener token público | JWT registrado                                               | 30/h por usuario; cuota diaria/mensual                                            |
| `admin_provider_access`, `admin_configure_provider`                            | Cuotas de Mapbox y Google                          | Admin + aal2; cambios auditados                              | Sin ampliaciones automáticas                                                      |
| `admin_set_map_token`                                                          | Guardar token público de Mapbox                    | Admin + aal2, auditado                                       | Solo `pk.`, 23-300 caracteres                                                     |
| `admin_list_venues`, `admin_create_venue`                                      | Catálogo propio                                    | Admin + aal2; altas auditadas                                | Nombre, ciudad y coordenadas obligatorios; máx. 500 en el listado                 |
| `admin_upsert_venue_from_google`                                               | Guardar `place_id` + coordenadas                   | Solo service_role (sin función que la llame)                 | Coordenadas caducan a 30 días                                                     |
| `cron_places_tick`                                                             | Estadísticas y caducidades bajo demanda            | Solo service_role (pg_cron llama a las privadas cada minuto) | Broadcast solo si cambian las cifras                                              |
| `sim_seed_places`, `sim_fill_venue`, `sim_advance_expiry`, `sim_import_events` | Simuladores                                        | Tester/admin **y** `test_tools_enabled`                      | Solo entidades `is_test`; auditados                                               |

## Implementado (Bloque 8)

Envoltorios invoker en `public` sobre implementaciones privadas. `anon` no ejecuta
estas funciones. Las cuotas usan al usuario y un HMAC de la IP (10 veces la cuota
por usuario para la IP); no se conserva IP en bruto.

| RPC                                      | Propósito                                   | Autorización                                                                                 | Límites                                                        |
| ---------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| `matching_candidates`, `matching_person` | Compatibilidad, contexto seguro y prioridad | Edad de ambos, preferencias consentidas, visibles y sin bloqueos; fixtures solo tester/admin | 50 candidatos, 120 consultas/h                                 |
| `matching_like`, `matching_status`       | Like, match transaccional y cuota           | Edad de ambos, compatibilidad; `unlimited_likes` en servidor                                 | Cuota diaria configurable (5), 100 intentos/h                  |
| `matching_pass`, `matching_undo`         | Pase persistido y deshacer                  | Edad; `undo` exige entitlement                                                               | 300 pases/h, 60 undo/h                                         |
| `matching_likes_you`                     | Recuento e identidades autorizadas          | Edad; identidades solo con `see_likes`                                                       | 50 perfiles, 120 consultas/h                                   |
| `matching_matches`, `matching_unmatch`   | Matches propios y retirada para ambos       | Participante, ambas edades vigentes y sin bloqueo                                            | 100 matches en listado                                         |
| `matching_block`, `matching_report`      | Bloqueo bidireccional y reporte persistido  | Cuenta registrada; target visible en su entorno                                              | 60 bloqueos/h, 10 reportes/h                                   |
| `chat_summaries`, `chat_messages`        | Resúmenes e historial                       | Participante de match vigente, edad de ambos                                                 | 100 resúmenes, 100 mensajes/página, 300 lecturas/h             |
| `chat_send`, `chat_read`, `chat_typing`  | Texto, lectura y escritura                  | Participante de match vigente, edad de ambos                                                 | 1.000 caracteres; 120 envíos/h, 300 lecturas/h, 1.200 avisos/h |
| `sim_social`                             | Like o mensaje entrante de fixture          | Tester/admin + flag + edad; origen exclusivamente `is_test`                                  | 30/h, auditado                                                 |
| `set_anthem`                             | Guardar/quitar Anthem simulado              | Propio; guardar exige tester/admin + flag                                                    | Título/artista 1–80 caracteres; sin URL externa                |

Canal `social:<user_id>` privado con SELECT solo para el dueño verificado y sin
INSERT para clientes. Eventos: `match`, `message`, `read`, `typing`, `removed`,
`refresh`. Los datos se vuelven a leer por RPC; la reconexión refresca la caché.

## Implementado (Bloque 11b)

| Función / RPC                                            | Propósito                                                     | Autorización                                                        | Límites                                  |
| -------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------- |
| Edge `store` `{action:"config"}`                         | Clave pública del SDK, id de cuenta, modo y mapa de productos | JWT; `store_payments_enabled`, `payments_mode=test`, acceso de pago | —                                        |
| Edge `store` `{action:"sync"}`                           | Leer el cliente en RevenueCat (API v2) y aplicar              | JWT; mismas condiciones                                             | 60/h por persona y red                   |
| Edge `revenuecat-webhook`                                | Aviso de RevenueCat → reconciliación desde la API             | Cabecera `Authorization` = `REVENUECAT_WEBHOOK_AUTH`                | 5 clientes por evento                    |
| Edge `store-admin`                                       | Comprobar clave, permisos y catálogo de Test Store            | JWT admin + aal2 (vía `store_admin_catalog`), auditado              | Solo lectura en RevenueCat               |
| `store_access`, `store_sync_access`                      | Condiciones de compra en tienda                               | Invocadas por `store` con el JWT del usuario                        | `store_sync_access` 60/h                 |
| `store_start_venue_order(code, venue, from)`             | Reservar patrocinio/Pro antes de comprar en la tienda         | Gestor del local; cupos y fechas como Stripe                        | Mismas reglas que Stripe                 |
| `store_apply(snapshot)`                                  | Aplicar suscripciones y compras de la tienda                  | Solo `service_role`                                                 | Idempotente (`rc:<id>`)                  |
| `store_admin_catalog`                                    | Catálogo esperado para la comprobación                        | Admin + aal2, auditado                                              | —                                        |
| `travel_state`, `travel_set(city, days)`, `travel_clear` | Modo viaje                                                    | Edad verificada; `set` exige flag y entitlement `travel_mode`       | 1–30 días; ciudades de lanzamiento; 20/h |
