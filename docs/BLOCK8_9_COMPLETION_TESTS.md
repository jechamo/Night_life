# Cierre funcional de los bloques 8/9 — pruebas, 2026-10-05

Solicitud del propietario: terminar las ventajas pendientes, subir y desplegar,
y enviar el resultado a su propia cuenta. Plan: [BLOCK8_9_COMPLETION_PLAN.md](./BLOCK8_9_COMPLETION_PLAN.md).

## Resultado por función

| Función          | Comportamiento implementado y comprobado                                                                                                                                                                                                                               |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Chispa           | Botón del swipe, saldo y consumo de una Chispa; like y aviso anónimo «alguien ha sentido la chispa» persistidos en la misma transacción. El destinatario puede marcarlo visto. Reintentos no gastan de nuevo.                                                          |
| Foco             | Botón de activación y hora de fin; consume uno, destaca 30 min. Local seleccionado exige check-in vigente; el swipe general usa la ciudad del perfil. Caducidad y filtros siguen en servidor.                                                                          |
| Prioridad        | VIP ordena sus likes entrantes antes que los ordinarios, también al seleccionar candidatos compatibles. Chispas preceden likes sin Chispa.                                                                                                                             |
| Incógnito        | Control VIP en Perfil; solo visible a personas a quienes dio like y matches existentes, incluida ficha directa/fotos. Al vencer VIP se deja de aplicar.                                                                                                                |
| Temas            | Cinco base gratis como exige PRD 8.2; Gold/Sapphire extras del Pase. Candado/compra y fallback a un tema base al perder el entitlement. Contraste probado en los siete.                                                                                                |
| Sin tarjetas     | Locales patrocinados propios cercanos y abiertos, etiquetados; máximo una tras cada diez decisiones. El Pase elimina las tarjetas. Sin SDK de publicidad ni rastreo.                                                                                                   |
| Mensaje previo   | `paid_dm_enabled=on`; pantalla existente usa crédito, semáforo, compatibilidad y autorización del servidor.                                                                                                                                                            |
| Catálogo         | Packs 1/5/15, Pase mensual/trimestral/anual y precios/periodos en ES/EN; Checkout confirma intervalo y cantidad.                                                                                                                                                       |
| Patrocinio       | Checkout TEST desde el panel, 30 días sin renovación automática, fecha de inicio, reservas/cupos por ciudad. Destacado pin/tarjetas; Plus prioridad en listados; Top precede a Plus y permite Flash con consentimiento/edad. Reembolso completo termina el patrocinio. |
| Estadísticas Pro | Suscripción mensual separada por local; básicas gratis, detalle horario y agregados de edad/semáforo bajo Pro, comparativa 5 km con ≥5 personas y ≥3 locales. Portal/cancelación por titular del pago.                                                                 |

El Foco general usa la ciudad del descubrimiento existente, no incorpora un radio
GPS nuevo. La prioridad nunca elude edad, consentimiento, compatibilidad, bloqueo,
Incógnito ni semáforo.

## Catálogo nuevo de Stripe TEST

Cuenta TEST existente; no se activó LIVE ni se cambiaron planes/proveedores.
Los importes son propuestas de prueba pendientes de validación antes del bloque 12.

| Código                  | Importe | Periodo        |
| ----------------------- | ------- | -------------- |
| `sparks_1`              | 1,49 €  | Consumible     |
| `sparks_15`             | 11,99 € | Consumible     |
| `pass_quarterly`        | 26,99 € | 3 meses        |
| `pass_annual`           | 89,99 € | 1 año          |
| `sponsor_featured`      | 29 €    | 30 días        |
| `sponsor_featured_plus` | 49 €    | 30 días        |
| `sponsor_top`           | 79 €    | 30 días        |
| `venue_pro_monthly`     | 19,99 € | Mes, por local |

## Evidencia automatizada

