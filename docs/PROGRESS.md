# Progreso — Nightlife Connect

Registro por bloque (PRD 11.1): qué se hizo, decisiones, desviaciones y pendientes.
**No se pasa al siguiente bloque sin un OK explícito del propietario.**

| Bloque                                                   | Estado                                               |
| -------------------------------------------------------- | ---------------------------------------------------- |
| 1 – Cimientos, diseño y arquitectura                     | ✅ Aprobado (OK del propietario, 2026-10-02)         |
| 2 – Onboarding, legal y verificación (mock)              | ✅ Aprobado                                          |
| 3 – App principal y experiencia de match (mock)          | ✅ Aprobado                                          |
| 4 – Paneles, web pública y pantallas de pago (mock)      | ✅ Terminado, pendiente de OK                        |
| 5 – Backend base, legal y modo pruebas                   | ✅ Terminado; pendiente de OK                        |
| 6 – Verificaciones reales                                | 🛠️ Revisión aplicada; decisiones Test E2E pendientes |
| 7 – Mapa, lugares, eventos y estadísticas reales         | ⏳                                                   |
| 8 – Ligar, match en tiempo real y chat                   | ⏳                                                   |
| 9 – Seguridad, derechos, negocio y pagos en test         | ⏳                                                   |
| 10 – Auditoría OWASP, pulido, PWA y QA                   | ⏳                                                   |
| 11 – Apps nativas y pagos en tiendas                     | ⏳ Añadido al plan (docs/MONETIZATION.md)            |
| 12 – Contratación, costes, activación live y lanzamiento | ⏳ Costes sujetos a aprobación explícita             |

---

## Imágenes y Bloque 6 — 2026-10-03

El propietario autorizó continuar desde el Bloque 5. Se confirma su cierre documentado
y se inicia el Bloque 6; no se avanza al Bloque 7.

### Veriff test (continuación)

- Proveedor principal: Veriff (integración de test, `https://api-saas.veriff.com`).
  Yoti se conserva como alternativa de edad en live. Simulador interno solo con
  `verification_provider = simulator`.
- Flag `verification_provider` (`veriff` | `yoti` | `simulator`). Las decisiones de test
  se guardan como `mode = sandbox` y no acreditan identidad real.
- RPC `complete_provider_verification` (solo `service_role`), webhook HMAC-SHA256,
  minimización de la decisión (edad en memoria a partir de la fecha de nacimiento) y
  borrado best-effort de la sesión en Veriff.
- Foto verificada sigue simulada (comparación selfie2selfie en el Bloque 12).
- Tests de la app: **266/266**. `npm audit --omit=dev`: 0 vulnerabilidades.
- Frontend desplegado en Vercel producción: SHA `6e74d8d`,
  `dpl_Ds4c21t16NkrDVr3KqACVobve6RQ`, READY,
  https://nightlife-connect-beige.vercel.app
- MCP User (org Chaplications trade): migración aplicada en remoto como
  `verification_block6` + RPCs/gates (`20261003160530` … `20261003160640`).
  Funciones ACTIVE: `verification`, `veriff-webhook`, `yoti-webhook` (`verify_jwt = false`).
  Tipos regenerados en `src/adapters/supabase/database.types.ts`.
- Flags remotos: `verification_provider=veriff`, `verification_mode=sandbox`,
  `test_tools_enabled=on`. Una cuenta de prueba sigue con `age_verified=false`.
- POST a `veriff-webhook` sin HMAC responde `401 invalid_signature`.
- Security Advisors: INFO esperado en `private.verification_notifications` (RLS sin
  políticas; revoke a public/anon/authenticated). WARN conocido
  `auth_leaked_password_protection` (la app usa OTP, no contraseña).
- Webhook a configurar en Veriff Station:
  `https://ocrpfeqfqzchhrghqcfb.supabase.co/functions/v1/veriff-webhook`
- Secretos: `VERIFF_API_KEY`, `VERIF_SHARED_SECRET` (nombre fijo en Secrets;
  el webhook también acepta `VERIFF_SHARED_SECRET`), `VERIFF_BASE_URL` opcional,
  `APP_ORIGIN`.

### Auditoría completa del Bloque 6 — 2026-10-03

Revisión de todo lo hecho en el bloque (código, base remota, funciones y documentación) a
petición del propietario. Correcciones aplicadas en remoto por MCP y en el repositorio:

- **Idempotencia Veriff:** el id de evento era el `attemptId`, así que una decisión
  `approved` llegada tras `review` en el mismo intento se habría descartado como duplicada.
  Ahora es SHA-256 de sesión + intento + estado + hora de la decisión.
- **Ventana de decisión:** la sesión caducaba a los 15 min y rechazaba decisiones tardías
  (revisiones de Veriff). Se aceptan hasta 7 días desde la creación; el «pendiente» dura
  24 h en Veriff y 15 min en Yoti/simulador (su `ttl`).
- **Aprobación sin prueba:** un `approved` sin fecha de nacimiento dejaba la sesión en
  `verified` sin acreditar la edad. Ahora va a revisión humana (`borderline`). Un documento
  válido de menor de 18 años es `failed`.
- **Identidad solo con su consentimiento:** la sesión de edad de Veriff concedía también
  «identidad verificada» sin el consentimiento explícito (PRD 6.1). Ahora solo la sesión
  `identity` la concede.
