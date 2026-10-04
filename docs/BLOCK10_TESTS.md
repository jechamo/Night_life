# Pruebas del Bloque 10 — 2026-10-04

Plan en `BLOCK10_PLAN.md`. La checklist separa evidencia automática, comprobación
de despliegue y pruebas que aún requieren dispositivos o configuración externa.

## Resultados reproducibles

| Comprobación                      | Resultado                                                                                                                               |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check`                   | 344/344 en 47 archivos; TypeScript, ESLint y formato correctos                                                                          |
| PWA (`app-updates` y `AppStatus`) | 10 casos: registro, actualización explícita, no recarga inicial, conexión y error de chunk                                              |
| Aislamiento de mutaciones         | 3 casos: respuesta privada de A descartada tras entrar B; callback de contacto no ejecutado; GPS tardío no escribe bajo B               |
| Accesibilidad compartida          | 6 casos: teclado de checkbox/switch/range, error descrito y navegación sin foco duplicado                                               |
| Contraste                         | Tokens de cinco temas: texto/estados 4,5:1 y foco 3:1; no acredita todas las pantallas con lector real                                  |
| Deno `_shared/*.test.ts`          | 33/33: Veriff, Yoti, OSM, facturación y borrado de fotos                                                                                |
| `deno check`                      | 13 entrypoints Edge correctos, Supabase fijado a 2.117.2                                                                                |
| SQL remoto con rollback           | bloque 10 19/19 y privacidad 4/4; RLS 33/33; bloque 9 72/72; matching 62/62; lugares 19/19; cuotas 19/19; OSM 13/13; verificación 54/54 |
| `npm audit`                       | Cero vulnerabilidades en el grafo npm de frontend/desarrollo                                                                            |
| SBOM Edge / audit                 | Diez componentes npm, once paquetes con raíz; cero vulnerabilidades                                                                     |
| `npm run test:network:10`         | 29/29: guards HTTP de 13 funciones, CORS y esquemas internos                                                                            |
| Build                             | Correcto; Mapbox diferido conserva aviso de tamaño                                                                                      |

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
- Check-in captura la generación antes de pedir GPS y la comprueba antes de escribir.
  Cambiar de A a B mientras espera la ubicación no registra asistencia bajo B.
- Búsqueda elimina `sort_key` del JSON y ordena por la banda pública de asistentes.
  La prueba de privacidad fallaba 2/4 antes de corregirla y pasa 4/4 después;
  ni el campo interno ni el orden revelan recuentos exactos de uno a cuatro.
- `signed-documents` autentica antes de parsear; junto con `test-tools` utiliza
  JSON acotado a 2.048 bytes después de autorizar al actor.

## PWA, tamaño y navegador

- Registro manual desde el puerto `appUpdates`, solo en producción web. Buscar
  actualización al enfocar/volver online y cada cinco minutos. Mostrar acción
  explícita; no recargar una primera instalación ni borrar la sesión.
- `runtimeCaching: []`: API, Auth, fotos y Mapbox fuera del precache. El shell incluye
  JS/CSS/HTML, fuentes e iconos. El banner offline no presenta datos remotos como actuales.
- Entry JS antes: 489,65 kB (157,85 gzip); después: 130,52 kB (43,37 gzip).
  Esa reducción afecta al entry, no al total del arranque. HTML + preloads + CSS:
  1.409.330 bytes, 445.101 gzip; 148 entradas precache, 2.279,29 KiB.
- Navegador integrado, build local real: `/legal` y documento de privacidad cargan
  desde Supabase, sin desbordamiento a 390 px; main enfocable y enlaces del listado
  entre 64 y 89 px de alto. No se aceptaron términos ni se enviaron formularios.
- ✅ Instalación/apertura como app confirmadas por el propietario el 2026-10-04:
  Samsung «fold7z» (nombre indicado) e iPhone 11. Respondió «Listo, funciona» al
  protocolo de instalación, apertura standalone y conservación de sesión.
  Versiones indicadas: One UI 8.5 e iOS 17.4.1; versión base de Android no indicada.
  Esta evidencia es una prueba manual del propietario, distinta de una medición
  instrumentada.
- ✅ Con la app cargada: aviso offline al activar modo avión, recuperación de datos
  y conservación de sesión al reconectar. El propietario confirmó «Funciona en ambos»
  en los mismos dispositivos. No acredita arranque frío offline ni fps.
- ❌ Actualización desde una versión anterior, cámara/geolocalización y VoiceOver/TalkBack
  en Chrome Android/Safari iOS.
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
la reconciliación acredita 469/469 archivos de código seleccionados, con el contrato
generado de tipos excluido por no contener implementación. Configuración externa,
dependencias, documentos y recursos quedan delimitados en `SECURITY.md`; no es una
certificación de toda la instalación ni de los proveedores.
El resultado conserva un riesgo bajo condicionado al enforcement externo de OTP
y la evidencia de los ocho candidatos corregidos.

Advisors de seguridad: 13 INFO de tablas privadas con RLS sin políticas y grants
cerrados; 1 WARN de protección de contraseñas filtradas. Rendimiento: 14 INFO de
índices sin uso. ❌ Criterio literal «cero Advisors». No se añadieron políticas
permisivas ni se eliminaron índices solo para ocultar esos avisos.

## Publicación comprobada

- Rama `codex/block10`, commit de implementación
  `03c8b4dfb685251ce5483ae664f32107e92ec6b8`, enviado a origin.
- Vercel MCP confirma `READY`, producción, proyecto existente y el mismo SHA:
  `dpl_HhUrTTXX6erR4byWVRHrDTXd6BNX`. Alias
  [Nightlife Connect](https://nightlife-connect-beige.vercel.app).
  Se utilizó el fallback ya autorizado al CLI oficial; el MCP disponible no
  expone la creación de despliegues. No se cambió plan, proyecto ni protección.
- HTTP del alias sirve `/assets/index-gpt5hk31.js`, 131.654 bytes,
  SHA256 `8bb654ece4a934513967b2ec7af1330ed61b02580a1bd7988016ce3bca247062`.
  CSP coincide con `vercel.json`; `sw.js` tiene `no-cache, no-store,
must-revalidate`. Manifest standalone y tres iconos PNG con dimensiones
  192/512 verificadas; Mapbox no figura en HTML inicial ni precache.
- Trece funciones Edge ACTIVE; versiones finales `signed-documents` 14 y
  `test-tools` 12. Guards HTTP de red 29/29 tras esos redespliegues.
- ❌ No se acreditó la actualización de la pestaña antigua integrada: la herramienta
  CUA falló al iniciar con `failed to write kernel assets ... os error 3`, incluso
  tras reiniciar su sesión. No se borró caché/Auth ni se dio la recarga por probada.
  Las pruebas locales anteriores y las unitarias PWA siguen siendo evidencia distinta.

Los commits posteriores dedicados a documentación conservan ese artefacto.
El hotfix descrito a continuación sí sustituye su implementación.

## Hotfix de Admin ausente — 2026-10-04

La cuenta administrativa conserva sus roles en Supabase y puede leerlos con RLS
en `aal1`. El adaptador llamaba a `must()` sobre `account_activity`, un RPC que
devuelve `void`: una respuesta correcta con `data: null` lanzaba `no_data` antes
de leer `user_roles`. El menú ocultaba Admin y `/admin` devolvía al perfil.

- Regresión de adaptador reproducida antes de corregir: falla con `no_data`.
  Ahora se comprueba `error` del RPC y se permite su retorno vacío; los errores
  reales y de lectura de roles siguen rechazándose. Sin cambios de roles ni RLS.
- Por petición del propietario se publicó tras compilar y se ejecutó la suite
  después: **348/348**, TypeScript, ESLint y Prettier correctos. El build local
  y el build de Vercel completaron sin errores.
- Implementación `a1ad387c2b4a8b6c49dd20af5eae4e24b8dfeb43`, enviada a origin.
  Vercel MCP confirma `dpl_2bYEPajzyLGayBwq5Xuik6UN2Ket` READY, producción,
  SHA y alias habituales. HTTP a las 20:20 UTC sirve `/assets/index-BF1tIY3e.js`,
  131.716 bytes, SHA256
  `568454e7601fb9c89e629cc27e301ef70cfad84dd11736bf1d3f0fb96813c082`;
  contiene la corrección y `sw.js` referencia ese entry con `no-cache, no-store,
must-revalidate`.
- SQL remoto, con rollback: rol Admin legible antes de MFA; dashboard rechazado
  en `aal1` y admitido para admin activo en `aal2`; caller sin rol Admin rechazado
  incluso en `aal2`. JWT de prueba y consultas internas no acreditan un login/MFA
  real. Un primer control que suponía que la otra cuenta seguía siendo usuario
  normal se descartó: sus roles se habían cambiado antes de esta comprobación.
- ❌ La herramienta CUA continúa fallando al iniciar (`failed to write kernel
assets ... os error 3`), también tras reset. No se inspeccionó ni modificó el
  almacenamiento de la pestaña. Falta confirmar visualmente, tras actualizar,
  que el propietario ve Admin y entra por el segundo factor.

Para repetir: `npm run check`, `npm run build`; en la cuenta admin actualizar
la app, abrir Perfil → Admin y completar su TOTP. Una cuenta sin Admin sigue
sin ese enlace y las acciones de servidor requieren rol activo y `aal2`.

## Cómo repetir

1. `npm ci`, `npm run check`, `npm run build`, `npm audit`, `npm run test:network:10`.
2. Ejecutar las suites SQL completas por MCP, preservando rollback y resumen final.
3. Deno: ejecutar desde un directorio temporal con `--no-config --no-lock
--node-modules-dir=none`, certificados `system,mozilla`, y `DENO_DIR` temporal.
   Tests requieren `--allow-env --allow-read`; usar rutas absolutas a `_shared/*.test.ts`.
4. Verificar deployment READY, SHA, headers/CSP, worker sin caché HTTP duradera,
   manifest/iconos y funciones ACTIVE antes de probar ambos dispositivos.
