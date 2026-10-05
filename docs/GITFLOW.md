# Publicación y rollback

Proyecto Vercel existente `nightlife-connect`, conectado a `jechamo/Night_life`.
La URL de producción se conserva: https://nightlife-connect-beige.vercel.app.

## Flujo

1. Crear una rama `codex/...` desde `develop`.
2. Cada push genera una preview en Vercel. CI `Quality` ejecuta instalación con
   lockfile, tipos, lint, formato, pruebas y build en Node 24.
3. Abrir PR a `develop`, comprobar CI y preview, e integrar conservando commits.
4. Aplicar las migraciones compatibles a Supabase y comprobar RLS y los RPC antes
   de publicar un frontend que los necesite. Preview y producción son destinos
   distintos de Vercel; actualmente comparten Supabase y los pagos siguen en TEST.
   Las previews tienen acceso a ese backend: no son un entorno de datos aislado.
5. Abrir PR `develop` → `main` con `Quality` correcto y rama actualizada. La
   integración activa producción automáticamente; verificar READY, SHA y alias.

`main` y `develop` parten del estado validado `3835fffb`, conservando ramas e
historial anteriores. `main` es la rama predeterminada y de producción.

## Migración aplicada manualmente

El propietario confirmó la ejecución de `20261005173548_home_dashboard.sql` en
SQL Editor el 05/10/2026. Las seis funciones existen y rechazan acceso anónimo.
La ejecución manual no registra automáticamente `supabase_migrations`.
Antes de usar `db push`, verificar el esquema y registrar esa versión como
aplicada con `supabase migration repair 20261005173548 --status applied --linked`
desde una cuenta autorizada, o el mecanismo equivalente de Management API.
No volver a ejecutar las sentencias CREATE sobre el esquema ya existente.

## Rollback

- Frontend: revertir el PR en una nueva rama y recorrer `develop` → `main`.
  Para restauración inmediata, Vercel permite rollback al último deployment
  validado. Confirmar después el alias y publicar el revert para alinear Git.
- Backend: esta migración es aditiva. Mantener tablas/RPC al revertir el frontend;
  el código anterior continúa funcionando y se conservan favoritos y recibos.
  Cualquier corrección posterior requiere otra migración versionada.
- No activar Stripe LIVE ni cambiar planes. Revisar solo nombres/destinos de
  variables de entorno; secretos y tokens nunca se incorporan a Git.

Referencia: [Integración Git de Vercel](https://vercel.com/docs/git).