- **Foto con Veriff activo:** pedir la foto daba «No disponible». Ahora usa el simulador
  persistido (solo tester/admin en sandbox), también en la pantalla del simulador.
- **Reverificación por posible menor:** un documento verificado no limpiaba
  `reverification_required` (la cuenta quedaba bloqueada para siempre). Ahora sí; la
  suspensión cautelar la levanta moderación.
- **Revisión humana real (PRD 6.2):** RPC `admin_verification_reviews` y
  `admin_resolve_verification` (admin + MFA, sin autoaprobación ni aprobación de cuentas
  baneadas, auditadas con nota opcional). Admin → Verificaciones ya no es simulado. Un rechazo humano es definitivo
  para esa sesión.
- **Borrado en Veriff:** se lanzaba sin esperar (`void`) y podía cortarse; ahora usa
  `EdgeRuntime.waitUntil` y solo borra en resultados finales (aprobado con edad o
  caducado). Rechazos y revisiones se conservan para la revisión humana.
- **URL de redirección:** el servidor valida que la URL de Veriff sea HTTPS en
  `veriff.com`/`veriff.me` antes de devolverla.
- **Badge de foto del perfil:** se leía de la columna sin aplicar el gate sandbox/live;
  ahora sale de `verification_snapshot`.
- **Índice** en `private.verification_notifications(session_id)` (aviso de rendimiento).
- **Historial de migraciones:** los archivos locales de los bloques 5 y 6 tenían versiones
  distintas de las remotas. Renombrados a las versiones remotas (contenido verificado por
  md5); el archivo único del Bloque 6 se divide en las 4 migraciones aplicadas. Las cuatro
  del Bloque 5 aplicadas en el SQL Editor (`rpc_block5`, `purge_test_data`,
  `seed_legal_documents`, `grants`) quedan en orden entre `payments_and_storage` y
  `security_invoker_api`.
- **Test RLS desfasado:** contaba 12 flags; con `verification_provider` son 13.

Migraciones nuevas: `20261003165824_verification_block6_fixes`,
`20261003170722_verification_block6_expiry`,
`20261003171224_verification_block6_notifications_idx`. Funciones redesplegadas:
`veriff-webhook` v4 y `verification` v3 (ambas responden 401 sin firma/sesión).

### Hecho cuando

- ✅ Una cuenta no verificada no puede ligar: RLS de likes/matches/messages, perfiles
  públicos y servicios exigen edad verificada; el rol tester no es prueba de edad.
- ✅ No se guarda ninguna imagen ni documento: solo estados, método, umbral, fechas e
  identificadores; la fecha de nacimiento solo existe en memoria.
- ✅ Veriff test como principal y Yoti como alternativa, webhooks firmados y
  `verification_status`.
- ✅ Foto e identidad verificadas (simuladas/persistidas en sandbox), badges, bans por hash.
- ✅ Revisión humana de decisiones negativas con cola real de admin.
- ✅ SQL remoto con rollback: **44/44** de verificación y 33/33 de RLS.
- ⏸️ Decisiones forzadas en Veriff Station extremo a extremo: **puerta del Bloque 6**.
  No consta autorización del propietario para posponer estas pruebas al bloque live.
- ⏸️ Foto e identidad live: Bloque 12.

### Validación adicional del Bloque 6 — 2026-10-03

- Reproducción y corrección: un webhook aprobado posterior podía sobrescribir un rechazo
  humano. Migración `20261003172650_verification_human_decision_final` conserva la decisión
  humana definitiva; regresión SQL probada antes y después de aplicar por MCP.
- Fechas de nacimiento imposibles no generan una prueba de edad; CORS admite el desarrollo
  en 127.0.0.1:5173/4173 y rechaza orígenes parecidos no autorizados.
- Registro persistido por capacidad con disponibilidad y caducidad; migración
  `20261003173504_verification_provider_access`. RPC de simulación explícita con rol,
  sandbox, herramientas, consentimiento y auditoría. Caducidad bloquea llamadas externas.
- Veriff Station: la integración conectada es **Nightlife TEST**, distinta de Test Company
  Jorge Chamorro. Webhook de decisiones guardado en la integración correcta, certificados
  activados. Trial de 14 días observado; corte conservador 2026-10-16T00:00:00Z registrado.
- Creación desde la app a las 17:48 UTC: sesión de edad guardada en Supabase, identificador
  de Veriff asociado y flujo alojado de Veriff visible. Esto acredita la conexión de API;
  no acredita aún la firma ni la entrega del webhook de decisión.
- `npm run check`: **279/279** tests, TypeScript, ESLint y formato correctos. Build correcto.
  SQL remoto: **51/51** verificación y **33/33** RLS, con rollback de fixtures.
  `npm audit` completo: **0 vulnerabilidades** (CA del sistema para el registro npm).
- Funciones ACTIVE desplegadas por MCP: verification v5, veriff-webhook v6, yoti-webhook v3.
  Sin JWT/sin firma: 401; método no autorizado: 405. No se publican secretos ni OTP.
- Advisors: WARN conocido de protección de contraseñas filtradas; 2 INFO de RLS sin
  políticas en tablas private cerradas a clientes; rendimiento 23 INFO de índices sin uso.
- Chat publicado previamente: lista larga móvil y altura reducida comprobadas; el último
  mensaje permanece por encima de la barra de escritura. Imágenes ya en commits anteriores.
