# Seguridad — modelo de amenazas y controles

Documento vivo (PRD 6.15). Se actualiza en la puerta de seguridad de cada bloque.

## R3 — Partners y contratos — 08/10/2026

- A01/API1/API5: empresas, contratos, ventajas e invitaciones en tablas `private` con RLS y
  sin grants; solo RPC `security definer` con envoltorios `invoker`; admin exige rol + `aal2`;
  el plan del local solo lo leen sus gestores; el equipo solo lo gestiona el titular (no
  puede quitarse a sí mismo; solo quita encargados).
- A02/A07: códigos de invitación de 48 bits aleatorios (`gen_random_bytes`), un solo uso,
  caducan a los 7 días, revocables; en la base solo se guarda `hmac_hex` (Vault). Límite de
  20 intentos/hora por persona e IP (`case_limit`). El código pendiente en el dispositivo
  caduca a los 7 días y se borra al canjearlo.
- A04: flag comprobado en servidor; aceptar las Condiciones para Locales es obligatorio
  para canjear (y para reclamar con el flag encendido) y queda en `consent_records`.
- Integridad comercial: los patrocinios de contrato se marcan con su ventaja y terminan con
  el contrato (manual o cron diario); no ocupan huecos de ciudad (decisión del propietario);
  el límite de 3 sigue para Stripe y factura. Todas las acciones quedan auditadas.
- RGPD: datos de contacto de empresas solo para admin; sin PDF ni documentos en la app.
- Pruebas: partners 37/37, RLS 36/36, block9 72/72, premium-completion 45/45; Advisors sin
  errores.

## R2 — «Cómo está ahora» — 08/10/2026

- A01/API1: votos en `private.place_reports` sin permisos de cliente (RLS activo, sin
  grants); solo RPC `security definer` en `private` con envoltorios `invoker` en `public`,
  ejecutables solo por `authenticated`. Respuestas agregadas, nunca quién votó.
- A04 anti-manipulación: flag comprobado en servidor; cuenta completa no baneada; voto solo
  con check-in activo en ese sitio; un voto por persona, pregunta y noche (cambiarlo no
  suma); gestores no votan en su local; valores de lista cerrada; límites de uso por
  persona (60 votos, 600 lecturas, 30 cambios de música); umbral de 3 votos.
- Datos de prueba: votos de cuentas `is_test` solo cuentan para testers/admin.
- RGPD: los votos salen en la exportación de datos; retención 60 días (cron diario);
  borrado en cascada con la cuenta, el local o el evento.
- Line-up: texto ≤120 caracteres, recortado, mostrado como texto (React escapa); caduca al
  cambiar de noche. Acciones del gestor auditadas (`venue.music`).
- Pruebas: SQL 27/27, RLS 36/36 (usuario no puede encender el flag), Advisors sin errores.

## R1 — Entrar por email y guías — 08/10/2026

- A07 (autenticación): código por email con `shouldCreateUser: false`; el alta sigue
  exigiendo teléfono, firma y comprobación de bans. Sin enumeración de cuentas: misma
  respuesta y mismo error de código con o sin cuenta. Límites de Supabase Auth.
- Cuentas creadas solo con email por la API no pueden completar el alta (teléfono
  confirmado obligatorio) ni usar RPC (`require_registered`: completa, no baneada ni
  suspendida). El flag solo lo cambia un admin con `aal2` (RLS 35/35, 2 pruebas nuevas).
- A04: flag apagado por defecto y valor seguro `off` en cliente; sin flag, cero cambios.
- Guías públicas: solo textos traducidos, sin datos personales ni llamadas a red.
- Pendiente: SMTP propio y plantilla con `{{ .Token }}` (`docs/AUTH_EMAIL.md`).

## Historial de migraciones — 08/10/2026

- Historial remoto y repositorio coinciden (60 versiones). Un `db push` ya no
  reaplicaría SQL existente. Solo se insertaron filas en el historial y un índice aditivo.
- Advisors tras el cambio: seguridad igual (0 errores, 1 WARN conocido, 18 INFO
  intencionados); la FK sin índice de `private.likes_seen` queda resuelta.

## Revisión 08/10/2026 (Bloque 0 y compras)

- A05/A08: corregido el riesgo de que las E2E reutilizaran `npm run preview` (Supabase
  real) en el puerto 4173. Puerto propio 4399, sin reutilización y guardia de red que
  aborta y suspende la prueba ante cualquier origen distinto de la app local.
- Transparencia comercial: «Modo viaje» deja de anunciarse como ventaja activa
  mientras `travel_mode_enabled` esté apagado.
- BBDD comprobada por MCP con las suites de RLS/RPC del repo (321 pruebas en verde;
  `block10.sql` pendiente de aprobación manual). Advisors sin errores.
- Stripe: Edge Functions desplegadas idénticas al repo (firma, pedido, cliente,
  importe/periodo y modo verificados en servidor). Sin claves ni precios LIVE.
- Pendiente: auditoría de red HTTP y revisión de eventos del webhook en el panel de
  Stripe.

## Roadmap 2026-10 · Bloque 0 (red de regresión E2E) — 08/10/2026

- Solo herramientas de desarrollo: `@playwright/test@1.63.0` (+ `playwright`,
  `playwright-core`), Apache-2.0, lista permitida PRD 3.5. No entra en el bundle ni en
  la PWA; `npm audit`: 0 vulnerabilidades (incluye desarrollo).
- Aislamiento: el servidor de pruebas fuerza `VITE_SUPABASE_URL` y la clave publicable
  vacías, así que ninguna prueba crea usuarios, OTP, compras o claims en el proyecto
  compartido. Sin secretos ni datos personales en `e2e/`; fotos de prueba = icono público.
- Las pruebas fijan controles existentes como regresión: casillas no premarcadas,
  consentimientos apagados por defecto, bloqueo de menores, puerta de edad para
  perfiles, rutas privadas tras cerrar sesión, código OTP erróneo rechazado, segundo
  factor del admin, nota obligatoria al decidir un claim y web legal sin login.
- CI: el job nuevo reutiliza las acciones fijadas por SHA y `npm ci --ignore-scripts`;
  el navegador se instala explícitamente con `playwright install --with-deps chromium`.
- Sin migraciones, RLS, Edge Functions ni cambios de CSP/red en la app.

## Inicio previo al bloque 11 — 05/10/2026

- Migración aditiva `20261005173548_home_dashboard`: favoritos con RLS de dueño,
  escritura exclusivamente RPC, estados deseados idempotentes y FK Auth con
  cascada. Snapshots/recibos en `private`, con RLS y sin grants de cliente.
- Envoltorios públicos invoker y helpers privados con `search_path=''`. Los
  callers exigen registro activo y cuotas; métricas y snapshots sociales exigen
  mayoría verificada y reutilizan filtros de pareja/match, bloqueos y TEST.
