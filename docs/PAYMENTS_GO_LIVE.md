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

## Checklist pendiente

- ❌ Cuenta, catálogo, webhook/Portal live y cobro real autorizado.
- ❌ Datos legales finales, fiscalidad, contratos y aprobación de costes.
- ❌ SMTP real y conciliación operativa de extremo a extremo.
- ✅ Arquitectura test y retirada documentadas; no se activó live en este bloque.
