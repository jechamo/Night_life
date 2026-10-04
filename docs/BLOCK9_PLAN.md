# Plan del Bloque 9 — 2026-10-04

Autorizado por el propietario tras aprobar el bloque 8. PRD 6.9–6.13 y catálogo
aprobado en `docs/MONETIZATION.md`. Stripe MCP conectado en test; no activar live.

1. Moderación real: reportes, validación humana con MFA, tres reportes válidos de
   denunciantes distintos en seis horas, suspensión explicada, apelaciones, bans por
   HMAC y cola de riesgo grave. Formulario DSA público con cuota; SOS Lite persistido.
2. Panel gratuito de locales: reclamar ficha, aprobación humana, edición y eventos
   oficiales. Patrocinios de factura manual y huecos limitados; Flash Alerts con
   consentimiento, edad y política de alcohol configurable y cerrada por defecto.
3. Derechos: exportación completa y errores explícitos; solicitudes con plazo de un
   mes. Borrado con autenticación reciente, cancelación de suscripciones y retirada
   del cliente de Stripe, archivos y datos; conservar solo evidencia legal bloqueada.
4. Stripe test: catálogo y precios reales por MCP, Checkout y Portal alojados,
   cancelación/reanudación/desistimiento, firma e idempotencia de webhooks,
   reconciliación del estado actual y entitlements/créditos exclusivamente en servidor.
   El retorno de Checkout nunca concede ventajas. `audience=none` bloquea el checkout.
5. Promociones atómicas, simulador explícito persistido y avisos en outbox con
   reintentos; cron para caducidad, créditos semanales, avisos y retención.
6. Adaptadores reales sin fallback silencioso a mocks. Traducciones ES/EN y flujos
   externos mediante plataforma. Claves solo en Supabase Secrets; sin Stripe.js.
7. Pruebas SQL con rollback, firma/reintento/desorden de webhooks, aislamiento,
   compra/cancelación/desistimiento y borrado con cuentas desechables. `check`, build,
   audit, Advisors y auditoría de red; actualizar evidencias, commit, push y despliegue.

El acceso MCP permite configurar Stripe, pero el runtime requiere una clave de test
en Supabase Secrets. Se verifica esta configuración antes del ensayo externo. Si un
servicio gratuito no está disponible, se documenta y prueba la simulación persistida
prevista en PRD 11.3, sin atribuirle una ejecución externa real.

No se avanza al bloque 10 sin OK explícito.
