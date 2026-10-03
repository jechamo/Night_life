# Bloque 6 — Plan y puesta en marcha

Estado: migración y Edge Functions aplicadas en Nightlife_Connect. Falta el webhook en
Veriff Station y una decisión de test de extremo a extremo.

## Plan

1. Sesiones mínimas de verificación y resultados persistidos con RLS, separación
   sandbox/live, caducidad e idempotencia del webhook.
2. Adaptador de la app, revisión humana y simulador solo para tester/admin con
   `test_tools_enabled`, `verification_mode = sandbox` y `verification_provider = simulator`.
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

El retorno del navegador no acredita la edad: solo el resultado firmado procesado en servidor
puede conceder la verificación. No se conservan selfies, documentos ni descriptores biométricos.
Las decisiones de la integración de test se guardan como `mode = sandbox` y no acreditan
identidad real.

En `verification_provider = simulator` el simulador interno exige rol tester/admin y flag de
herramientas. Si faltan secretos, la Edge Function responde «No disponible» y no abre un mock.

## Documentación de los proveedores

- [Veriff: crear sesión](https://devdocs.veriff.com/apidocs/v1sessions)
- [Veriff: webhooks](https://devdocs.veriff.com/docs/webhooks-guide)
- [Veriff: HMAC](https://devdocs.veriff.com/docs/hmac-authentication-and-endpoint-security)
- [Yoti: crear sesión](https://developers.yoti.com/age-verification/create-a-session)
- [Supabase: seguridad de las Edge Functions](https://supabase.com/docs/guides/functions/auth)