- Rankings «Ya están allí» usan la banda pública, también para ordenar y dibujar
  barras; por debajo de cinco no se devuelven edad, semáforo ni proporciones.
- La confirmación de likes usa token opaco ligado al usuario, plazo de una hora
  y emisor/fecha exactos. No se acepta una marca temporal suministrada por cliente.
  Los perfiles continúan sujetos al entitlement Premium y su autorización de fotos.
- El propietario confirmó la aplicación manual en SQL Editor. Se comprobaron por
  HTTP las seis funciones: 401/42501 sin sesión, sin escrituras. Red del bloque 10:
  29/29; `npm audit`: cero vulnerabilidades, incluyendo desarrollo.
- MCP Supabase sigue sin estar disponible de forma estable. No se presenta como
  ejecutada la validación SQL con rollback ni una nueva lectura de Advisors.
  También queda pendiente registrar la versión aplicada en historial de migraciones
  y regenerar todos los tipos desde servidor. Ver `GITFLOW.md` antes de `db push`.
- Revisión local de interfaces, fallo de carga, caché y generación de sesión;
  no atribuir el cambio al scan independiente anterior ni a pruebas físicas nuevas.
- `main` exige PR, `Quality`, rama actualizada y conversaciones resueltas, también
  para administradores. No se permiten force-push ni borrado de la rama.

## Cierre funcional adicional 8/9 — 2026-10-05

Revisión del cambio y regresiones propias, posterior al scan independiente del
bloque 10; no se atribuye cobertura nueva a aquel informe ya sellado.

- Nuevas tablas sociales `private` con RLS y grants cerrados; envoltorios públicos
  invoker, helpers con `search_path=''`. Cero tablas sin RLS, definers públicos ni
  SELECT privados para cliente, comprobados tras aplicar las seis migraciones.
- Chispa serializa perfil/pareja/saldo y consumo/like/aviso en una transacción.
  No saldo, incompatibilidad o cuota agotada no consumen. Reintentar la pareja
  no cobra otra Chispa. El aviso solo contiene un total, sin identidad del emisor.
- Foco verifica edad, semáforo, ciudad y check-in para el local; no elude filtros.
  Prioridad y permiso de Incógnito se comprueban en servidor, incluida la ficha
  directa/fotos. TEST nunca se muestra ni gasta cuando el modo es LIVE.
- Compra B2B requiere gestión del local, bloqueos por usuario/local y cupos diarios
  por ciudad. Reservas pendientes 24 h, precio/moneda/modo/intervalo/count comprobados
  en Stripe. Solo fulfillment pagado activa Pro/patrocinio; reembolso revoca.
  Portal/cancelación exige titular del pago y conserva ese acceso tras perder el
  rol de gestor. Ningún Pro concede ventajas personales.
- Pro devuelve agregados bajo autorización: edad/semáforo con mínimo cinco,
  comparación de zona con al menos cinco personas y tres locales; sin identidades.
  Tarjetas sin trackers y solo cercanas/abiertas. Top Flash exige consentimiento
  comercial y mayoría verificada; promociones de alcohol siguen apagadas.
- Evidencia: 393 frontend, 33 Deno; SQL 45 nuevas + 72 bloque 9 + 62 matching + 33 RLS,
  todas correctas y con rollback. 12 checks reales de Checkout TEST sin efectuar pago,
  29 HTTP/CORS y audit npm sin vulnerabilidades. Ver [informe](./BLOCK8_9_COMPLETION_TESTS.md).
