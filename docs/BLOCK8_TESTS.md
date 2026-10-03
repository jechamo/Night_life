# Pruebas de los bloques 7 y 8 — 2026-10-04

| Comprobación                                           | Resultado                                              |
| ------------------------------------------------------ | ------------------------------------------------------ |
| `npm run check` (TypeScript, ESLint, Prettier, Vitest) | 317/317 tests; correcto                                |
| `npm run test:blocks:7-8`                              | 69/69                                                  |
| `npm run build`                                        | Correcto; aviso del chunk diferido de Mapbox (1,86 MB) |
| `npm audit` con CA del sistema                         | 0 vulnerabilidades                                     |
| `supabase/tests/places.sql`                            | 19/19                                                  |
| `supabase/tests/provider-quotas.sql`                   | 19/19                                                  |
| `supabase/tests/osm-import.sql`                        | 13/13                                                  |
| `supabase/tests/matching.sql`                          | 62/62                                                  |
| `supabase/tests/rls.sql`                               | 33/33                                                  |
| `scripts/block8-realtime.mjs` con dos testers reales   | 16/16                                                  |

Las suites SQL terminan deliberadamente con una excepción de resumen: **0 failed**
es éxito, y la excepción revierte todos los fixtures. No interpretar ese resumen
como un fallo de implementación. Se ejecutaron por MCP en `ocrpfeqfqzchhrghqcfb`.

## Integración real

Dos sesiones Auth independientes, privadas y verificadas en sandbox. Llegadas
medidas por un único reloj de cliente, sin restar relojes distintos:

| Acción                               | Tiempo observado |
| ------------------------------------ | ---------------- |
| Check-in → segunda sesión (bloque 7) | 471 ms           |
| Match → primer/segundo tester        | 123 ms / 123 ms  |
| Diferencia entre llegadas del match  | 0 ms             |
| Enviar mensaje → segunda sesión      | 73 ms            |

Se probaron además: buzón ajeno rechazado, contexto compartido, likes simultáneos,
un solo match persistido, mensaje entrante, Broadcast sin texto del mensaje,
lectura persistida, escritura, retirada para ambos y envío denegado tras retirada.
Los dos usuarios Auth y el local temporal se retiraron al terminar. Antes/después:
**1 perfil real y 0 fixtures**.

La prueba de interfaz monta dos sesiones independientes y confirma la celebración
en ambas al recibir el match. También cubre deduplicación, retirada de caché,
Anthem persistido/reproducible, refresco de tarjetas y fallos de persistencia.
No se afirma una prueba manual de dos navegadores o de la app nativa.

## Repetir

1. `npm run test:blocks:7-8` ejecuta la selección de cliente de ambos bloques.
2. `npm run check` y `npm run build` comprueban el proyecto completo.
3. Ejecutar las suites SQL anteriores mediante Supabase MCP. Todas revierten sus cambios.
4. Para la prueba real, `node scripts/block8-fixtures.mjs` genera credenciales aleatorias
   y SQL de creación/retirada en `.tmp`, ignorado por Git. Ejecutar por MCP
   `.tmp/block8-live-setup.sql`, ejecutar `npm run test:realtime:8` y, **también si falla**,
   ejecutar `.tmp/block8-live-cleanup.sql` por MCP.
5. El runner necesita `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` en `.env.local`;
   no usa una clave `service_role`, no envía correo/SMS y no necesita OTP del propietario.
   Guardar el resumen de `.tmp/block8-realtime-results.json`; retirar credenciales locales
   cuando ya se haya ejecutado la limpieza.

## Despliegue verificado

- URL: https://nightlife-connect-beige.vercel.app.
- Destino: producción. Estado: **READY**. Framework: Vite. Build remoto: 34 s.
- Commit: `e605cb51de82dfa9c1beef56951a489f0b8c06a2` (`codex/block8`).
- Despliegue: `dpl_FQFX4d5Q1rpbZyLYxJcVJy5biGun`; el MCP confirma el SHA en sus metadatos.
- HTTP 200 y CSP exacta; scripts iniciales servidos correctamente y RPC de matching/chat
  presentes en el bundle. Audio local idéntico por SHA-256. Mapbox fuera del HTML/precache.
- Logs de Vercel del despliegue, últimos 10 minutos: sin entradas error/fatal.
  La app es estática; esta consulta no comprueba errores del navegador ni de Supabase.
- CLI oficial 62.2.0 con autenticación existente como alternativa al comando MCP
  no disponible. Se publicó un archivo del commit, sin `.env.local` ni fixtures personales.

## Límites documentados

- Anthem usa metadatos de prueba persistidos y una muestra sintética propia; Spotify
  no está conectado ni se ha contratado Premium (PRD 11.3).
- Advisors: WARN previo de protección de contraseñas y INFO de tablas privadas con
  RLS, sin políticas y privilegios revocados. Sin hallazgos nuevos críticos/altos.
- Mapbox continúa con la configuración y cuota del bloque 7; estas pruebas no
  activan proveedores, suscripciones ni nuevas cuentas facturables.
