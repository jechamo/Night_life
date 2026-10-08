# Roadmap R1 — Entrar por email tras el alta y guías públicas (plan)

Origen: [ROADMAP_2026-10.md](./ROADMAP_2026-10.md) §1 y §6. Aprobado por el propietario el
08/10/2026. Todo lo nuevo es aditivo; el login por SMS, el alta y el admin no cambian.

## 1. Entrar con código por email (flag `email_login_enabled`, apagado por defecto)

- Flag nuevo en `app_settings` (migración aditiva) y en `src/shared/flags/flags.ts`
  (seguro = `off`). Con el flag apagado la app es idéntica a hoy.
- `OnboardingService` añade: `requestEmailOtp`, `verifyEmailOtp`, `getAccountEmail` y
  `changeEmail`. Adaptador Supabase:
  - `signInWithOtp({ email, options: { shouldCreateUser: false } })`: nunca crea cuentas
    (el alta sigue exigiendo teléfono, firma y comprobación de bans).
  - Si el email no tiene cuenta, se responde igual que si la tuviera (sin enumeración).
  - `verifyOtp({ email, token, type: 'email' })`, mismos errores tipados que el SMS.
  - `getUser()` / `updateUser({ email })` para ver y cambiar el email (confirmación por
    enlace, como ya hace el alta).
- UI: `/login` muestra «Entrar con email» por defecto y «Entrar con SMS» como alternativa
  (y viceversa). Ajustes › Cuenta: añadir/cambiar email y estado de verificación. En el
  alta, el paso de email explica que sirve para entrar sin SMS.
- Seguridad: las cuentas baneadas/suspendidas ya se rechazan en servidor en cada RPC
  (`private.require_registered`); límites de envío de Supabase Auth.
- Configuración que hace el propietario en Supabase Auth: SMTP propio y plantilla
  «Magic Link» con `{{ .Token }}` (detalle en `docs/AUTH_EMAIL.md`).

## 2. Guías públicas sin login

- `/guia` (usuarios) y `/guia/locales` (locales) dentro de la web pública existente
  (`PublicLayout`), ES/EN, sin precios definitivos.
- Enlaces desde Bienvenida, índice legal, pie de la web pública, Perfil y Panel de locales.

## Hecho cuando

- Flag apagado: E2E y unitarias actuales en verde sin cambios de comportamiento.
- Flag encendido: login por email de punta a punta (unitarias + E2E con el simulador).
- Guías accesibles sin sesión, enlazadas y traducidas (ES/EN con las mismas claves).
- Suite SQL de RLS actualizada (15 flags) y en verde; Advisors sin errores nuevos.
- `npm run check`, build, `npm audit`, E2E ×3; PROGRESS y SECURITY actualizados.
