# Seguridad — modelo de amenazas y controles

Documento vivo (PRD 6.15). Se actualiza en la puerta de seguridad de cada bloque.

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