- `npm run check`: **393/393**, 49 archivos; TypeScript, ESLint sin avisos y
  Prettier correctos. Incluye ocho pruebas nuevas de UI (Chispa/aviso, Foco,
  temas con/sin Pase, Incógnito, prioridad, frecuencia de tarjetas y compra Pro),
  contraste de Gold/Sapphire y una regresión del orden Destacado/Plus/Top.
- Build de producción correcto; Mapbox conserva su chunk diferido y aviso de tamaño.
- Deno: **33/33** (firma Stripe, verificación, OSM y borrado de fotos); tipos de
  los cinco entrypoints de pago implicados. Imports fijados, sin dependencias nuevas.
- `supabase/tests/premium-completion.sql`: **45/45**. Saldo/gasto/idempotencia,
  cuota sin consumir, aviso sin identidad, Foco/caducidad/prioridad, Incógnito,
  permisos de gestión, Pro por local, coexistencia con Pase, cancelación/fallo/
  renovación/reembolso, patrocinio/30 días/cupos/reembolso, Top Flash/consentimiento,
  tarjetas sin Pase/con Pase y aislamiento TEST/LIVE del saldo.
- Regresión SQL: bloque 9 **72/72**, matching **62/62**, RLS **33/33**.
  Las cuatro suites terminan en excepción deliberada que contiene resultados y
  fuerza rollback; ese error de transporte no significa fallo de una comprobación.
- **12 comprobaciones reales de gateway**: cada uno de los ocho productos nuevos
  abre Checkout alojado en Stripe TEST, se rechaza usuario anónimo, se reutiliza
  el pedido abierto al reintentar y crear/volver del Checkout no concede ventajas.
  Se usaron dos cuentas y tres locales desechables propios, sin email/SMS.
- `npm run test:network:10`: **29/29**, puertas de método/autenticación, CORS y
  denegación de esquemas privados. `npm audit`: **0 vulnerabilidades**.
- Permisos remotos: **0** tablas public/private sin RLS, **0** definers públicos,
  **0** grants SELECT privados para anon/authenticated.
