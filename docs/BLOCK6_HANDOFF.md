# Cierre del Bloque 6 y continuidad en Cursor

Fecha: 2026-10-03. Rama: `claude/festive-hawking-wdxr7b`.
Código validado y publicado: `8af3117c04a8a008b1a220ccaba1aea180425c9c`.
URL: https://nightlife-connect-beige.vercel.app.
Deployment Vercel MCP READY: `dpl_BktVMoWpm4qRDpethQ1y4AkK2ojR`.

## Evidencias

- Check: 285 tests en 34 archivos, TypeScript, ESLint y Prettier correctos; build correcto.
- Supabase: verificación 54/54 y RLS 33/33, fixtures revertidos; npm audit 0 vulnerabilidades.
- Veriff Nightlife TEST: API real, rechazo y aprobación HMAC, HTTP 200. Reenvío idempotente;
  revisión solicitada persistida en la cola real. Station Test no permite forzar review;
  ese evento se cubre automáticamente.
- Admin MFA: autoaprobación bloqueada (403) y error visible. Aprobación por otro admin,
  rechazo humano definitivo, bans, orden de eventos y caducidad cubiertos por SQL.
- Identidad Test y foto simulada independientes. Edad simulada elegida explícitamente
  desde la UI final; los tres resultados persisten tras recarga con mode=sandbox.
- Vista móvil 390×844 sin errores de consola. No se probó otro dispositivo físico.
- Alta original y dos fotos preservadas; diez consentimientos previos más dos nuevos de
  identidad/foto autorizados por el propietario. Cero perfiles de fixtures.
- MCP: verification v5, veriff-webhook v7, yoti-webhook v3; migraciones versionadas aplicadas.
- Advisors conocidos: protección de contraseñas (OTP), dos INFO en tablas privadas
  cerradas y 23 INFO de índices sin uso. No se ampliaron planes ni activaron claves live.

## Pendiente aceptado para Bloque 12

DELETE Veriff responde 403; requiere habilitación por soporte. El propietario trasladó
activación y prueba real al lanzamiento. record_verification_cleanup, solo service_role,
audita HTTP como pending; no afirmar que se borraron datos del proveedor.
[Documentación oficial](https://devdocs.veriff.com/apidocs/v1sessionsid-3).

## Bloque 7: mapa, lugares e información de sitios

El propietario lo hará en Cursor. Consultar PRD, PROGRESS.md, PROVIDERS.md y SECURITY.md.
Supabase Nightlife_Connect: ocrpfeqfqzchhrghqcfb. Migraciones versionadas y funciones por MCP;
Vercel MCP para despliegues, CLI alternativa solo si está autorizada. No incluir docs/PRD sin seguimiento.

- Comprobar Mapbox Demo sin tarjeta, límites y caducidad antes de llamar. La existencia
  de una clave no demuestra acceso gratuito. El secreto VITE_MAPBOX_TOKEN de Supabase
  no se inyecta automáticamente en Vite/Vercel; exponer solo un token público adecuado.
- Google Places: prueba gratuita elegible, sin cargos ni renovación; clave solo en servidor.
  Los digests aportados por el propietario no son credenciales.
- Sin acceso gratuito confirmado: mapa/locales/eventos de prueba persistidos en Supabase,
  con permisos y auditoría, sin fallback de éxito en memoria ni activación de facturación.
- Información de sitios: fuentes autorizadas para dirección, contacto/web, horarios,
  categorías, fotos y valoraciones. Revisar atribución y reglas de almacenamiento antes
  de importar; no inventar información real.
- Aislar fixtures y preservar propietario/documentos/consentimientos al purgar.
- Cada cierre exige pruebas, seguridad, documentación, despliegue, commit/push, SHA/URL
  y OK del propietario. Costes y activación live solo en Bloque 12.

Auto-review rechazó desactivar Veriff globalmente para provocar un fallo; no se aplicó.
Se usaron pruebas con rollback y simulación explícita de la cuenta propia.
