# Inventario de API — Edge Functions y RPC

Documento vivo (PRD 3.4, 6.15 API9). Cada entrada: propósito, autenticación, rol y límites.
Se eliminan las funciones sin uso. Las simulaciones exigen rol y herramientas de prueba;
las verificaciones simuladas no están disponibles en modo live.

## Estado (Bloques 5–6)

Backend base, Auth, legal, herramientas y verificación están desplegados en Nightlife_Connect.
Veriff usa una integración Test. Mapa, matching, chat y pagos mantienen sus mocks hasta sus bloques.

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

| Función                  | Propósito                                           | Auth               | Rol / condición                         | Límites                           |
| ------------------------ | --------------------------------------------------- | ------------------ | --------------------------------------- | --------------------------------- |
| `check_signup`           | Bans HMAC (teléfono/dispositivo) antes del SMS      | anon o JWT         | —                                       | 20/h por IP, 5/h por teléfono     |
| `complete_onboarding`    | Crea perfil, firma, consentimientos y preferencias  | JWT                | propio                                  | una vez por cuenta                |
| `sign_documents`         | Reaceptación de versiones nuevas                    | JWT                | propio                                  | solo versión vigente              |
| `save_consents`          | Cambios de consentimiento (añade registros)         | JWT                | propio                                  | —                                 |
| `update_my_profile`      | Bio, semáforo, discreto, tema, idioma, preferencias | JWT                | propio (+ consentimiento art. 9)        | lista blanca de campos            |
| `search_public_profiles` | Perfiles visibles (columnas seguras)                | JWT                | edad verificada o tester                | máx. 50                           |
| `feature_enabled`        | Lectura de un flag                                  | anon o JWT         | —                                       | —                                 |
| `has_entitlement`        | ¿Tengo la ventaja X?                                | JWT                | propio                                  | —                                 |
| `admin_set_flag`         | Cambiar un flag (valor permitido)                   | JWT                | admin + aal2, auditado                  | —                                 |
| `admin_set_setting`      | Cambiar un límite (rango)                           | JWT                | admin + aal2, auditado                  | min/max                           |
| `admin_list_users`       | Usuarios con teléfono enmascarado                   | JWT                | admin + aal2, auditado                  | máx. 200                          |
| `admin_set_role`         | Dar/quitar roles                                    | JWT                | admin + aal2, auditado                  | no quitarse admin a sí mismo      |
| `admin_dashboard`        | Recuentos                                           | JWT                | admin + aal2                            | —                                 |
| `purge_test_data`        | Borra todo lo `is_test`                             | JWT                | tester/admin **y** `test_tools_enabled` | auditado                          |
| Edge `signed-documents`  | PDF firmado / envío por email                       | JWT (`verify_jwt`) | propio                                  | email solo a dirección confirmada |
| Edge `delete-account`    | Borrar cuenta y fotos                               | JWT                | propio, inicio de sesión < 10 min       | —                                 |
| Edge `test-tools`        | Generar personas `is_test`                          | JWT                | tester/admin **y** flag                 | máx. 30 por llamada               |

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