- Advisors: 16 INFO de [tablas privadas cerradas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
  WARN previo de [contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
  y 16 INFO de [índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).

## Backend publicado

Seis migraciones versionadas, generadas con CLI y aplicadas con MCP:

- `20261005053450_premium_social_completion`.
- `20261005053810_venue_billing_completion`.
- `20261005055441_completion_hardening_and_flags`.
- `20261005060129_sponsorship_tiers_privacy`.
- `20261005061406_completion_runtime_guards`.
- `20261005063445_sponsorship_self_service_terms` (ES/EN 1.1, conserva 1.0).

Edge ACTIVE: `create-checkout-session` v6, `billing-account` v6,
`create-portal-session` v5, `request-withdrawal` v5. Se conserva autenticación
propia mediante `getUser`; no se habilita acceso anónimo a operaciones de pago.
Webhook firmado y worker existentes siguen procesando el catálogo ampliado.

Flags `paid_dm_enabled`, `sponsored_cards_enabled` y
`sponsorship_self_service_enabled` on; modo de pagos TEST y audiencia testers.
Patrocinios TEST solo visibles a quienes ya tienen permiso de ver datos TEST.

## Limpieza, alcance y límites

Cuentas y locales HTTP desechables eliminados tras las pruebas; ocho pedidos
TEST pendientes quedaron expirados y sin usuario/local para ignorar callbacks
tardíos. Sus Checkout están sin pagar y tienen caducidad automática de 24 h
confirmada en Stripe. El conector no expone cancelar Checkout ni eliminar
clientes; quedan dos clientes ficticios TEST sin identidad real y sesiones sin pago.
Credenciales temporales no se conservan en el repositorio.

La prueba HTTP acredita creación real en Stripe, no ocho pagos completos ni
webhooks firmados de cada precio nuevo. Fulfillment nuevo y ciclos de pago se
prueban por SQL con eventos normalizados; el webhook firmado existente ya tiene
evidencia de compra/cancelación/reembolso TEST del bloque 9 y su fuente no cambió.

El navegador integrado no pudo iniciar (error del runtime de CUA); no se atribuye
una prueba visual de estos cambios a la pestaña ni una prueba física nueva a los
móviles. Instalación/offline de PWA ya confirmadas por el propietario en ambos
móviles; actualización de versión, lectores de pantalla, 60 fps y puertas live
siguen en [BLOCK10_TESTS.md](./BLOCK10_TESTS.md). Este cierre no se atribuye al scan
independiente sellado del bloque 10 ni inicia aplicaciones nativas del bloque 11.

## Publicación web

- Implementación `87e4b916e20ff76589168825bd6d4c5d4367921e`, subida a
  `origin/codex/block10` y publicada en [Nightlife Connect](https://nightlife-connect-beige.vercel.app).
- MCP verifica **READY**, target production, alias habitual y SHA coincidente:
  `dpl_Hm5PhAKRjiHCtsTqsF6NBjXwPAz3`. CLI oficial en el proyecto/plan existentes,
  sin cambiar protección; primer intento rechazado, sesión CLI renovada y segundo
  correcto. No se utilizó una cuenta distinta ni se modificaron permisos.
- HTTP 200, CSP idéntica a `vercel.json`, manifest standalone e iconos disponibles.
  Worker contiene la entrada publicada y excluye el SDK de Mapbox.
- **15/15 archivos idénticos por SHA-256** al build del archivo Git del commit:
  entrada, CSS, dos catálogos, ES/EN, hooks y pantallas de swipe, likes, perfil,
  temas, panel de local, paywall, Checkout, retorno y Mi suscripción.
  Para reproducir se usaron las variables existentes de producción y los 18
  metadatos públicos `VITE_VERCEL_*` que Vercel añade automáticamente, partiendo
  de `dist` vacío en la copia temporal. No basta comparar contra variables de desarrollo.

| Archivo publicado               | SHA-256                                                            |
| ------------------------------- | ------------------------------------------------------------------ |
| `index-Cqs-BVsN.js`             | `be64051a9ce3b4ded1483897a4c123b8468112e76db9b185d29fffd36f4fcdb7` |
| `index-BWzis6Mn.css`            | `046cee852540b73934ea397d0a770c1593aa849fbe4dd7e3b112f5c5c01d8d9e` |
| `SwipeScreen-wxqGFcC0.js`       | `0d1fc7b078d362bd67aa4df902a97a45898accfb9f990881ddbd90acd67f7d5e` |
| `VenueDetailScreen-XczJfHMz.js` | `5dc5614b6ca39634e95327e21eece2d670087bf1db200d7384a0bd33d91b287c` |

Las variables descargadas para esta comprobación se retiraron después. El build
remoto terminó correctamente y su auditoría de dependencias también dio cero
vulnerabilidades. Los avisos existentes de chunk Mapbox, `engines >=22` y glob
transitivo no se ocultaron.

## Reproducción manual cuando el propietario vuelva

1. Actualizar la PWA con el aviso disponible. Premium muestra packs 1/5/15 y los
   tres periodos del Pase; abrir Checkout solo con una cuenta tester.
2. Con saldo, Ligar → Chispa y Foco; en la otra cuenta aparece el aviso anónimo.
   Para Foco en un local hacer primero check-in; para general se usa la ciudad.
3. Con VIP, activar Incógnito en Perfil; un tercero sin like saliente no lo ve.
   Apariencia mantiene los cinco base y solo abre Gold/Sapphire con Pase.
4. Sin Pase, tras diez decisiones se admite una tarjeta si hay un patrocinio
   cercano/abierto elegible. Con Pase desaparece; ausencia de locales elegibles
   no se sustituye por publicidad de terceros.
5. Panel del local → Patrocinio/Pro → Stripe TEST. Nunca usar tarjeta real.
   Retorno queda pendiente hasta confirmación del servidor. Pro se gestiona
   mediante Portal, independientemente del Pase personal.
