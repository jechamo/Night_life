# Pruebas del Bloque 10 — 2026-10-04

Plan en `BLOCK10_PLAN.md`. La checklist separa evidencia automática, comprobación
de despliegue y pruebas que aún requieren dispositivos o configuración externa.

## Resultados reproducibles

| Comprobación                      | Resultado                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                   | 343/343 en 47 archivos; TypeScript, ESLint y formato correctos                                                         |
| PWA (`app-updates` y `AppStatus`) | 10 casos: registro, actualización explícita, no recarga inicial, conexión y error de chunk                             |
| Aislamiento de mutaciones         | 2 casos: respuesta privada de A descartada tras entrar B; callback de contacto no ejecutado                            |
| Accesibilidad compartida          | 6 casos: teclado de checkbox/switch/range, error descrito y navegación sin foco duplicado                              |
| Contraste                         | Tokens de cinco temas: texto/estados 4,5:1 y foco 3:1; no acredita todas las pantallas con lector real                 |
| Deno `_shared/*.test.ts`          | 33/33: Veriff, Yoti, OSM, facturación y borrado de fotos                                                               |
| `deno check`                      | 13 entrypoints Edge correctos, Supabase fijado a 2.117.2                                                               |
| SQL remoto con rollback           | bloque 10 19/19; RLS 33/33; bloque 9 72/72; matching 62/62; lugares 19/19; cuotas 19/19; OSM 13/13; verificación 54/54 |
| `npm audit`                       | Cero vulnerabilidades en el grafo npm de frontend/desarrollo                                                           |
| SBOM Edge / audit                 | Diez componentes npm, once paquetes con raíz; cero vulnerabilidades                                                    |
| `npm run test:network:10`         | 29/29: guards HTTP de 13 funciones, CORS y esquemas internos                                                           |
| Build                             | Correcto; Mapbox diferido conserva aviso de tamaño                                                                     |

Las suites SQL terminan con `RAISE EXCEPTION` que incluye el recuento y revierte
la transacción. El error P0001 con `failed: []` es el resultado esperado, no una
prueba fallida. No ejecutar por separado sus INSERT de fixtures. Tras las pruebas:
un perfil real y cero fixtures; ningún cambio al perfil del propietario.

`verification.sql` ajusta fixtures para el control de admin activo y edad vigente
de ambos participantes. Conserva los casos de denegación; no relaja los guards.

## Abuso y mitigaciones

- Onboarding comprueba bans sobre el teléfono confirmado de Auth, con compatibilidad
  de hashes anteriores y señal de dispositivo; no confía en el teléfono del cuerpo.
  La emisión directa de OTP aún necesita comprobar los controles externos de Auth.
- Admin exige perfil activo, rol y aal2, también en helpers antiguos; herramientas
  Edge deniegan perfiles suspendidos antes de atender flags/roles.
- Storage privado: archivos planos UUID del dueño, PNG/JPEG/WebP, 5 MiB, máximo diez
  objetos por usuario; permite reemplazar cinco fotos. UPDATE/overwrite denegado.
- Envío directo/outbox de PDF comparten cuota de 3/h por usuario y 50/día globales.
  `sign_documents` admite 1–8 entradas y es idempotente por documento/versión.
- Borrado recorre carpetas anteriores con límites de profundidad/solicitudes y
  detección de falta de progreso. Un fallo impide borrar Auth y permite reintentar.
- Mutaciones privadas comprueban la generación de sesión antes de publicar datos,
  abrir enlaces o descargar export/PDF. Las transiciones legítimas de Auth conservan
  su manejo específico.

## PWA, tamaño y navegador

- Registro manual desde el puerto `appUpdates`, solo en producción web. Buscar
  actualización al enfocar/volver online y cada cinco minutos. Mostrar acción
  explícita; no recargar una primera instalación ni borrar la sesión.
- `runtimeCaching: []`: API, Auth, fotos y Mapbox fuera del precache. El shell incluye
  JS/CSS/HTML, fuentes e iconos. El banner offline no presenta datos remotos como actuales.
- Entry JS antes: 489,65 kB (157,85 gzip); después: 130,52 kB (43,37 gzip).
  Esa reducción afecta al entry, no al total del arranque. HTML + preloads + CSS:
  1.409.330 bytes, 445.101 gzip; 148 entradas precache, 2.279,26 KiB.
- Navegador integrado, build local real: `/legal` y documento de privacidad cargan
  desde Supabase, sin desbordamiento a 390 px; main enfocable y enlaces del listado
  entre 64 y 89 px de alto. No se aceptaron términos ni se enviaron formularios.
- ❌ Instalación, apertura offline real, cámara/geolocalización y VoiceOver/TalkBack
  en Chrome Android/Safari iOS. El propietario dispone de ambos dispositivos.
- ❌ 60 fps en dispositivos reales: tamaño del build y tokens no prueban fluidez.

### Protocolo de dispositivos

En Android abrir el alias HTTPS con Chrome y utilizar la opción de instalación.
En iPhone abrir Safari → Compartir → Añadir a la pantalla de inicio, con «Abrir
como app web» si aparece; [guía de Apple](https://support.apple.com/en-hk/guide/iphone/iphea86e5236/ios).
Abrir desde el icono, comprobar modo standalone, sesión, teclado, safe areas y
cinco temas. Con el shell cargado, probar modo avión: aviso offline y navegación
disponible; los datos nuevos y las compras requieren conexión. Reconectar y
comprobar recuperación. Registrar modelo, SO, navegador, fecha y fallos.

Para actualización, dejar una versión anterior abierta, publicar una versión
validada y volver a la app. Debe ofrecer «Actualizar»; pulsar conserva la sesión
y obtiene el bundle nuevo. Una pestaña anterior a este bloque puede necesitar
una segunda recarga después de instalar el worker nuevo. No limpiar Storage/Auth
para fingir el resultado. Medir swipes, mapas, sheets y transiciones con herramientas
de rendimiento del dispositivo; no atribuir 60 fps a una impresión visual.

## Puerta de seguridad

Revisión de código independiente con Codex Security, arquitectura e investigación
de controles. ID `56b027a0-7e56-4eb3-97dc-5f5714b5a153`. Ningún crítico/alto confirmado
en lo revisado. Los informes y las correcciones conservan los hallazgos originales;
la cobertura no se denomina exhaustiva mientras haya límites de configuración y
de conservación de inventario detallados en `SECURITY.md`.

Advisors de seguridad: 13 INFO de tablas privadas con RLS sin políticas y grants
cerrados; 1 WARN de protección de contraseñas filtradas. Rendimiento: 14 INFO de
índices sin uso. ❌ Criterio literal «cero Advisors». No se añadieron políticas
permisivas ni se eliminaron índices solo para ocultar esos avisos.

## Cómo repetir

1. `npm ci`, `npm run check`, `npm run build`, `npm audit`, `npm run test:network:10`.
2. Ejecutar las suites SQL completas por MCP, preservando rollback y resumen final.
3. Deno: ejecutar desde un directorio temporal con `--no-config --no-lock
--node-modules-dir=none`, certificados `system,mozilla`, y `DENO_DIR` temporal.
   Tests requieren `--allow-env --allow-read`; usar rutas absolutas a `_shared/*.test.ts`.
4. Verificar deployment READY, SHA, headers/CSP, worker sin caché HTTP duradera,
   manifest/iconos y funciones ACTIVE antes de probar ambos dispositivos.
