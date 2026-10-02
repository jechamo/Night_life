# ADR 0005 — Feature flags y entitlements con fallo cerrado

- **Estado:** aceptada (Bloque 1)

## Decisión

- Un único servicio de flags (`FlagService` + `useFeatureFlag`) valida cada flag con Zod
  **por separado**: un valor inválido solo resetea ese flag a su valor seguro.
- Valores seguros (fallo cerrado, 6.15 A10): pagos `disabled`, audiencia `none`, paywall
  `hidden`, premium `off`, herramientas de prueba `off`, verificación `live`.
- Mientras los flags cargan, la UI usa los valores seguros (`FeatureGate` muestra un
  estado _pending_ para no redirigir antes de tiempo).
- Política del paywall (`resolvePaywallState`, función pura con tests):
  `premium_enabled = off` → oculto; puede comprar (`payments_mode ≠ disabled` y audiencia
  `all`, o `testers` con rol `tester`) → checkout; si no → "Próximamente" (o oculto si
  `paywall_visibility = hidden`). Un paywall `visible` sin posibilidad de compra se
  degrada a "Próximamente" para no crear un callejón sin salida.
- `useEntitlement(key)` = `premium_enabled` **y** `hasEntitlement()` (activo, dentro de
  su ventana). Es solo UX: el servidor aplicará `has_entitlement()` en SQL (Bloque 5/9).
- `paid_dm` no se modela aún como entitlement: es un pago único por destinatario y se
  diseña en el Bloque 9.
