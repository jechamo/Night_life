# Bloque 6 — Plan y puesta en marcha

Estado: migraciones y Edge Functions aplicadas y revisadas en Nightlife_Connect. La creación
real de sesión Test, el webhook firmado de rechazo y la revisión solicitada están comprobados.
La aprobación Test firmada también está comprobada, con identidad persistida en sandbox.
Las validaciones de personas reales, la activación live y la habilitación/prueba del borrado
del proveedor pertenecen al Bloque 12 por decisión del propietario (2026-10-03).

## Plan

1. Sesiones mínimas de verificación y resultados persistidos con RLS, separación
   sandbox/live, caducidad e idempotencia del webhook.
2. Adaptador de la app, revisión humana y simulador solo para tester/admin con
   `test_tools_enabled` y `verification_mode = sandbox`. El proveedor puede ser simulator,
   o el tester puede elegir explícitamente la simulación si Veriff no está disponible.
3. Veriff (integración de test) como proveedor principal: sesión `POST /v1/sessions`,
   webhook HMAC-SHA256 y almacenamiento exclusivo de resultado/método/umbral/fecha/identificadores.
   Yoti permanece como alternativa para edad en live.
4. Bloquear perfiles, likes y chat en servicios y en las políticas del servidor;
   invalidar el badge de foto al cambiar la principal y conservar bans mediante HMAC.
5. Comprobar tipos, lint, formato, tests, build, SQL/RLS y dependencias. Validación live
   de identidad y de foto comparada queda para el Bloque 12.

## Secretos (servidor)

Configurar exclusivamente en Supabase Secrets, nunca en `VITE_*` ni en el repositorio:

- `VERIFF_API_KEY`
- `VERIF_SHARED_SECRET` (nombre real en Supabase Secrets; también se acepta `VERIFF_SHARED_SECRET`)
- `VERIFF_BASE_URL` opcional; por defecto `https://api-saas.veriff.com`
- `APP_ORIGIN` (origen HTTPS de la app)
- Yoti, si se usa: `YOTI_AGE_SDK_ID`, `YOTI_AGE_API_TOKEN`

`SUPABASE_URL` y las claves del backend las proporciona el runtime de las Edge Functions.

## Despliegue

Desplegar `verification`, `veriff-webhook` y `yoti-webhook` con `verify_jwt = false` en
`supabase/config.toml` (cada función autentica por su cuenta: JWT de usuario, HMAC o RSA-PSS).
Webhook de decisión en Veriff Station:

`https://ocrpfeqfqzchhrghqcfb.supabase.co/functions/v1/veriff-webhook`

En Station: Workspace → All integrations → **Nightlife (TEST)** → Settings →
**Webhook decisions URL → URL**. Se guarda al salir del campo y aparece «URL is updated».
La integración conectada es `4c11e2ea-94a2-43f8-a34c-5aaeee4558cb`; «Test Company Jorge
Chamorro» es otra integración Test. Mantener Check certificates activado. El webhook de
eventos no concede verificaciones y no lo consume esta aplicación.

El retorno del navegador no acredita la edad: solo el resultado firmado procesado en servidor
puede conceder la verificación. No se conservan selfies, documentos ni descriptores biométricos.
Las decisiones de la integración de test se guardan como `mode = sandbox` y no acreditan
identidad real.

En `verification_provider = simulator` el simulador interno exige rol tester/admin y flag de
herramientas. Con Veriff activo, la foto también usa el simulador persistido (la integración de
test no compara la selfie con la foto del perfil). Si faltan secretos o caduca el acceso,
la Edge Function responde «No disponible» y el tester puede pulsar «Usar simulación de
prueba»; esta elección inicia una sesión en Supabase y no devuelve éxito local automático.

`private.verification_provider_access` registra proveedor, capacidad, modo, disponibilidad,
entorno, caducidad y última confirmación. Está cerrada a anon/authenticated y sus cambios
quedan auditados. La disponibilidad se comprueba antes de crear sesión o llamar a Veriff.
Station mostró 14 días de trial el 2026-10-03: se fijó un corte conservador en
`2026-10-16T00:00:00Z`, no una afirmación de la fecha contractual exacta. Veriff edad/identidad
están disponibles en Test; foto usa simulación independiente; Yoti live sigue deshabilitado.

Una sesión creada desde la app llegó a Veriff Test a las 17:48 UTC del 2026-10-03.
El propietario completó personalmente dos flujos de captura. Station entregó decisiones de
rechazo y aprobación con HTTP 200; la solicitud de revisión aparece en la cola real del admin.
Station Test no ofrece forzar `review`; ese payload se cubre en las pruebas automatizadas.
No introducir documentos, selfies ni enlaces de sesión en el repositorio o en los logs.

## Revisión humana

Las decisiones dudosas (`review` de Veriff, aprobación sin fecha de nacimiento, denegaciones del
simulador) y las solicitudes de revisión del usuario tras un fallo quedan en
`manual_review` y aparecen en Admin → Verificaciones (admin con MFA). Aprobar concede el nivel
con `verification_provider = human_review`; rechazar es definitivo para esa sesión. Ambas
acciones quedan auditadas.

## Borrado en Veriff

Se solicita el borrado de la sesión del proveedor solo con resultado final confirmado en Supabase (nivel
aprobado o caducado). Identidad no requiere acreditar edad; edad aprobada sin fecha de
nacimiento permanece en revisión. Rechazos y revisiones conservan la evidencia del proveedor.

La integración actual devuelve 403: DELETE requiere habilitación por soporte de Veriff.
`record_verification_cleanup` registra HTTP y estado aceptado/pendiente sin guardar cuerpos
del proveedor. La respuesta 403 no acredita borrado. Por decisión del propietario, habilitación
y comprobación real quedan en el Bloque 12; no bloquean el cierre de pruebas del Bloque 6.
[Documentación de borrado](https://devdocs.veriff.com/apidocs/v1sessionsid-3).

En sandbox, el tester también puede escoger explícitamente «Usar simulación de prueba»
para edad aunque Veriff esté disponible. Es una sesión propia persistida; no cambia la
disponibilidad global del proveedor ni acredita edad real.

## Documentación de los proveedores

- [Veriff: crear sesión](https://devdocs.veriff.com/apidocs/v1sessions)
- [Veriff: webhooks](https://devdocs.veriff.com/docs/webhooks-guide)
- [Veriff: HMAC](https://devdocs.veriff.com/docs/hmac-authentication-and-endpoint-security)
- [Yoti: crear sesión](https://developers.yoti.com/age-verification/create-a-session)
- [Supabase: seguridad de las Edge Functions](https://supabase.com/docs/guides/functions/auth)
