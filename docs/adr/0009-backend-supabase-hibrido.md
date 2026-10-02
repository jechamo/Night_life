# ADR 0009 — Backend Supabase por fases (Bloque 5)

- **Estado:** aceptada (Bloque 5)
- **Fecha:** 2026-10-02

## Contexto

El Bloque 5 conecta el proyecto `Nightlife_Connect` (eu-west-1) con el esquema completo, RLS,
roles, `app_settings`, alta con teléfono + OTP, perfiles, Storage, documentos y firma, y los
datos de prueba. Las funciones de los bloques 6-9 (verificación real, lugares, ligar, pagos)
todavía no tienen backend.

## Decisión

- **Esquema completo ya**, como pide el PRD: todas las tablas de 4.1 con RLS activa y
  "denegar por defecto". Las tablas de los bloques 6-9 solo tienen las políticas de lectura del
  propietario; sus escrituras llegarán con sus RPC/Edge Functions.
- **Composición híbrida** (`src/app/services.ts`): si hay `VITE_SUPABASE_URL` y
  `VITE_SUPABASE_PUBLISHABLE_KEY`, se usan adaptadores Supabase para flags, entitlements, roles,
  alta, documentos, consentimientos, perfil y la parte real del admin (flags, configuración,
  roles, auditoría, datos de prueba y MFA). El resto sigue con los mocks del Bloque 4 hasta su
  bloque. Sin variables (tests, desarrollo local) todo es mock.
- **Adaptadores en `src/adapters/supabase/`**: única carpeta donde ESLint permite importar
  `@supabase/*`. La sesión usa `platform.secureStorage` como almacenamiento (PRD 3.3.4).
- **Escrituras sensibles solo por RPC `security definer`** con `search_path` vacío:
  `complete_onboarding` (revalida la edad en servidor, firma, consentimientos, perfil y
  preferencias en una transacción), `sign_documents`, `save_consents` y `admin_*` (rol admin +
  `aal2`). El cliente no puede escribir roles, verificación, entitlements, bans ni flags.
- **Bans por HMAC-SHA256** con una clave aleatoria generada dentro de Vault (nunca en el repo).
- **PDF firmado y email sin dependencias nuevas**: generador PDF de solo texto y cliente SMTP
  mínimo (TLS implícito, puerto 465) escritos en la Edge Function. Los emails pasan por una
  tabla _outbox_ (patrón Transactional outbox) y se envían con reintentos. El remitente es la
  cuenta de Gmail del propietario con contraseña de aplicación en Supabase Secrets; antes del
  lanzamiento se cambiará por un proveedor transaccional de la UE.
- **Perfiles de prueba** (`is_test`) creados por la Edge Function `test-tools` con usuarios de
  Auth sin teléfono (email `@nightlife.test` no entregable) y avatares ilustrados. Solo
  testers/admins los ven; "Purgar" los borra en cascada.

## Consecuencias

- La configuración del proveedor de teléfono y de los teléfonos de prueba se hace en el panel
  de Supabase (el conector usado no tiene API de configuración de Auth).
- Mientras haya mocks, el mundo de ligar (Bloque 3) usa su propio "yo" simulado: tu perfil real
  aparece en Perfil, pero el swipe sigue simulado hasta el Bloque 8.