- Rechazo Test entregado por webhook firmado: Station 200 OK, sesión Supabase failed y
  app «No superada». Solicitud de revisión humana persistida y visible tras recarga.
  Reenvío del webhook: una sola notificación y revisión conservada (idempotencia).
- Borrado final usa el estado persistido del nivel: identidad aprobada sin fecha de nacimiento
  puede borrar la sesión; edad sin prueba permanece en revisión y conserva la evidencia.
- Pendientes reales: aprobación de identidad Test, cola de admin y borrado final;
  publicar las correcciones auditadas
  de frontend y comprobar simulación persistida desde la UI. Bloque 7 no iniciado.

## Bloque 1 — Cimientos, diseño y arquitectura preparada (2026-10-02)

### Qué se hizo

- Proyecto React 19 + TypeScript 6 estricto + Vite 8 + Tailwind 4 + componentes estilo ShadCN/Radix.
- Estructura por funcionalidades (`src/features`, `src/shared`, `src/platform`, `src/i18n`, `src/mocks`).
- **Capa de plataforma** con 12 servicios (interfaz + implementación web) y estrategia de pagos
  (Stripe web / desactivado / tiendas futuras). ESLint prohíbe APIs del dispositivo fuera de ella.
- **Feature flags** (valores iniciales de 6.13, validación Zod por flag, fallo cerrado) y
  **entitlements** (`hasEntitlement`, `useEntitlement`), con mocks. Política del paywall pura y probada.
- **5 temas** (Neon Noir, Cyberpunk, Velvet, Sunset, Mono) como tokens generados desde TS, con
  contraste AA verificado por tests, acentos por tipo de lugar, estilo de mapa y heatmap por tema.
  Cambio instantáneo con View Transitions (fallback de opacidad) y _glitch_ breve en Cyberpunk.
- **Librería de movimiento:** tokens 150-400 ms, _springs_ con `visualDuration`, presets
  (fade, rise, scale, sello), "Reducir movimiento" (sistema, ajuste de la app o tema Mono).
- **Fuentes autoalojadas** (OFL): Inter, Space Grotesk, Unbounded, JetBrains Mono, Playfair Display.
- **Componentes base:** Button/ButtonLink, Chip con acento, Badge (verificado con sello, en directo,
  Aquí Ahora, Patrocinado, No confirmado), AnimatedCounter, LivePulse, BottomSheet con física de
  muelle, SegmentedControl, Switch, Skeleton, EmptyState animado, ScreenHeader, ListRow, Card/GlassCard.
- **Tab Bar** flotante de cristal (Descubre, Esta Noche, Chats, Perfil) con indicador animado.
- Pantallas: placeholders animados de las 4 pestañas, Perfil → Temas, Perfil → Ajustes
  (reducir movimiento, idioma ES/EN) y **Kit de componentes** (solo con `test_tools_enabled`).
- **PWA:** manifest, iconos (incl. _maskable_), _service worker_ solo para el _shell_.
- **i18n** ES/EN con claves tipadas; ningún texto fijo en componentes.
- Error Boundary por pantalla, pantalla 404, Result tipado en servicios.
- Vercel: `vercel.json` con SPA y cabeceras de seguridad.
- Docs: `PRD.md`, `ARCHITECTURE.md`, `API.md`, `SECURITY.md`, ADR 0001-0005, `CLAUDE.md`.

### Decisiones

Ver ADR 0001-0005. Las más relevantes:

- Desarrollo con Claude Code y hosting en **Vercel** en vez de Lovable (ADR 0002).
- TypeScript 6.0 (no 7.0) y Motion 13.5 (no 14.0) por compatibilidad/estabilidad.
- Temas en TS → CSS generado + tests de contraste AA.
- Paywall `visible` sin posibilidad de compra ⇒ "Próximamente".
- El tipo "bar" (no tiene acento en el PRD) usa un ámbar cercano al de "pub".

### Desviaciones

- El PRD menciona Lovable (Knowledge, escáner, scripts del editor): sustituido por `CLAUDE.md`,
  ESLint, `npm audit`, Security Advisors y auditoría de red con Playwright.
- Dependencias de desarrollo de las familias permitidas no listadas literalmente (ADR 0001).
- `paid_dm` se diseñará en el Bloque 9 (no es una ventaja recurrente).

### Hecho cuando

- ✅ Los 5 temas funcionan con animación (View Transitions + fallback; test de componente).
- ✅ Se respeta "reducir movimiento" (sistema, ajuste de la app y tema Mono; tests + Playwright).
- ✅ No hay CDNs externos (auditoría de red: 0 orígenes externos; fuentes/iconos autoalojados).
- ✅ Ningún componente accede directamente a las APIs del dispositivo (regla ESLint que rompe el build).

### Cómo probarlo

1. `npm ci && npm run dev` → http://localhost:5173
2. Perfil → Temas: cambia entre los 5 temas (Cyberpunk hace un _glitch_ breve).
3. Perfil → Ajustes: activa "Reducir movimiento" o el modo del sistema → solo fundidos; cambia el idioma.
4. Perfil → Kit de componentes: contadores, chips, badges (toca "Foto verificada" para el sello),
   selector, ficha con muelle (arrástrala hacia abajo) y estado de flags/entitlements.
5. `npm run check` (tipos, lint, formato y 136 tests) y `npm run build` (sin advertencias).

### Despliegue

