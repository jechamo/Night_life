# Inventario de API — Edge Functions y RPC

Documento vivo (PRD 3.4, 6.15 API9). Cada entrada: propósito, autenticación, rol y límites.
Se eliminan las funciones sin uso y **ninguna función de prueba es accesible en producción**.

## Estado (Bloque 1)

Aún no hay Edge Functions ni RPC desplegadas: los bloques 1-4 usan mocks
(`src/mocks/`). El proyecto Supabase `Nightlife_Connect` existe y está sano, sin esquema
de aplicación todavía.

## Puertos de cliente ya definidos (contratos a implementar)

| Puerto (frontend)                                                  | Implementación prevista                                                          | Bloque |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------- | ------ |
| `FlagSource.load()`                                                | Lectura de `app_settings` (flags) vía servicio Supabase                          | 5      |
| `EntitlementService.getMine()`                                     | Tabla `entitlements` (RLS: solo el propietario)                                  | 5      |
| `SessionService.getRoles()`                                        | Tabla `user_roles` (RLS)                                                         | 5      |
| `OnboardingService` (OTP, alta, estado)                            | Supabase Auth (teléfono + OTP) + Edge Function de alta (límites, HMAC de baneos) | 5      |
| `LegalService` (documentos y firmas)                               | Tablas `legal_documents` y `consent_records`                                     | 5      |
| `ConsentService`                                                   | `consent_records` (append-only)                                                  | 5      |
| `VerificationService` (estado, inicio, revisión)                   | Edge Functions de Yoti + `verification_status`                                   | 6      |
| `PlacesService` (lugares, eventos, Vibe Check, objetos perdidos)   | PostGIS + RPC/Edge Functions (límites, ciclo de vida con pg_cron)                | 7      |
| `AttendanceService` (check-in 150 m, Esta Noche Voy)               | Edge Function de check-in (distancia en servidor, solo lugar+hora)               | 7      |
| `MatchingService` (candidatos, likes, matches, bloqueos, reportes) | RPC/Edge Functions con compatibilidad y límites en servidor                      | 8-9    |
| `ChatService`                                                      | Tabla `messages` + Realtime (RLS: solo participantes)                            | 8      |
| `ProfileService`                                                   | `profiles` / vista pública                                                       | 5      |
| `RealtimeService`                                                  | Supabase Realtime (estadísticas, match, mensajes)                                | 7-8    |
| `CheckoutGateway.createCheckoutSession()`                          | Edge Function `create-checkout-session`                                          | 9      |
| `CheckoutGateway.createPortalSession()`                            | Edge Function `create-portal-session`                                            | 9      |

## Previstas (PRD)

| Función                   | Propósito                                         | Auth         | Rol                                     | Límites                        | Bloque |
| ------------------------- | ------------------------------------------------- | ------------ | --------------------------------------- | ------------------------------ | ------ |
| `create-checkout-session` | Stripe Checkout (suscripción / pago único)        | JWT          | usuario (+ política de flags)           | por usuario                    | 9      |
| `create-portal-session`   | Portal de cliente de Stripe                       | JWT          | usuario con suscripción                 | por usuario                    | 9      |
| `request-withdrawal`      | Desistimiento                                     | JWT          | usuario                                 | por usuario                    | 9      |
| `stripe-webhook`          | Eventos de Stripe → entitlements                  | Firma Stripe | —                                       | idempotente (`payment_events`) | 9      |
| `yoti-webhook`            | Resultado de verificación → `verification_status` | Firma Yoti   | —                                       | idempotente                    | 6      |
| Simuladores de prueba     | Afluencia, likes, webhooks, caducidades           | JWT          | tester/admin **y** `test_tools_enabled` | por usuario                    | 5-9    |
