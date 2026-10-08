# Activación de pagos web — puerta del Bloque 12

Procedimiento preparado en el Bloque 10, sin activar Stripe live ni ampliar planes.
PRD Anexo A y `docs/MONETIZATION.md`. La validación del Bloque 9 acredita Stripe
test; los simuladores no acreditan un cobro. Para requisitos del proveedor consultar
su [checklist de producción](https://docs.stripe.com/get-started/checklist/go-live).

## Estado y decisiones antes de activar

- Checkout y Portal alojados; no hay Stripe.js ni tarjeta en el cliente.
- `payments_mode`, audiencia, rol y flags se comprueban en servidor. Mantener test
  limitado a testers y compras públicas cerradas durante esta preparación.
- `stripe-webhook` verifica la firma del cuerpo original y modo; solo RPC de
  servicio conceden entitlements y créditos. El retorno consulta el pedido propio.
- `APP_URL` de `_shared/stripe.ts` está fijado al alias actual. `VITE_APP_URL` no
  lo cambia: un dominio final nuevo necesita código, allowlist, retornos, CORS,
  configuración de Auth y despliegue coordinados. `APP_ORIGIN` sirve a otras Edge.
- Borrado cancela suscripciones externas, incluso sin fulfillment local; las
  facturas conservadas quedan desvinculadas. Reconciliar antes de cambiar de modo.

## Preparación revisable

1. Completar razón social, NIF, domicilios y contactos; revisar IVA, precios finales,
   renovación, cancelación, desistimiento, facturas y consentimientos con quien
   corresponda. Los borradores legales con corchetes no están listos para lanzar.
2. Confirmar cuenta de Stripe, capacidades y datos del comercio. Identificar por
   escrito costes, contratos, límites y presupuesto; pedir la aprobación prevista
   para el Bloque 12 antes de contratar o activar live.
3. Inventariar catálogo test y crear su catálogo live separado, con importes, moneda,
   recurrencia y códigos exactos de los seis productos. No reutilizar IDs test.
   Dejar deshabilitado cualquier precio pendiente o no concordante.
4. Configurar exclusivamente secretos de servidor `STRIPE_SECRET_KEY_LIVE` y
   `STRIPE_WEBHOOK_SECRET_LIVE`, junto a los secretos test ya existentes. No poner
   claves en `VITE_*`, SQL versionado, capturas, logs ni este documento.
5. Configurar endpoint live y Portal conforme a los handlers actuales, y comprobar
   los eventos utilizados por el código. Mantener claves y eventos test separados.
6. Comprobar entrega de avisos y PDF al correo confirmado. Documentos: 3 reservas
   por usuario/hora y 50 globales/día, compartidas entre envío directo y outbox;
   los intentos fallidos consumen presupuesto. Avisos de facturación tienen su
   propio outbox. Estas cuotas de app no sustituyen límites del proveedor.
7. Ejecutar nuevamente `npm run check`, build, audit, SQL del bloque 9/10 y pruebas
   de firma, duplicados, orden, modo incorrecto y autenticación reciente. Hacer
   compra/cancelación/reanudación/desistimiento en test y retirar fixtures propios.

## Activación autorizada

Tras aprobación explícita del propietario, realizar una activación limitada con
audiencia controlada. Una compra real requiere que el propietario ejecute o
autorice la transacción concreta. Confirmar pedido persistido, `simulated=false`,
modo live, un único ledger, entitlement, factura y avisos; después cancelación y
reembolso conforme al procedimiento aprobado. Guardar evidencia sin datos de tarjeta.

Solo ampliar audiencia tras revisar esa evidencia y los requisitos legales,
proveedores, costes y seguridad. Pagos nativos usan las tiendas del Bloque 11:
este procedimiento web no habilita Stripe dentro de un binario nativo.

## Retirada y reconciliación

1. Cerrar nuevas compras mediante `payments_mode=disabled` y audiencia `none` con
   el control administrativo auditado. Comprobar denegación desde cliente y Edge.
2. Conservar webhooks, pedidos, facturas y ventajas adquiridas: cerrar el checkout
   no cancela cobros ni suscripciones ya existentes.
3. Reconciliar pedidos pendientes con Stripe, resolver entregas/reembolsos y revisar
   las colas. No borrar eventos ni conceder créditos manualmente para ocultar fallos.
4. Si hay regresión de código, volver al deployment validado y evaluar compatibilidad
   de la base de datos; las migraciones no se revierten borrando datos.
5. Registrar motivo, alcance y resultado sin secretos. Reabrir solo tras corregir,
   comprobar idempotencia y obtener la aprobación de operación que corresponda.

## Verificación TEST — 08/10/2026

Hecha por MCP de Supabase (solo lectura) y con la suite SQL de pagos (45/45 y 72/72).

| Producto          | Código                  | Precio TEST en Stripe       | Pagado con tarjeta 4242                          |
| ----------------- | ----------------------- | --------------------------- | ------------------------------------------------ |
| Pase VIP mensual  | `vip_monthly`           | ✅                          | ✅ 04/10 (pago, 9 ventajas, créditos, reembolso) |
| Pase mensual      | `pass_monthly`          | ✅ (Bloque 9)               | ❌ nunca probado                                 |
| Pase trimestral   | `pass_quarterly`        | ✅ (checkout abierto 05/10) | ❌ caducó sin pagar                              |
| Pase anual        | `pass_annual`           | ✅ (checkout abierto 05/10) | ❌ caducó sin pagar                              |
| Pase de una noche | `one_night`             | ✅ (Bloque 9)               | ❌ nunca probado                                 |
| Chispa ×1         | `sparks_1`              | ✅ (checkout abierto 05/10) | ❌ caducó sin pagar                              |
| Chispas ×5        | `sparks_5`              | ✅ (Bloque 9)               | ❌ nunca probado                                 |
| Chispas ×15       | `sparks_15`             | ✅ (checkout abierto 05/10) | ❌ caducó sin pagar                              |
| Foco              | `spotlight_1`           | ✅ (Bloque 9)               | ❌ nunca probado                                 |
| Mensaje directo   | `paid_dm_1`             | ✅ (Bloque 9)               | ❌ nunca probado                                 |
| Destacado         | `sponsor_featured`      | ✅ (checkout abierto 05/10) | ❌ caducó sin pagar                              |
| Destacado Plus    | `sponsor_featured_plus` | ✅ (checkout abierto 05/10) | ❌ caducó sin pagar                              |
| Top               | `sponsor_top`           | ✅ (checkout abierto 05/10) | ❌ caducó sin pagar                              |
| Estadísticas Pro  | `venue_pro_monthly`     | ✅ (checkout abierto 05/10) | ❌ caducó sin pagar                              |

«Existe en Stripe» se deduce de que `create-checkout-session` comprueba precio activo,
importe, moneda y periodo antes de abrir la sesión. No hay que crear productos nuevos.

**Para hacer desde el panel de Stripe (TEST):**

1. Webhook → `…/functions/v1/stripe-webhook` con los eventos
   `checkout.session.completed`, `checkout.session.async_payment_succeeded`,
   `customer.subscription.created|updated|deleted|trial_will_end`, `invoice.paid`,
   `invoice.payment_failed` y `charge.refunded`.
2. Los 14 precios de la tabla siguen activos.
3. Ronda de compras con cuenta tester y 4242 en producción (la vuelta del pago está
   fijada a la URL de producción): cada producto pendiente, y luego cancelar una
   suscripción, reembolsar un pago único y reembolsar un patrocinio. Tras cada paso se
   verifica en BBDD: pedido `paid`, evento del webhook y ventaja/crédito/patrocinio/Pro.

## Checklist pendiente

- ❌ Cuenta, catálogo, webhook/Portal live y cobro real autorizado.
- ❌ Datos legales finales, fiscalidad, contratos y aprobación de costes.
- ❌ SMTP real y conciliación operativa de extremo a extremo.
- ✅ Arquitectura test y retirada documentadas; no se activó live en este bloque.