- Vercel, proyecto `nightlife-connect` (equipo chaplications-projects): https://nightlife-connect-beige.vercel.app
- Protegido con Vercel Authentication (requiere sesión de Vercel) hasta el lanzamiento.
- Toolbar/feedback de Vercel desactivados (scripts de terceros, ADR 0002).
- Pendiente (propietario): conectar el repo en Vercel → Settings → Git para desplegar en cada push
  (el conector de Vercel usado no tiene permiso para enlazar GitHub).

### Puerta de seguridad

Ver `docs/SECURITY.md` → Bloque 1: sin hallazgos críticos ni altos.

### Pendiente / para el siguiente bloque

- Imágenes: el propietario genera con GPT las de `docs/design/IMAGE_PROMPTS.md` (firmas por tema, neutras tintables y contenido; prioridad 1 para el Bloque 2).

- Bloque 2: onboarding completo, firma legal, consentimientos y Centro de verificación (mock).
- Dudas abiertas para el propietario (ver respuesta del Bloque 1): proveedor SMS, contrato de Yoti,
  textos legales (abogado), dominio definitivo, datos de empresa.

---

## Bloque 2 — Onboarding, legal y verificación (mock) (2026-10-02)

### Qué se hizo

- **Bienvenida animada** (3 pantallas con gesto o botones): firma del tema activo (con _fallback_
  "ciudad en directo" mientras no haya imagen) y escenas neutras tintadas con el tema.
- **Onboarding completo** con máquina de estados pura y probada (PRD 5.2):
  1. Fecha de nacimiento en pantalla neutra (no muestra el límite de edad). Menor ⇒ no se crea
     cuenta ni se guarda nada.
  2. Documentos legales (Términos, Normas, Privacidad, versionados y legibles en ficha) con
     3 casillas **no premarcadas**, "Firmo y acepto" y "No acepto" igual de visible.
  3. Teléfono + OTP (prefijo, E.164, reenvío con cuenta atrás, errores tipados genéricos:
     número baneado, límite de SMS, código erróneo, demasiados intentos) y email opcional.
  4. Consentimientos (orientación con **firma** explícita art. 9, ubicación precisa con permiso
     del navegador, promociones LSSI, analítica), todos desactivados por defecto, con base legal
     y consecuencia; sin ubicación se elige ciudad.
  5. Perfil: 2-5 fotos **recodificadas en el dispositivo sin EXIF**, nombre, género, bio y
     Anthem (próximamente).
  6. Preferencias (solo con consentimiento de orientación): a quién y rango de edad 18-60+.
  7. Elegir tema → entrada en la app.
- **Información por capas** en cada formulario con enlace a la Política de Privacidad.
- **Centro de verificación** (teléfono, edad, foto, identidad) con estados simulados, revisión
  humana, aviso de IA y "nunca guardamos…".
- **Verificación de edad** (pantalla informativa + otro método), **foto** e **identidad** con
  consentimiento explícito, y **simulador del proveedor** (sandbox, solo testers).
- **Bloqueo "Verifica tu edad"** para ver perfiles, likes, chat, "Voy", check-in visible, crear
  eventos y promos de alcohol (probado desde Esta Noche).
- **Perfil → Consentimientos** para retirar o dar consentimientos igual de fácil.
- Herramienta de pruebas "Reiniciar onboarding".
- Imágenes de la sección 1 de `docs/design/IMAGE_PROMPTS.md` integradas (WebP, sin EXIF).

### Decisiones

Ver ADR 0006. Bio limitada a 300 caracteres (el PRD no fija límite). Prefijos de teléfono de
España y países vecinos de la UE.

### Desviaciones

- Las firmas de tema (5 imágenes) aún no existen: se usa un _fallback_ CSS animado.
- "Ya tengo cuenta" se añade con Supabase Auth en el Bloque 5.
- PDF firmado y email: Bloque 5 (PRD 11.2).

### Hecho cuando

- ✅ El flujo se puede recorrer completo (test de integración + recorrido con Playwright).
- ✅ No hay casillas premarcadas (comprobado en tests: firma legal, consentimientos y firma de
  orientación empiezan desmarcados).

### Cómo probarlo

1. Abre la app: si no has hecho el onboarding verás la bienvenida.
2. Fecha adulta → firma → teléfono cualquiera (+34 6xx xxx xxx) → código **123456** (se muestra
   en modo pruebas). El número +34 600 000 000 simula un teléfono baneado.
3. Consentimientos → perfil (2 fotos) → preferencias → tema.
4. Esta Noche → "Ver perfiles" ⇒ "Verifica tu edad" → Continuar con Yoti → simulador → Aprobado.
5. Perfil → Reiniciar onboarding para repetirlo. Prueba también una fecha de menor y "No acepto".

### Puerta de seguridad

Ver `docs/SECURITY.md` → Bloque 2: sin hallazgos críticos ni altos.

### Pendiente

- Imágenes: firmas de tema (prioridad 1) y las de los bloques 3 y 5.
- Bloque 3: Descubre (mapa simulado, ficha, "Quién hay"), Esta Noche (swipe y match), Chats,
  Perfil y Crear evento.

---

## Bloque 3 — App principal y experiencia de match (mock) (2026-10-02)

### Qué se hizo

