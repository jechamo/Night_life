# Publicación y rollback

Proyecto Vercel existente `nightlife-connect`, conectado a `jechamo/Night_life`.
La URL de producción se conserva: https://nightlife-connect-beige.vercel.app.

## Flujo

1. Crear una rama `codex/...` desde `develop`.
2. Cada push genera una preview en Vercel. CI `Quality` ejecuta instalación con
   lockfile y sin scripts de instalación, tipos, lint, formato, pruebas y build
   en Node 24. Las acciones oficiales se fijan por SHA.
3. Abrir PR a `develop`, comprobar CI y preview, e integrar conservando commits.
4. Aplicar las migraciones compatibles a Supabase y comprobar RLS y los RPC antes
   de publicar un frontend que los necesite. Preview y producción son destinos
   distintos de Vercel; actualmente comparten Supabase y los pagos siguen en TEST.
   Las previews tienen acceso a ese backend: no son un entorno de datos aislado.
5. Abrir PR `develop` → `main` con `Quality` correcto y rama actualizada. La
   integración activa producción automáticamente; verificar READY, SHA y alias.

`main` y `develop` parten del estado validado `3835fffb`, conservando ramas e
historial anteriores. `main` es la rama predeterminada y de producción.

## Historial de migraciones

Alineado el 08/10/2026 (60 versiones, idénticas en el repositorio y en
`supabase_migrations.schema_migrations`):

- Las seis migraciones del 05/10 se renombraron en el repositorio a la versión con
  la que se aplicaron (contenido verificado por md5).
- `20261005173548_home_dashboard` y las cuatro del Bloque 5 (`rpc_block5`,
  `purge_test_data`, `seed_legal_documents`, `grants`), aplicadas en el SQL Editor,
  se registraron en el historial sin volver a ejecutarse (sus objetos existen).
- Nueva `20261008092243_likes_seen_sender_idx` (índice aditivo, MCP).

Regla: toda migración nueva se aplica con MCP `apply_migration` (o `db push`) y el
fichero se guarda con la versión que devuelve el historial remoto. Si algo se aplica a
mano, registrar su versión en el mismo cambio.

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