- Advisors actuales: 16 INFO de [RLS privado cerrado](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
  WARN anterior de [contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
  y 16 INFO de [índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
  No se añaden políticas permisivas ni se amplía un plan para ocultarlos. Las puertas
  externas/QA/jurídicas/live del bloque 10/12 siguen vigentes.

## Bloque 10 — auditoría y correcciones, 2026-10-04

Scan Codex Security `56b027a0-7e56-4eb3-97dc-5f5714b5a153`: revisión independiente
de fuentes, límites de confianza y controles, complementada por pruebas de servidor.
No se confirmó ningún crítico/alto en las superficies revisadas. Reconciliación
final de lecturas completas: 469/469 archivos de código seleccionados (TS, TSX,
MJS y SQL), sin sumar solapamientos. La lista original de backend del primer auditor
no se conservó íntegra; se cerró esa cobertura mediante una lectura nueva completa
de las 52 migraciones y fuentes pendientes. Se excluye `database.types.ts`, contrato
generado sin implementación. Documentos, recursos estáticos y dependencias se
delimitan como material de apoyo; audit/SBOM no equivalen a revisar su código fuente.
La configuración externa de Auth/proveedores y QA real no están acreditadas.

### Correcciones comprobadas

- Ban: `complete_onboarding` usa el teléfono confirmado en Auth y comprueba HMAC
  normalizado e histórico antes de crear el perfil; dispositivo es señal auxiliar.
  Una cuenta eliminada no elude el ban creando un UID nuevo con el mismo teléfono.
- Aislamiento: las mutaciones privadas comprueban generación de sesión antes de
  publicar callbacks/datos; export/PDF/retornos externos comparten el guard.
  Una respuesta de A no repuebla la caché de B tras cambiar sesión.
  Check-in comprueba también la generación después de esperar GPS y antes de escribir.
- Privacidad: `search_places` no serializa `sort_key` y ordena los asistentes por
  la banda pública 0/1–4/≥5; evita revelar cifras ocultas mediante campo u orden.
- Admin: perfil activo, onboarding, rol y aal2 en el helper común. `test-tools`
  exige perfil activo, rol tester/admin y flag para actuar sobre fixtures;
  ese handler no exige aal2 y no acredita el guard de administración con MFA.
- Storage: admisión de archivos planos UUID propios, bucket privado 5 MiB y MIME
  acotado; diez objetos por usuario, sin UPDATE/overwrite. El borrado soporta
  carpetas anteriores, límites de recorrido y falta de progreso antes de retirar Auth.
- Recursos: PDF directo y outbox comparten 3 reservas/h usuario y 50/día globales,
  incluyendo intentos fallidos; firma legal acotada e idempotente por versión.
  `signed-documents` autentica antes de parsear; sus cuerpos y los de `test-tools`
  se limitan a 2.048 bytes después de autorizar.
- Configuración: producción sin Supabase falla cerrada; imports Edge Supabase
  fijados a 2.117.2 y Stripe a 23.0.0. No se añadieron proveedores ni secretos cliente.
- PWA: solo shell en precache, sin API/datos personales/Mapbox; recarga explícita
  y sin borrar sesión. CSP, allowlists y renderizado React siguen protegiendo origen.

### Hotfix posterior a la auditoría independiente

`a1ad387` corrige la carga de roles: `account_activity` devuelve `void` y un
retorno nulo sin error debe permitir consultar los roles propios bajo RLS.
Se conserva el rechazo de errores reales; no se concedieron roles ni se cambió
el guard de Admin/MFA. Regresión previa reproducida y suite posterior 348/348.
SQL con rollback confirma lectura propia antes de MFA, denegación del dashboard
sin MFA, admisión del admin activo en `aal2` y denegación de un caller sin rol.
Publicación y limitación de CUA documentadas en `BLOCK10_TESTS.md`. Este cambio
posterior no se atribuye al scan independiente ya cerrado.

`c40bac9` conecta el corazón al contador agregado del servidor y conserva el
paywall sobre perfiles. No amplía acceso a nombres, imágenes ni identidades.
Las regresiones prueban total visible con profiles vacíos y su actualización
Realtime; suite posterior 350/350. Tampoco se atribuye al scan cerrado.

### Límites y puertas pendientes

- Informe final: un riesgo bajo de emisión OTP, con confianza media y prerrequisito
  de configuración explícito. Los otros ocho candidatos se conservan con evidencia
  original y controles corregidos; no se presentan como vulnerabilidades activas.
- ❌ El precheck del navegador no controla una llamada directa a `Auth.signInWithOtp`.
  El ban se impide en onboarding, pero la emisión/abuso de OTP depende de los límites,
  captcha y hooks configurados en Auth. No se acreditó esa configuración ni se enviaron
  SMS para probarla. Revisar enforcement del servidor antes del lanzamiento.
- ❌ Advisor WARN de [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  La UI usa OTP, pero eso no acredita que todos los métodos de Auth estén cerrados.
  No se cambió plan ni se dio el aviso por resuelto.
- 13 INFO de [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
  corresponden a tablas `private` sin SELECT para anon/authenticated y no expuestas
  por PostgREST. Es un cierre deliberado, no se añade una policy permisiva para ocultar INFO.
- Rendimiento: 14 INFO de [índices sin uso](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index).
  No hay evidencia de que quitarlos mejore las cargas reales. ❌ Cero Advisors literal.
- ✅ El propietario confirmó instalación/apertura PWA en Samsung «fold7z»
  (One UI 8.5) e iPhone 11 (iOS 17.4.1).
- ✅ Aviso offline y recuperación de datos/sesión al reconectar confirmados en ambos,
  partiendo de la app cargada; no acredita arranque frío offline.
- ❌ Actualización desde versión anterior, lectores de pantalla y 60 fps.
  Tokens, unit tests y tamaños del build no acreditan esos resultados.
- ❌ Revisión jurídica final, datos de empresa y proveedores/costes live: Bloque 12.

Privilegios comprobados tras migración: cero tablas public/private sin RLS,
cero definers públicos y cero SELECT privados para roles cliente. RLS 33/33,
bloque 10 19/19, privacidad 4/4, regresiones SQL, Deno 33/33 y frontend 344/344. Un perfil real,
cero fixtures tras rollback. Evidencias y reproducción: [BLOCK10_TESTS.md](./BLOCK10_TESTS.md).

## Bloque 9 — puerta de seguridad, 2026-10-04

- Revisión de migraciones, RLS, RPC, Edge Functions y adaptadores. Helpers en
  `private` con `search_path=''`, permisos revocados y envoltorios invoker;
  decisiones administrativas requieren rol y MFA. El cliente no escribe compras,
  entitlements, créditos, bans ni decisiones de moderación.
- Stripe SDK 23 en servidor: clave y signing secret en Supabase Secrets. Firma
  del cuerpo original acotado, tolerancia de 300 segundos, modo y recursos del
  comercio comprobados. Eventos y concesiones idempotentes; los reembolsos revocan
  ventajas y créditos. El retorno del navegador consulta el pedido propio.
- Checkout y Portal alojados, solo HTTPS en los hosts autorizados, sin Stripe.js
  ni datos de tarjeta en Nightlife. Test exige audiencia, rol y flags; con
  `audience=none` el servidor deniega compras. No se configuró Stripe live.
- Borrado con `getUser` y autenticación de los últimos diez minutos: cancela todas
  las suscripciones del cliente, incluidas las aún sin fulfillment, retira Stripe,
  Storage y Auth. Facturas conservadas sin usuario; evidencia legal mínima por HMAC.
  La cola cerrada de Veriff reintenta errores sin registrar cuerpos del proveedor.
- Exportación completa incluye mensajes propios y excluye el texto del otro
  participante. SOS atómico con máximo tres contactos. DSA valida URL propia,
  contacto, explicación y declaración de buena fe, con cuota sin cuenta.
- Moderación exige denuncias humanas validadas de tres personas distintas en seis
  horas, decisiones explicadas y apelación por otro revisor. Contacto de pago exige
  compatibilidad y bloquea semáforo rojo; la flag permanece apagada.
- Patrocinios requieren factura manual y hueco disponible; no modifican rankings
  ni estadísticas. Flash exige patrocinio, marketing y mayoría de edad; alcohol
  cerrado por defecto. Edición gratuita de locales conserva las coordenadas oficiales.
- Outboxes con leases, diez intentos y backoff; fixtures registrados como simulados.
  Cron autenticado con clave de Vault. Los esquemas `private` y `net` no se exponen
  por PostgREST: comprobación HTTP 406/PGRST106. Los ACL administrados de `net`
  permiten acceso SQL a roles de base de datos; no se atribuye eficacia a los
  REVOKE de la migración ejecutados por `postgres` sin ser propietario de la extensión.
- Retención irreversible autorizada expresamente en dos respuestas del propietario:
  técnicos 90 días, moderación dos años preservando bans activos, facturación seis
  años preservando pedidos de suscripciones activas, evidencia al vencer su plazo.
  Previsualización inicial: cero registros vencidos. Último cron y worker correctos.
- Evidencia: 325/325 Vitest, 72/72 SQL del bloque, 12/12 Deno, compra real test 11/11,
  borrado 10/10, regresión SQL de bloques 7/8 y RLS sin fallos. `npm audit`: cero
  vulnerabilidades. Evidencias y límites en [BLOCK9_TESTS.md](./BLOCK9_TESTS.md).
- Advisors: doce INFO de tablas privadas con RLS sin políticas y grants revocados,
  [explicación](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
  y WARN previo de [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  Sin nuevos hallazgos críticos o altos. Activación de planes/proveedores en bloque 12.

Las dos cuentas y el local de prueba se retiraron: un perfil real y cero fixtures.
La prueba no contenía una sesión Veriff externa y sus avisos no acreditan SMTP real.

## Bloque 8 — puerta de seguridad, 2026-10-04

- Revisión de las tres migraciones, RPC, RLS, Storage, adaptadores y generador de
  fixtures. Ninguna función `SECURITY DEFINER` en `public`; helpers revocados,
  `search_path=''` y envoltorios invoker. Likes/matches/mensajes solo los escribe el servidor.
- Edad vigente de ambos, consentimiento y compatibilidad recíproca para descubrir y
  dar like. Red/discreto ocultan swipes; el bloqueo oculta ambos sentidos. Un tester
  sin verificar no puede ligar, y un usuario normal no lee ni recibe fixtures.
- Cuota de likes serializada por usuario y match por pareja; contador diario privado
  independiente de borrar likes. Entitlements comprobados en servidor; ninguna
  identidad del panel de likes viaja al cliente sin `see_likes`.
- Broadcast privado solo en el buzón propio, sin política INSERT para clientes.
  Match y mensajes emiten IDs; cada lectura vuelve a autorizarse mediante RPC.
  Un cliente autenticado no pudo suscribirse al buzón de su pareja (prueba real).
- Chat de texto plano (React lo escapa), 1.000 caracteres, paginación de 100 con
  cursor compuesto, cuotas por usuario y HMAC de IP. Eliminar/bloquear borra el match
  y sus mensajes, emite retirada a ambos y limpia su caché. Revocar la edad del otro
  participante también deniega acceso.
- Fotos privadas con URLs de 5 minutos y RLS de visibilidad/participación; los
  avatares de prueba solo se asignan cuando el servidor identifica un fixture.
  Anthem solo reproduce una muestra propia local, sin URLs externas ni Spotify activo.
- Red en producción: CSP idéntica a la configuración versionada; únicamente Supabase y
  los orígenes de Mapbox ya permitidos. Audio servido desde el mismo origen, verificado
  por hash; Mapbox fuera del HTML inicial y precache. No se añaden terceros.
- `test-tools` conserva autenticación propia con `getUser`, perfil activo, rol + flag,
  auditoría y fixtures sandbox; borra una creación parcial si fallan sus registros.
  Los simuladores no conceden verificación live ni modifican identidades reales.
- Evidencia: 62/62 SQL de matching, 33/33 RLS, 51/51 SQL del bloque 7, 16/16
  integración de dos clientes y 317/317 tests. `npm audit`: 0 vulnerabilidades.
- Advisors: INFO esperado de RLS sin políticas en las dos tablas nuevas privadas,
  ambas revocadas; [explicación del Advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).
  Persiste el WARN previo de [protección de contraseñas filtradas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
  (acceso de la app por OTP). Sin nuevos avisos críticos/altos.

La prueba real usa cuentas desechables y credenciales aleatorias en `.tmp` ignorado;
se retiraron sus usuarios Auth y local de prueba al terminar. No se tocaron el perfil,
consentimientos ni fotos del propietario.

## Bloque 7 — puerta de seguridad, 2026-10-03 ✅ sin hallazgos críticos ni altos

- **RPC:** toda la lógica en funciones `private` SECURITY DEFINER con `search_path=''` y
  envoltorios `public` SECURITY INVOKER. Ninguna función definer queda en `public`
  (probado). `anon` no ejecuta las RPC de lugares; las de admin exigen rol + MFA y las de
  simulación, rol tester/admin + `test_tools_enabled` y solo actúan sobre `is_test`.
- **Privacidad (PRD 4.3):** con menos de 5 personas no se devuelven edad, proporciones ni
  porcentaje abierto a ligar, y el recuento se agrupa en 1-4. Check-in solo a ≤ 150 m.
  Los locales de prueba no existen para usuarios normales (lectura y check-in denegados).
- **Realtime:** canales Broadcast privados separados para datos reales y de prueba; el
  cliente descarta cifras simuladas si no ve datos de prueba.
- **Mapbox:** el token no viaja en el bundle ni en variables `VITE_*`. Vive en una tabla
  privada y solo se entrega tras reservar una carga de la cuota. Solo se aceptan tokens
  públicos `pk.` (validación en cliente, RPC y restricción de tabla; un `sk.` falla con
  `check_violation`). Restringir el token por URL en la cuenta de Mapbox.
- **Google Places:** desactivado; la clave no está en el cliente. El guardado de
  `place_id` + coordenadas es solo `service_role`, caduca a 30 días y no hay función
  desplegada que lo invoque.
- **Ficha:** la web del local solo se muestra si es https y se abre con
  `rel="noopener noreferrer"`.
- **Red:** CSP con Supabase y Mapbox (`api`, `*.tiles`, `events`) como únicos orígenes
  externos; `worker-src blob:` para el worker de Mapbox. `index.html` y `sw.js` no
  referencian el chunk de Mapbox: solo se descarga tras una reserva concedida.
- **Evidencias:** SQL remoto con rollback `places.sql` 19/19 y `provider-quotas.sql`
  19/19; check 298/298; `npm audit` 0 vulnerabilidades. Advisors: INFO esperado de RLS
  sin políticas en tablas privadas cerradas (`places_action_limits`, `provider_access` y
  las dos del Bloque 6) y WARN conocido `auth_leaked_password_protection` (la app usa OTP).
- **Riesgo aceptado:** el contador de Mapbox es una estimación de Nightlife, no un tope de
  facturación de la cuenta (ADR 0010). La cuenta debe vigilarse manualmente cada mes.

## Evidencia final de pruebas del Bloque 6 — 2026-10-03

- Check **285/285**, build correcto; SQL **54/54** y RLS **33/33** con rollback.
  npm audit completo: 0 vulnerabilidades. Advisors: WARN previo de protección de
  contraseñas, 2 INFO esperados en tablas privadas cerradas y 23 INFO de índices sin uso.
- API Test real, rechazo y aprobación HMAC entregados con HTTP 200; revisión solicitada
  persistida en la cola real y autoaprobación rechazada con 403. Identidad Test y foto
  simulada conservadas al recargar; sus resultados permanecen en sandbox.
- RPC de auditoría de borrado solo service_role, sesión Veriff final y estado HTTP acotado;
  sin cuerpos del proveedor. La API devuelve 403 y el registro dice pending, nunca borrado.
  Habilitación por soporte y validación del borrado pasan al Bloque 12 por decisión expresa.
- No se aceptan resultados live derivados de pruebas. El simulador explícito de edad no
  altera el acceso global a Veriff; sigue exigiendo rol, herramientas y modo sandbox.
- No se debilitó disponibilidad global para provocar un fallo: auto-review rechazó esa
  actualización; cobertura alternativa con transacción revertida y pruebas de interfaz.
- Las entradas siguientes conservan el historial; las cifras y pendientes anteriores
  quedan sustituidos por esta evidencia y el cierre operativo registrado en PROGRESS.md.

## Bloque 6 — auditoría de cierre, 2026-10-03

- Idempotencia por evento (sesión + intento + estado + hora), no por intento: una
  aprobación tras «review» ya no se descarta.
- Decisiones aceptadas solo entre la creación de la sesión (−5 min) y 7 días después, y
  nunca con fecha futura (+5 min). Proveedor, resultado y evento obligatorios.
- `approved` sin fecha de nacimiento → revisión humana; documento de menor → `failed`.
  La sesión de edad nunca concede identidad (consentimiento separado, PRD 6.1).
- Revisión humana: RPC solo admin con MFA (`require_admin`), sin autoaprobación ni
  aprobación de baneados, auditada (`verification.review.*`). El usuario no puede listar
  ni resolver revisiones (probado).
- Borrado de la sesión en Veriff (datos biométricos) solo en resultados finales y con
  `EdgeRuntime.waitUntil` para que no se corte al responder.
- La URL devuelta por el servidor se valida (HTTPS, host Veriff, sin credenciales).
- El badge de foto del perfil aplica el gate sandbox/live.
- Índice en `private.verification_notifications(session_id)`.
- SQL remoto con rollback: 44/44 verificación, 33/33 RLS. Deno 11/11. POST sin firma a
  `veriff-webhook` y sin sesión a `verification`: 401.
- Advisors tras los cambios: INFO esperado en `private.verification_notifications` y WARN
  `auth_leaked_password_protection`; sin avisos nuevos.
- **Puerta live:** prueba E2E en Veriff Station antes de activar el modo live.

## Bloque 6 — revisión local, 2026-10-03 (Veriff test)

- Webhook de Veriff: HMAC-SHA256 del cuerpo en bruto, `X-AUTH-CLIENT` igual a la API key,
  cuerpo acotado, minimización (sin nombre, documento, selfie ni fecha de nacimiento persistida).
  Idempotencia por `event_id`. El cliente no asigna resultados.
- Decisiones de la integración de test en `mode = sandbox`; el gate exige rol tester/admin y
  `verification_mode = sandbox`. Sin secretos: respuesta «No disponible», sin mock silencioso.
- Lista blanca de hosts: `veriff.com` y `veriff.me` (subdominios), más Yoti.
- Tests de la app 266/266. `npm audit --omit=dev`: 0.
- Migración y funciones aplicadas en Nightlife_Connect. POST sin HMAC a `veriff-webhook`
  responde 401. Advisors: INFO en `private.verification_notifications` (RLS sin políticas,
  revoke a roles públicos) y WARN `auth_leaked_password_protection`
  ([remediación](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)).
- Pendiente: webhook en Station, forzar una decisión de test, foto/identidad live (Bloque 12).

## Bloque 6 — revisión local anterior, 2026-10-03

- SQL validado con rollback: 23/23 pruebas de verificación y 33/33 de regresión RLS.
  Sin cambios persistentes en la base conectada. Migración y funciones pendientes de despliegue.
- Sesiones propias de solo lectura en cliente. El cliente no asigna resultados ni accede a
  las RPC reservadas al servicio. No hay bypass de edad por rol tester/admin.
- Sandbox exige rol, flag y modo; sus resultados no conceden acceso en live.
- Webhook con firma RSA-PSS y clave oficial fijada, cuerpo acotado antes del parseo,
  validación de método/umbral/vida pasiva, referencia aleatoria e idempotencia.
- Solo se conservan estados, método, umbral, fechas e identificadores. Sin documentos,
  selfies, descriptores ni webhook bruto; sin datos sensibles o errores del proveedor en logs.
- Cambio de foto revoca el badge. Posible menor suspende, revoca y fuerza documento;
  el webhook no levanta la suspensión. Bans persisten mediante HMAC de teléfono/dispositivo.
- Auditoría visual/red local: cero orígenes externos y errores de consola; 245 tests de la app y tres de Deno pasan; build y chequeo de las Edge Functions correctos.
  `npm audit`: cero vulnerabilidades; ninguna dependencia nueva en la app.
- Security Advisors del esquema actualmente desplegado: un aviso WARN por protección de
  contraseñas filtradas desactivada. Sigue pendiente activar/comprobar esa protección en Auth
  cuando corresponda; el inicio de sesión de usuarios de la app utiliza OTP.
  [Remediación oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Pendiente: revisión humana definitiva, revocación/eliminación biométrica en el proveedor,
  foto/identidad live, secretos Yoti y prueba firmada real. El Bloque 6 sigue abierto.

## Controles implementados (Bloque 1)

| Riesgo (OWASP)                    | Control                                                                                                                                                                                                                                  | Dónde                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| A01 Control de acceso / API7 SSRF | Navegación externa solo a lista blanca (HTTPS, sin credenciales en URL, sin puertos, sin dominios parecidos)                                                                                                                             | `src/platform/in-app-browser/allowlist.ts` + tests |
| A02 Configuración                 | CSP estricta (`script-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `connect-src` limitado a Supabase), HSTS, nosniff, `X-Frame-Options: DENY`, Referrer-Policy, Permissions-Policy (cámara y ubicación solo `self`), COOP | `vercel.json`                                      |
| A02                               | Sin _source maps_ en producción                                                                                                                                                                                                          | `vite.config.ts`                                   |
| A02                               | Toolbar/feedback de Vercel desactivados (scripts de terceros)                                                                                                                                                                            | Proyecto de Vercel                                 |
| A03 Cadena de suministro          | Solo dependencias de 3.5 (y familias oficiales, ADR 0001); lockfile versionado; `npm audit` = 0 vulnerabilidades                                                                                                                         | `package-lock.json`                                |
| A05 Inyección / XSS               | Sin `dangerouslySetInnerHTML`; React escapa; i18n con `escapeValue: false` solo porque React ya escapa y nunca se inyecta HTML traducido                                                                                                 | —                                                  |
| A08 Integridad                    | El cliente no decide permisos: flags y entitlements son solo UX; el servidor aplicará RLS / `has_entitlement()`                                                                                                                          | `src/shared/flags`, `src/shared/entitlements`      |
| A09 Logs limpios                  | El Error Boundary solo registra el tipo de error, nunca el mensaje (puede contener datos)                                                                                                                                                | `ScreenErrorBoundary`                              |
| A10 Fallar cerrado                | Flags inválidos o no cargados ⇒ valores seguros (pagos off, herramientas de prueba off, verificación live). Entitlements denegados mientras cargan o si `premium_enabled = off`                                                          | `flags.ts`, `use-entitlement.ts` + tests           |
| API5 Autorización de función      | Herramientas de prueba ocultas tras `test_tools_enabled` en UI (el servidor añadirá rol + flag)                                                                                                                                          | `FeatureGate`                                      |
| Privacidad (3.1)                  | El _service worker_ solo cachea el _shell_; nunca respuestas de API                                                                                                                                                                      | `vite.config.ts`                                   |
| Privacidad (3.2)                  | Fuentes e iconos autoalojados; 0 peticiones a terceros (verificado con auditoría de red Playwright)                                                                                                                                      | `src/assets/fonts`, `lucide-react` empaquetado     |
| Capa de plataforma                | ESLint impide APIs del dispositivo fuera de `src/platform`                                                                                                                                                                               | `eslint.config.js`                                 |

### Decisiones aceptadas con riesgo bajo

- `style-src 'unsafe-inline'`: necesario para estilos en línea de Radix (react-remove-scroll)
  y Motion. `script-src` sigue sin `unsafe-inline`. Riesgo bajo (no permite ejecutar JS).
- `secureStorage` en web usa `localStorage` (no hay alternativa más fuerte para una SPA).
  En nativo se usará Keychain/Keystore (Anexo B). Mitigación: CSP estricta contra XSS y JWT
  de corta duración con rotación (Bloque 5).
- `workbox-build` arrastra `glob@11` (aviso de deprecación, sin CVE). Solo en build.

## Controles añadidos (Bloque 2)

| Riesgo                                 | Control                                                                                                                                                               | Dónde                                              |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Menores (6.15 E)                       | Pantalla de edad neutra (no revela el límite); menor ⇒ estado terminal sin datos; casilla "soy mayor de 18" en la firma; bloqueo "Verifica tu edad" que falla cerrado | `onboarding-machine.ts`, `verification.ts` + tests |
| Privacidad por defecto                 | Ningún consentimiento ni casilla premarcada; orientación (art. 9) exige firma explícita; revocar es un toque                                                          | `consents.ts`, `OrientationConsentSheet` + tests   |
| Fotos (API4/D)                         | Recodificación en el dispositivo (canvas) ⇒ sin EXIF/GPS; tipos y tamaño limitados (15 MB)                                                                            | `platform/images`                                  |
| Datos personales en cliente            | Fecha, teléfono, nombre y fotos solo en memoria durante el onboarding; el mock persistente no guarda datos personales                                                 | ADR 0006                                           |
| Enumeración / abuso de OTP (A07, API6) | Errores genéricos (número baneado = "no podemos completar el alta"), límites de envío y de intentos simulados; el teléfono solo se muestra enmascarado                | `PhoneStep`, mock                                  |
| Bypass de verificación (6.14)          | Simulador solo con `verification_mode = sandbox` **y** rol `tester`                                                                                                   | `ProviderSandboxScreen`                            |
| XSS (A05)                              | Documentos legales como texto estructurado, nunca HTML                                                                                                                | `LegalDocumentSheet`                               |
| IA (6.12 C)                            | Aviso previo de IA con revisión humana y método alternativo                                                                                                           | `AiNotice`                                         |

## Controles añadidos (Bloque 3)

| Riesgo                           | Control                                                                                                                                                                                                           | Dónde                              |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| Privacidad de estadísticas (4.3) | `presentStats`: con menos de 5 personas solo "Menos de 5"; filtros de edad excluyen lugares bajo umbral                                                                                                           | `places/model/stats.ts` + tests    |
| Seguimiento / acoso (6.15 D, E)  | Nunca se muestra la ubicación exacta ni la hora de check-in de otras personas; bloqueo mutuo e instantáneo (oculta en swipes y borra match); motivo "Me siento seguido/a"; modo discreto; semáforo rojo invisible | `matching.ts`, `SafetySheet`, mock |
| Check-in (6.3)                   | Posición leída una vez vía plataforma, comprobación de 150 m y solo "lugar + hora"; sin verificar, check-in invisible                                                                                             | `attendance.ts`, `useCheckIn`      |
| Scraping de perfiles (API6)      | Ver perfiles exige edad verificada (pantalla y ruta directa); el servidor limitará consultas en el Bloque 8                                                                                                       | `SwipeScreen`, `PersonScreen`      |
| Eventos trampa (6.15 E)          | Solo lugares públicos (casilla obligatoria), 3 confirmaciones en 24 h, 3 reportes "falso" ⇒ oculto, aviso de seguridad en no confirmados, máx. 2/día, antiduplicados                                              | `events.ts` + tests                |
| XSS (A05)                        | Mensajes, objetos perdidos, bios y descripciones como texto plano (sin HTML)                                                                                                                                      | `MessageBubble`, `LostFoundPanel`  |
| Abuso de likes (API6)            | Límite diario de 5 (ilimitado solo con entitlement); el servidor lo aplicará                                                                                                                                      | `likesRemaining` + tests           |
| Patrocinios (6.11)               | Solo si cumplen los filtros, máx. 2 arriba y 1/5, etiqueta siempre visible, no alteran datos                                                                                                                      | `sponsored.ts` + tests             |

## Controles añadidos (Bloque 4)

| Riesgo                           | Control                                                                                                                                                        | Dónde                                        |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| A01 / API5 admin                 | Rutas de admin solo con rol `admin` + segundo factor (simulado; `aal2` en el Bloque 5); la sesión MFA solo vive en memoria; el guard espera a los roles        | `AdminLayout`, `useMfaSession`               |
| API5 herramientas de prueba      | Doble puerta (rol + `test_tools_enabled`), confirmación en las destructivas y auditoría de cada ejecución                                                      | `AdminTestToolsScreen`, mock admin           |
| A09 auditoría                    | Cambios de flags, configuración, decisiones, códigos, entitlements y roles quedan en el registro de auditoría                                                  | `backoffice/config.ts`                       |
| DSA art. 16-17-20                | Formulario público de contenido ilegal con declaración de buena fe y referencia; decisiones con nota obligatoria; apelación única revisada por otra persona    | `IllegalContentScreen`, `AdminSectionScreen` |
| Pagos (A08)                      | El cliente nunca concede ventajas: la compra pasa por el servicio (webhook simulado) y se releen los entitlements; checkout inaccesible si no se puede comprar | `use-premium.ts`, `CheckoutScreen`           |
| Fuerza bruta de códigos (API4)   | Formato largo `XXXX-XXXX-XXXX` y límite de intentos                                                                                                            | `catalog.ts`, mock premium                   |
| Borrado de cuenta (A07)          | Reautenticación por OTP; se cancela la suscripción antes; se limpia la caché del cliente                                                                       | `PrivacyDataScreen`                          |
| Privacidad de estadísticas (4.3) | Panel de locales solo con datos agregados y umbral de 5                                                                                                        | `VenueDetailScreen`                          |
| Validación de entrada            | Límites de longitud en todos los campos; valores de flags validados por su esquema; configuración acotada a min/max                                            | formularios, `AdminFlagsScreen`              |
| Indexación                       | `robots.txt` solo permite `/legal`                                                                                                                             | `public/robots.txt`                          |

## Controles añadidos (Bloque 5)

| Riesgo                 | Control                                                                                                                                                                             | Dónde                                |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| A01 / API1 IDOR        | RLS en las 40 tablas; el cliente solo lee sus filas; privilegios revocados por defecto (también para tablas futuras)                                                                | migraciones `core` … `grants`        |
| API3 asignación masiva | Sin `UPDATE`/`INSERT` directos: perfil, consentimientos y firma solo por funciones con lista blanca de campos; perfiles ajenos solo por `search_public_profiles` (columnas seguras) | `rpc_block5`                         |
| A08 integridad         | Roles, verificación, entitlements, bans y flags no se pueden escribir desde el cliente; evidencias y auditoría _append-only_ (trigger, también para el propietario)                 | `forbid_mutation`                    |
| A04 criptografía       | HMAC-SHA256 de teléfono/dispositivo/IP con clave aleatoria en Vault                                                                                                                 | `private.hmac_hex`                   |
| A07 / API5 admin       | Rol admin **y** `aal2` (TOTP) comprobados en cada función de admin; reautenticación por OTP (inicio de sesión < 10 min) para borrar la cuenta                                       | `private.is_admin`, `delete-account` |
| API6 alta abusiva      | Límites por IP (20/h) y teléfono (5/h) antes de enviar el SMS, además de los de Supabase Auth; respuestas genéricas                                                                 | `check_signup`                       |
| Menores (6.15 E)       | La edad se revalida en el servidor; menor ⇒ no se crea perfil                                                                                                                       | `complete_onboarding`                |
| Datos de prueba        | `is_test` solo visible para tester/admin; generador y purga con doble puerta (rol + flag) en el servidor                                                                            | RLS, `test-tools`, `purge_test_data` |
| Fotos (6.15 D)         | Bucket privado, 5 MB, solo imágenes, carpeta por usuario, URLs firmadas de 30 min                                                                                                   | `payments_and_storage`               |
| A02 CORS / CSP         | Edge Functions con CORS solo para los dominios propios; CSP `img-src` añade solo el dominio de Supabase                                                                             | `_shared/http.ts`, `vercel.json`     |
| A09 logs               | Edge Functions registran solo el tipo de error, nunca emails, tokens ni contenido                                                                                                   | Edge Functions                       |
| Secretos               | `service_role` solo en Edge Functions; Gmail en Supabase Secrets; frontend solo con URL y clave publicable                                                                          | —                                    |

## Modelo de amenazas (STRIDE) — esqueleto, se completa por bloques

| Área                                   | Bloque | Estado                                                   |
| -------------------------------------- | ------ | -------------------------------------------------------- |
| Alta y OTP                             | 5      | Hecho: bans HMAC, límites, OTP de Auth, edad en servidor |
| Verificación (Veriff test, Yoti, foto) | 6      | Auditado; E2E Veriff Station en la puerta live           |
| Check-in y "Aquí Ahora" (seguimiento)  | 7      | Pendiente                                                |
| Likes y chat                           | 8      | Pendiente                                                |
| Reportes / moderación                  | 9      | Pendiente                                                |
| Eventos de usuarios                    | 7      | Pendiente                                                |
| Pagos y entitlements                   | 9      | Pendiente (política de cliente lista y probada)          |
| Herramientas de prueba y admin         | 4-5    | Hecho: rol + aal2 + flag en el servidor, auditado        |

## Puertas de seguridad por bloque

### Bloque 1 — 2026-10-02 ✅ sin hallazgos críticos ni altos

- Security Advisors de Supabase (`Nightlife_Connect`): **0 avisos** (esquema `public` aún vacío;
  se repiten en el Bloque 5 con las primeras migraciones).
- RLS / migraciones / Edge Functions nuevas: ninguna.
- Dependencias añadidas: revisadas (oficiales, mantenidas); `npm audit`: 0 vulnerabilidades.
- Auditoría de red (Playwright, build de producción): 0 orígenes externos, 0 errores de consola.
- Puntos de 6.15 aplicados: A01 (lista blanca), A02 (cabeceras), A03, A05, A09, A10, API5 (UI).

### Bloque 2 — 2026-10-02 ✅ sin hallazgos críticos ni altos

- Security Advisors de Supabase: 0 avisos (sin cambios de esquema en este bloque).
- RLS / migraciones / Edge Functions nuevas: ninguna (bloque de frontend con mocks).
- Dependencias añadidas: `react-hook-form`, `@hookform/resolvers`, `date-fns` (lista 3.5); `npm audit`: 0.
- Auditoría de red (Playwright, recorrido completo del onboarding): 0 orígenes externos
  (solo URLs `blob:` locales de las vistas previas de fotos), 0 errores de consola.
- Sin `dangerouslySetInnerHTML`, sin `console.log`, sin acceso a almacenamiento fuera de `src/platform`.

### Bloque 3 — 2026-10-02 ✅ sin hallazgos críticos ni altos

- Security Advisors de Supabase: 0 avisos (sin cambios de esquema).
- RLS / migraciones / Edge Functions nuevas: ninguna (frontend con mocks).
- Dependencias añadidas: ninguna. `npm audit`: 0 vulnerabilidades.
- Auditoría de red (Playwright: mapa, ficha, swipe, match, chat, perfil, crear evento; 5 temas y
  escritorio): 0 orígenes externos, 0 errores de consola. Avatares SVG `data:` (permitido por CSP).
- Sin `dangerouslySetInnerHTML` ni `console.log`; APIs del dispositivo solo vía `src/platform`.

### Bloque 4 — 2026-10-02 ✅ sin hallazgos críticos ni altos

- Security Advisors de Supabase (seguridad y rendimiento): 0 avisos (sin cambios de esquema).
- RLS / migraciones / Edge Functions nuevas: ninguna (frontend con mocks).
- Dependencias añadidas: ninguna. `npm audit`: 0 vulnerabilidades.
- Auditoría de red (Playwright: paywall, checkout, Mi suscripción, canjear, privacidad,
  documentos, moderación, SOS, panel de locales, admin con MFA, flags, herramientas,
  suspensión y web legal sin login; móvil y escritorio, varios temas): 0 orígenes externos,
  0 errores de consola.
- Sin `dangerouslySetInnerHTML`; textos legales como texto plano; APIs del dispositivo solo vía
  `src/platform` (descarga JSON y compartir); el enlace al 112 es un `tel:` estándar.
- Riesgo aceptado (temporal): MFA de admin y pasarela simulados en cliente; no hay backend, así
  que no protegen nada real. Se sustituyen por comprobaciones en servidor en los bloques 5 y 9.

### Bloque 5 — 2026-10-03 ✅ sin hallazgos críticos ni altos

- Security Advisors de Supabase: **0 avisos de seguridad** (se corrigieron 16 avisos
  `SECURITY DEFINER` expuestos moviendo las implementaciones al esquema `private`, no expuesto,
  con envoltorios `SECURITY INVOKER`; la exposición de esas RPC es intencionada y cada una
  comprueba sesión, rol, MFA y flags). Rendimiento: solo avisos INFO de índices sin usar
  (base de datos vacía).
- RLS: `supabase/tests/rls.sql` **33/33** (anon, usuario, sin verificar, tester, admin aal1/aal2,
  IDOR, asignación masiva, inmutabilidad, validación del alta); se ejecuta en una transacción
  que siempre termina en _rollback_ (comprobado: 0 filas tras la prueba).
- Migraciones revisadas: sin `DELETE` fuera de funciones con condiciones; datos solo semilla.
- Edge Functions revisadas: JWT obligatorio (`verify_jwt`), CORS restringido, sin datos
  personales en logs, destinatario del email tomado de Auth (confirmado), nunca del cuerpo.
- Dependencias añadidas: `@supabase/supabase-js` (lista 3.5). `npm audit`: 0 vulnerabilidades.
- Riesgo aceptado (temporal): envío de email con Gmail del propietario y SMTP propio; teléfonos
  de prueba con OTP fijo (se quitan antes del lanzamiento, PRD 6.14).

### Bloque 5 — Corrección de login y cierre de sesión (2026-10-03)

- No hay migraciones ni nuevas Edge Functions en esta corrección. No se despliega el trabajo pendiente del bloque 6.
- RLS remoto: 33/33 en transacción con rollback; cuenta real/evidencias/fotos conservadas.
- Guard y consulta de perfil fallan cerrados ante error; no confunden fallo de conexión con cuenta incompleta.
- No se publican códigos de teléfonos reales ni se conceden permisos por la presencia de una pista mock.
- La caché se limpia al cerrar sesión y se reinicia al cambiar de identidad. Los fallos de signOut se propagan.
- Advisors actuales: 1 WARN previo `auth_leaked_password_protection`; 55 INFO de índices sin uso.
  Esta app utiliza OTP de teléfono, no contraseñas. No se activa un plan de pago para resolver el aviso.
  [Remediación oficial](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- Generación/purga y acceso real con OTP/MFA: pendientes de sesión del propietario; no se simula su MFA.
- Los resultados de proveedor en test permanecerán separados de live según PRD 11.3.
- `npm audit`: 0 vulnerabilidades; check aislado de bloque 5: 256/256 tests, TypeScript, ESLint y formato correctos.

### Evidencias del despliegue del bloque 5 — 2026-10-03

- Vercel MCP confirma READY y el SHA ee5feab84affaab118c4e03475b374a5dfc2f211. Publicación mediante CLI autorizada sobre una copia exacta del commit, sin trabajo pendiente del bloque 6.
- Revisión de red del código y cabeceras públicas: connect-src limitado al propio origen y al proyecto Supabase; recursos y fuentes propios, sin analítica externa añadida. Esto no sustituye el recorrido móvil pendiente sobre el bundle actualizado.
- Supabase registra check_signup/OTP con estado 200 en la prueba local conectada al backend real; verificación final y generación/purga aún pendientes. No se han consultado ni publicado OTP ni secretos MFA.
- El servicio worker publicado responde application/javascript y Cache-Control public, must-revalidate, max-age=0. La pestaña antigua sigue en caché y no se presenta como prueba del nuevo código.
- Build remoto: 0 vulnerabilidades; avisos de engines Node >=22 y glob obsoleto registrados, sin nuevas dependencias en esta corrección.
- No se aplicaron migraciones ni se desplegaron Edge Functions del bloque 6; no se ampliaron planes ni activaron servicios de pago.

### Puerta operativa final del Bloque 5 — 2026-10-03

- Sesión y MFA reales del propietario en el commit publicado; sin manipular JWT ni consultar OTP o secretos del segundo factor.
- Generación por Edge Function y purga por RPC, usando la UI autorizada. Antes de purgar se comprobó que las únicas entidades is_test eran las 12 recién generadas.
- Persistencia confirmada tras recargar. Las filas asociadas de roles, preferencias y verificación estaban completas; auditoría de ambas operaciones conservada.
- Tras purgar: 0 perfiles y usuarios Auth de prueba; cuenta real terminada, 10 consentimientos y 2 fotos conservados.
- Los tres guards, Cuenta visible y signOut sin rebote se comprobaron en la versión nueva; alias público actualizado después de reabrir la pestaña antigua.
- Recursos observados: solo origen del despliegue y proyecto Supabase; 0 errores de consola. Logs de check_signup/OTP/verify/logout correctos, sin publicar códigos ni tokens.
- Advisors finales: persiste únicamente el WARN conocido auth_leaked_password_protection; sin nuevos avisos de esquema ni cambios de RLS. Los resultados 33/33 de RLS y 256/256 del check corresponden al código publicado, sin Bloque 6.
- No se aplicaron migraciones ni nuevas funciones; sin ampliaciones de plan, credenciales live ni cobros. Bloque 6 pendiente de OK y activaciones de pago reservadas al Bloque 12.

### Bloque 6 — Revisión de integración Test, 2026-10-03 (cierre pendiente)

- SQL remoto con fixtures y rollback: 51/51 verificación, 33/33 RLS. Incluye anon/usuario,
  tester, admin con/sin MFA, IDOR, consentimiento, separación sandbox/live, caducidad,
  idempotencia, revisión humana y rechazo humano que un webhook no puede sobrescribir.
- Veriff: autenticación HMAC sobre cuerpo original y comparación del cliente; datos mínimos
  persistidos, fechas imposibles rechazadas, URL de redirección restringida a HTTPS Veriff.
  JWT propio en verification; firma propia en webhooks; no se confía en el retorno del navegador.
- `private.verification_provider_access` tiene RLS y revoke total a clientes. Su actualización
  queda auditada; no se crean sesiones externas con capacidad expirada o deshabilitada.
  Simulación explícita solo con tester/admin, herramientas activadas, sandbox y consentimiento.
- Migraciones y funciones desplegadas por MCP; tipos regenerados. Check 278/278, build
  correcto y npm audit completo 0 vulnerabilidades. Check actualizado: 279/279.
- Security Advisors: WARN previo de contraseñas filtradas (Auth usa OTP); 2 INFO de RLS sin
  políticas en tablas privadas que intencionalmente deniegan todo acceso directo.
  [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
  [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
  Performance Advisors: 23 INFO de índices sin uso; sin WARN/ERROR de esquema en esta revisión.
- Prueba de red: verification sin sesión y webhook sin HMAC responden 401; GET de webhook
  responde 405. CORS 127.0.0.1 comprobado. Creación real de sesión Test confirmada en BBDD y
  Station; rechazo firmado entregado (200), guardado y mostrado en la app. Reenvío sin
  duplicar notificaciones ni revertir la solicitud de revisión humana.
- Integración usada: Nightlife TEST, webhook de decisiones configurado con certificados
  activados. Trial de 14 días observado; corte conservador 2026-10-16T00:00:00Z registrado.
  Sin contratación, ampliación de planes ni claves live. No se consultan documentos, selfies,
  secretos MFA ni OTP para realizar estas pruebas.