- **Descubre**: mapa 3D nocturno simulado a pantalla completa con pines (personas + edad media,
  halo en directo, "Patrocinado", "No confirmado"), heatmap que respira, vuelo de cámara al pin,
  zoom/recentrar, buscador de cristal, selector Todo/Locales/Eventos, chips por tipo, filtros
  completos (gratis) con orden, vista de lista con patrocinados (máx. 2 arriba y 1 de cada 5) y
  botón "+ Crear evento". En escritorio: mapa a la izquierda y panel a la derecha.
- **Ficha** (bottom sheet con muelle): "Quién hay" con contadores en directo y umbral de 5,
  reparto por género, "van esta noche", horario, precio, dirección, acciones (Esta Noche Voy,
  Estoy Aquí con animación de check-in, Ver perfiles, Votar, Objetos perdidos), Vibe Check y,
  en eventos, estado, aviso de seguridad, "Confirmo que existe" (3/3) y "Reportar".
- **Esta Noche**: Aquí Ahora / Esta Noche Voy, lugares con gente (transición de elemento
  compartido), acceso a "Quién te ha dado like".
- **Swipe** (pieza estrella): pila con profundidad (siguiente tarjeta escalada y desenfocada),
  fotos por toques laterales con progreso, arrastre con inclinación, sellos ME GUSTA / PASO con
  opacidad proporcional, salida por velocidad o vuelta elástica, vibración (nativo), botones y
  teclado equivalentes, "Aquí Ahora", Anthem con ecualizador, "Lugar en común", "Solo amistad",
  filtro gratuito "Solo verificados", límite de 5 likes/día (ilimitados con entitlement),
  "Deshacer" (entitlement) con rebobinado, aviso "N personas nuevas en X", estado vacío con
  lugares cercanos.
- **Match**: fotos que vuelan y se juntan, partículas del tema, título contextual ("¡Match en
  X!" / "¡Los dos vais a X esta noche!"), ambos Anthems, rompehielos por reglas editables,
  "Escribir ahora" (lleva el mensaje al chat) y "Seguir mirando". También llega por realtime.
- **Chats**: nuevos matches, conversaciones con no leídos, chat con indicador de escritura y
  de leído, eliminar match, bloquear (mutuo e instantáneo) y reportar (incl. "posible menor" y
  "Me siento seguido/a").
- **Perfil**: tarjeta con badges y Anthem, semáforo (abierto/amistad/invisible), modo discreto,
  preferencias, Premium según flags, privacidad, apariencia, legal/contacto (próximamente).
- **Crear evento**: solo con edad verificada, lugar público confirmado, máx. 2/día,
  antiduplicados, publicado como "No confirmado".
- Perfil de otra persona, "Quién te ha dado like" (desenfocado sin `see_likes` si hay paywall).
- Reglas puras y probadas, mundo simulado y realtime falso (ADR 0007).

### Hecho cuando

- ✅ Los momentos firma y el match están implementados y fluidos en móvil (vuelo de cámara,
  ficha con muelle, contadores, pulso en directo, heatmap, swipe con física, sellos, match con
  partículas, check-in animado, sello en badges). Probado con arrastre real en Chromium móvil.
- ✅ Funciona con los 5 temas (capturas de mapa, ficha y swipe en Neon Noir, Cyberpunk, Velvet,
  Sunset y Mono); con "reducir movimiento" todo pasa a fundidos.

### Cómo probarlo

1. Descubre → toca un pin → ficha. "Estoy Aquí" fuera del local ⇒ "Simular que estoy aquí".
2. Esta Noche → Ver perfiles (pide verificar la edad la primera vez: usa el simulador).
3. Desliza o usa los botones; Lucía, Alex, Nerea, Clara e Inés ya te han dado like ⇒ match.
4. "Escribir ahora" → el chat responde y muestra "escribiendo" y "leído".
5. Perfil → semáforo y modo discreto; "+ Crear evento" desde Descubre.

### Desviaciones

- Mapa simulado (no Mapbox) y ubicación fija en el centro del distrito hasta el Bloque 7.
- Avatares ilustrados por código y portadas por tipo hasta tener las imágenes GPT.
- Legal y Contacto en Perfil quedan "Próximamente" (web pública en el Bloque 4).

### Puerta de seguridad

Ver `docs/SECURITY.md` → Bloque 3: sin hallazgos críticos ni altos.

### Pendiente

- Bloque 4: panel de locales, admin (pagos, flags, herramientas de prueba), web pública legal y
  pantallas de pago (paywall, checkout, Mi suscripción, canjear código, DM de pago).

---

## Bloque 4 — Paneles, web pública y pantallas de pago (mock) (2026-10-02)

### Qué se hizo

- **Catálogo propio** (docs/MONETIZATION.md, ADR 0008): Pase, Pase VIP, Pase de una noche,
  Chispas, Foco y Mensaje directo, con precios con IVA, créditos y entitlements; se retira
  `advanced_filters` (todos los filtros gratis) y se añaden `travel_mode`, `priority_likes` y
  `no_sponsored_cards`. Flags nuevos (apagados): `store_payments_enabled`,
  `sponsored_cards_enabled`, `travel_mode_enabled`.
- **Paywall** según flags: oculto / "Próximamente" con "Avísame" (exige consentimiento
  comercial) / checkout. Comparativa "Siempre gratis", "Ahora no", canjear código y Mi suscripción.
- **Checkout** con precio sin IVA, IVA, total, renovación, cómo cancelar, desistimiento de 14
  días, proveedor y "Suscribirme y pagar"; **pasarela de prueba** (tarjeta 4242) que simula el
  webhook y concede los entitlements.
- **Mi suscripción**: cancelar (2 toques), reactivar, desistir con reembolso (visible los 14
  días), pase de una noche, créditos y facturas. **Canjear código** con límite de intentos.
- **Mensaje directo de pago** en el perfil de otra persona (solo con `paid_dm_enabled`), respeta
  el semáforo rojo. Enlaces a Premium desde Perfil, límite de likes y "Quién te ha dado like".
- **Usuario**: Privacidad y datos (exportar JSON, solicitudes con plazo, cerrar todas las
  sesiones, eliminar cuenta con OTP), Documentos firmados, Moderación y apelaciones (decisiones
  explicadas, recurrir una vez, mis reportes), SOS Lite (112, avisar a un contacto, hasta 3
  contactos) y **Cuenta suspendida** (la app redirige si la cuenta está suspendida).
- **Web pública sin login** (`/legal`): índice, documentos versionados (Aviso legal, Términos,
  Normas, Privacidad, Cookies, Clasificación y patrocinados, Locales, Patrocinio, Terceros —con
  Vercel en lugar de Lovable— y Premium solo cuando hay compra), eliminar cuenta y derechos
  (URL para Google Play), formulario DSA de contenido ilegal con referencia, y contacto (punto
  DSA). Selector ES/EN. `robots.txt` permite solo `/legal`.
- **Panel de locales** (`/venue`): reclamar ficha con prueba, mis locales, estadísticas
  agregadas por hora con umbral, editar ficha, evento oficial, solicitar patrocinio (Destacado,
  Destacado Plus, Top) y aviso de "Estadísticas Pro".
- **Admin** (`/admin`, rol admin + segundo factor simulado): dashboard; colas genéricas de
  verificaciones, moderación, apelaciones, bans, claims, eventos, patrocinios, suscripciones,
  entitlements, códigos, eventos de pago, derechos, documentos legales y auditoría, con acciones
  y nota obligatoria en decisiones que afectan a una persona; **Feature flags** editables (el
  paywall cambia en directo) y auditados; **Pagos** (catálogo, crear códigos, conceder
  entitlements); **Herramientas de prueba** (10 simuladores y roles simulados) y
  **Configuración** con límites acotados. Barra lateral en escritorio.

### Hecho cuando

- ✅ Todas las pantallas se pueden navegar (rutas conectadas; recorrido con Playwright en móvil
  y escritorio; tests de integración de paywall, compra, cancelar/desistir, canjear, admin,
  web legal, privacidad, moderación, SOS, panel de locales y DM de pago).
- ✅ El paywall cambia según los flags simulados (tests: tester ⇒ checkout, usuario ⇒
  Próximamente, `premium_enabled = off` ⇒ oculto, audiencia `none` + oculto ⇒ nada; y cambio
  en directo desde Admin → Feature flags).

### Cómo probarlo

1. Perfil → Premium → Continuar → Suscribirme y pagar → "Pagar con tarjeta de prueba" →
   Mi suscripción: cancela, reactiva o desiste. Canjea `NITE-TEST-0001`.
2. Perfil → Admin → código **123456** → Feature flags: pon `premium_enabled = off` o
   `payments_audience = none` y vuelve a Premium. Herramientas de prueba: "Que me den like",
   "Llenar un local", "Simular suspensión"… (el estado simulado se reinicia al recargar).
3. Perfil → Locales y equipo → Panel de locales → Bar Cobalto.
4. Perfil → Privacidad y datos: descargar datos, eliminar cuenta (código 123456), SOS, moderación.
5. Abre `/legal` sin sesión (o desde Perfil → Legal).
6. `npm run check` (235 tests) y `npm run build`.

### Desviaciones

- Los pagos son una simulación local (pasarela de prueba propia); Stripe real llega en el
  Bloque 9 y las tiendas en el Bloque 11.
- El segundo factor del admin es simulado (código fijo); en el Bloque 5 se usará MFA TOTP de
  Supabase Auth (`aal2`) comprobado en el servidor.
- PDF firmado y email: Bloque 5. Los textos legales siguen siendo borradores para el abogado.

### Puerta de seguridad

Ver `docs/SECURITY.md` → Bloque 4: sin hallazgos críticos ni altos.

### Pendiente

- Bloque 5: Supabase (esquema, RLS, roles, `app_settings`), Auth con OTP, perfiles, Storage,
  documentos y firma, generador de datos de prueba con `is_test` y purga.

---

## Bloque 5 — Backend base, legal y modo pruebas (2026-10-03)

### Qué se hizo

- **Supabase `Nightlife_Connect` (eu-west-1)**: esquema completo del PRD 4.1 en 10 migraciones
  versionadas (`supabase/migrations`), RLS en todas las tablas y privilegios denegados por
  defecto (el cliente solo lee lo suyo; toda escritura sensible va por funciones del servidor).
- **Roles** (`user_roles`: user, tester, venue_manager, admin) comprobados con funciones seguras;
  **flags y límites** en `app_settings` con validación de valores y auditoría.
- **Alta con teléfono + OTP** (Supabase Auth) con comprobación previa de bans por HMAC
  (teléfono y dispositivo, clave en Vault) y límites por IP/teléfono; **«Ya tengo cuenta»**;
  cerrar sesión; la caché se refresca sola al entrar/salir.
- **`complete_onboarding`** en una transacción: revalida edad ≥ 18, firma de las versiones
  vigentes, fotos en la carpeta del usuario, consentimientos explícitos y preferencias solo con
  el consentimiento de orientación. Fotos sin EXIF en un bucket **privado** (URLs firmadas).
- **Documentos legales** versionados ES/EN en la base de datos (Premium cargado inactivo);
  **evidencia inmutable** en `consent_records`; **PDF firmado** generado en el servidor y
  **envío por email** (Gmail del propietario por ahora) con _outbox_.
- **Modo pruebas**: generador de personas `is_test` (Edge Function `test-tools`, doble puerta
  rol + flag), aislamiento por RLS y **purga** (`purge_test_data`).
- **Admin real**: segundo factor TOTP (código QR) y `aal2` exigido en el servidor; flags,
  configuración, usuarios y roles, dashboard y auditoría reales.
- **Derechos**: exportar datos reales, borrar cuenta con OTP (Edge Function `delete-account`),
  cerrar sesión en todos los dispositivos; contactos SOS reales.
- Composición híbrida (ADR 0009): verificación, mapa, ligar, chat y pagos siguen simulados hasta
  sus bloques. Sin variables de Supabase (tests) todo funciona con mocks.

### Hecho cuando

- ✅ Un tester se da de alta con un teléfono de prueba y firma: alta real del propietario en la web
  (perfil, 2 fotos en Storage privado, firmas y consentimientos en `consent_records`, roles
  admin + tester asignados por SQL).
- ✅ Las RLS están probadas: `supabase/tests/rls.sql`, **33/33** (anónimo, usuario verificado y
  sin verificar, tester, admin sin/con MFA, IDOR, asignación masiva, validación del alta).
- ✅ Los datos de prueba no son visibles para un usuario normal (test de RLS + función de perfiles).

### Cómo probarlo

1. Web → «Empezar» → fecha adulta → firma → teléfono de prueba asignado (+34) → su código
   (configurados en Supabase → Auth → Phone; los códigos no se publican en el repo).
2. Completa consentimientos, perfil (2 fotos), preferencias y tema → entras en la app.
3. Perfil → Privacidad y datos → Documentos firmados → «Descargar PDF firmado».
4. Con roles admin + tester: Perfil → Admin → configura el segundo factor (QR) → Usuarios,
   Feature flags, Herramientas de prueba → «Generar ciudad de prueba» y «Purgar».

### Desviaciones

- Migraciones `rpc_block5`, `purge_test_data`, `seed_legal_documents` y `grants` aplicadas por el
  propietario en el SQL Editor (la herramienta exigía una aprobación que no podía mostrar): no
  figuran en el historial de migraciones de Supabase, pero están en el repositorio.
- PDF y SMTP propios sin dependencias (ADR 0009); el email usa Gmail hasta el lanzamiento.
- El _outbox_ se vacía desde la app: al terminar el alta y al abrir la app con sesión (si el
  email está confirmado y hay un envío pendiente), además del botón «Enviármelo por email». El
  envío por cron en servidor llega con los avisos del Bloque 9.
- La ciudad de prueba crea personas; los locales reales importados llegan en el Bloque 7.

### Correcciones tras la prueba real

- La web seguía mostrando la versión simulada cacheada: el service worker se registra ahora desde
  el bundle (`src/platform/app-updates.ts`) y la página se recarga sola con cada versión nueva.
- Las firmas legales se guardaban dos veces (paso legal con sesión + `complete_onboarding`): la
  firma por RPC solo se usa con la cuenta ya terminada, igual que los consentimientos.
- El email con el PDF se quedaba en el _outbox_: nueva acción `outbox` en `signed-documents` (solo
  envía si hay algo pendiente) llamada tras el alta y al abrir la app.

### Puerta de seguridad

Ver `docs/SECURITY.md` → Bloque 5.

## Bloque 5 — Corrección de acceso y cierre operativo (2026-10-03)

- Guards en bienvenida/login/alta: una sesión terminada entra en Descubre; se conservan las restricciones de suspensión.
- Login pendiente: aviso tras OTP válido, completar alta o cerrar sesión antes de usar otro número.
- Fallos de Auth/BBDD no se interpretan como alta pendiente; reintento sin consumir otra vez el OTP.
- Perfil → Cuenta → Cerrar sesión, justo después de Privacidad. Reset y pista OTP únicamente en mock.
- Caché privada reiniciada al cambiar de identidad; un fallo al cerrar sesión no se presenta como éxito.
- Español/inglés y tests de acceso/caché/errores: `npm run check` pasa en la copia aislada, 256/256 tests.
- `npm audit`: 0 vulnerabilidades. Build y comprobación del despliegue se verifican antes de entregar.
- RLS: 33/33, con rollback; después permanecen 1 perfil real, 10 consentimientos y 2 fotos, sin fixtures.
- Imágenes guardadas en commit independiente. Backend/migración del bloque 6 excluidos de este cierre.
- Política aprobada: proveedores gratuitos o simulación persistida; Veriff primero al retomar el bloque 6.
- Bloque 12 añadido para contratación, costes y activación live; commit/push y OK obligatorio al cerrar cada bloque.

### Validación operativa pendiente

- Entrar con la cuenta del propietario y su OTP en el despliegue actualizado; comprobar registros de Auth.
- Con sesión y MFA reales: Generar ciudad de prueba y Purgar; comprobar aislamiento y preservación de datos reales.
- No se marca este cierre operativo como terminado hasta tener evidencia de estas pruebas.
- El trabajo local previo del bloque 6 se conserva; no se continúa sin OK al cierre del bloque 5.

### Despliegue validado — 2026-10-03

- Publicado el commit ee5feab84affaab118c4e03475b374a5dfc2f211 en [Nightlife Connect](https://nightlife-connect-beige.vercel.app).
- Vercel MCP confirma READY, destino production, deployment dpl_HXrgnz8ibW3YwdcYpU2S3xbX18jq y el SHA publicado.
- Excepción autorizada por el propietario: CLI oficial 62.2.0, porque MCP devuelve «Tool deploy_to_vercel not found». Cuenta/proyecto verificados; plan Hobby y máquina básica existentes, sin contratación.
- El proyecto no tiene repositorio Git enlazado: el push no activa un despliegue automático. Se publicó un archivo extraído de ese SHA, sin cambios locales del bloque 6 ni documentos sin seguimiento.
- Build local sin avisos. Build remoto correcto, con avisos previos sobre engines Node >=22 y glob@11.1.0 obsoleto; npm audit remoto: 0 vulnerabilidades.
- El alias sirve el bundle nuevo y el service worker actualizado. La pestaña de producción usada para probar conserva un bundle anterior: queda pendiente comprobar la actualización de esa caché antes de afirmar que el flujo móvil está validado.
- El servidor local 127.0.0.1:5173 sirve ahora una copia aislada del mismo commit conectada a Supabase real; la prueba mock anterior no consultaba la cuenta del propietario. No usarla como evidencia de un alta real pendiente.
- A las 14:18–14:22 UTC los logs registran check_signup (2 respuestas 200) y OTP (1 respuesta 200) de la prueba local real. Aún no hay verificación OTP en esa ventana; no se publican códigos.
- El trabajo previo del bloque 6 se restauró y mantiene un stash recuperable. Sigue pendiente del OK explícito tras el cierre operativo del bloque 5.
- Pendientes: OTP real terminado, móvil/logout/redirecciones sobre la versión nueva y Generar/Purgar con MFA del propietario. El bloque 5 sigue abierto.

### Cierre operativo del Bloque 5 — 2026-10-03, 16:55 (Madrid)

- ✅ Acceso real en el commit publicado ee5feab: la cuenta terminada entra en Descubre después del OTP, sin fecha de nacimiento ni aviso de alta pendiente.
- ✅ Sesión terminada: welcome, login y onboarding redirigen a discover, también tras navegación completa.
- ✅ Perfil → Cuenta → Cerrar sesión, inmediatamente después de Privacidad; sin Reiniciar onboarding ni pista OTP mock con Supabase.
- ✅ Cerrar sesión lleva a Bienvenida y permanece ahí al recargar. Los escenarios de cuenta pendiente, otro número, errores de conexión y caché están cubiertos por los tests.
- ✅ MFA real verificado por el propietario. Generar ciudad creó 12 usuarios Auth y perfiles is_test, todos con rol, preferencias y verificación; seguían presentes después de recargar.
- ✅ Purgar eliminó exclusivamente esos 12 usuarios/perfiles. No había locales, eventos, asistencia ni objetos perdidos de prueba ajenos que pudiera borrar.
- ✅ Antes y después: 1 perfil real terminado, 10 consentimientos y 2 fotos del propietario; 0 usuarios/perfiles de prueba tras purgar. Auditoría: test_tool.generate_people y test_data.purge, ambos con detalle 12 test users.
- ✅ Logs 16:38–16:52 Madrid: check_signup, OTP, verificación OTP y logout correctos. MFA tuvo un intento 422 y después uno 200; no se publica ningún código.
- ✅ Recorrido sobre el bundle nuevo: 0 errores de consola; recursos observados solo del despliegue y Supabase. El alias público también carga index-DKkx7FH0.js después de cerrar y reabrir la pestaña antigua.
- ✅ Validación del código publicado: 256/256 tests, TypeScript, ESLint y formato; build correcto; RLS 33/33 con rollback; npm audit 0 vulnerabilidades.
- ✅ Vercel READY, SHA ee5feab84affaab118c4e03475b374a5dfc2f211, deployment dpl_HXrgnz8ibW3YwdcYpU2S3xbX18jq; [URL pública](https://nightlife-connect-beige.vercel.app).
- ✅ Email con PDF enviado y factor admin verificado, comprobados previamente. No se repitió el envío.
- Avisos conocidos: Advisor WARN de protección de contraseñas filtradas (la app usa OTP), INFO de índices sin uso y avisos del build remoto sobre engines/glob. Se conservan documentados; no se contrataron servicios para resolverlos.
- Los pendientes operativos de los apartados anteriores quedan completados con estas evidencias. El Bloque 5 está terminado y espera OK para pasar al 6.
- Matches: pestaña Chats, nuevos matches arriba y conversaciones debajo. Matching y chat siguen en demo en memoria hasta el Bloque 8; Marta y Clara son ejemplos, no relaciones reales de Supabase.
- Bloque 6 preservado sin publicar; siguiente alcance tras el OK: Veriff test primero, Yoti como alternativa y simulación explícita persistida. No se inicia aún.
