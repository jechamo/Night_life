# Roadmap aprobado — login por email, locales, guías y regresión (2026-10-08)

> Aprobado por el propietario el 08/10/2026. Cada punto se ejecuta como bloque con su plan,
> pruebas, puerta de seguridad y OK explícito antes del siguiente (CLAUDE.md).

## Contexto

El propietario pide revisar 4 temas antes de decidir el siguiente trabajo. No hay cambios de
código en este plan: es un diagnóstico del estado real del repo + recomendación y propuesta
de bloques. Ningún punto se implementa sin OK explícito (CLAUDE.md, PRD 3.5).

---

## 1. Login: OTP en el alta y OAuth después

### Estado real (comprobado en código)

- Alta y login: teléfono + OTP SMS (`src/adapters/supabase/onboarding.ts:34,42`,
  `LoginScreen.tsx` reutiliza `PhoneStep`).
- **El admin NO usa OAuth**: entra con el mismo teléfono + OTP y después un segundo factor
  **TOTP** (app autenticadora, nivel `aal2`), comprobado en cada RPC de admin
  (`src/adapters/supabase/admin.ts:401-428`, `AdminLayout.tsx`).
- La sesión **ya es persistente**: `persistSession: true` + `autoRefreshToken: true` en
  `src/adapters/supabase/client.ts`. En teoría el OTP solo debería pedirse otra vez si:
  1. el usuario pulsa "Cerrar sesión";
  2. cambia de navegador/dispositivo, o borra datos;
  3. **iPhone: la PWA instalada y Safari tienen almacenamiento separado** (causa muy típica);
  4. en Supabase Auth hay "time-box" o "inactivity timeout" de sesiones configurado.

### Aclaración del propietario

La idea es: **SMS solo en el alta y después entrar con una app autenticadora (TOTP)** para
no pagar SMS en cada login.

### Por qué TOTP como login no encaja tal cual

- En Supabase el TOTP es **solo segundo factor** (`aal2`): exige haber entrado antes con un
  primer factor (teléfono, email, Google…). No se puede entrar únicamente con el código del
  autenticador. Así funciona hoy el admin: OTP SMS **y** TOTP.
- Hacerlo a mano (una Edge Function que valide el TOTP y cree la sesión) es construir un
  sistema de login propio: más riesgo de seguridad, límites de intentos y recuperación por
  nuestra cuenta. No lo recomiendo.
- Para un usuario normal de una app para ligar, instalar Google Authenticator es mucha
  fricción: se perderían altas o logins.
- Si pierde el móvil o la app autenticadora, la recuperación vuelve a ser por SMS.

### Decisión del propietario (confirmada)

El SMS se vuelve a pedir **al cerrar sesión**. Se aprueba: **SMS solo en el alta; después
login con código por email**. Diseño:

- En el alta el email pasa de "opcional" a **recomendado** (sigue sin ser obligatorio para no
  romper el PRD 5.2; quien no lo ponga entra por SMS como hoy). Ya se recoge en `PhoneStep`
  y se confirma con `db.auth.updateUser({ email })` (`src/adapters/supabase/onboarding.ts:90`).
- `LoginScreen`: opción principal "Entrar con email" → `signInWithOtp({ email,
options: { shouldCreateUser: false } })` → pantalla de **código de 6 dígitos** (no enlace
  mágico: en iPhone el enlace abriría Safari y no la app instalada). "Entrar con SMS" queda
  como alternativa. Nunca se crean cuentas por email.
- Ajustes › Cuenta: añadir/cambiar y verificar email para usuarios ya existentes.
- Plantilla de email de Supabase Auth con `{{ .Token }}`, textos ES/EN.
- **SMTP:** el SMTP por defecto de Supabase tiene un límite muy bajo y es solo para pruebas;
  hay que poner el SMTP propio en Auth (hoy el proyecto usa Gmail del propietario hasta el
  lanzamiento, ADR 0009) → sin coste nuevo. Límites antiabuso de envíos.
- Mismos mensajes de error para "email no registrado" y "código enviado" (no revelar qué
  emails tienen cuenta).
- Sin cambios en: admin (SMS + TOTP), reautenticación por OTP para borrar cuenta/cambiar
  teléfono, bans por hash del teléfono.

### Recomendación para gastar el mínimo en SMS (contexto)

1. **La sesión ya dura indefinidamente** (`persistSession` + `autoRefreshToken`). Un usuario
   solo vuelve a pedir SMS si cierra sesión, cambia de móvil/navegador o (en iPhone) pasa de
   Safari a la app instalada. **Primero diagnosticar** por qué os lo pide otra vez (ajustes
   de sesión de Supabase Auth, caso iOS/PWA). Con eso el gasto de SMS ya queda casi solo en
   altas.
2. **Login de vuelta con código por email** en vez de SMS: Supabase lo trae de serie
   (`signInWithOtp({ email, shouldCreateUser: false })`), cuesta prácticamente nada y usa el
   proveedor de email ya previsto. El teléfono sigue siendo obligatorio en el alta (1 cuenta
   por teléfono, bans por hash). En el onboarding se anima a añadir y verificar el email
   (el PRD ya lo contempla como opcional y verificado). SMS queda como respaldo.
3. **App nativa (Bloque 11, no en este plan):** desbloqueo con Face ID / huella sobre la sesión guardada
   (biometría ya prevista en el Anexo B): el usuario no vuelve a meter códigos.
4. El **TOTP se mantiene como segundo factor** opcional para usuarios que lo quieran y
   obligatorio para admin. Las acciones sensibles (borrar cuenta, cambiar teléfono) siguen
   pidiendo OTP.
5. Google/Apple: opcional más adelante; son terceros nuevos (requieren permiso) y Apple
   obliga a ofrecer su login en iOS si se ofrece Google.

---

## 2. Locales: ventajas actuales y circuito de acceso

### Circuito actual (comprobado)

1. **Local (cualquier usuario registrado):** Perfil › Negocio › _Panel de locales_ (`/venue`)
   → "Reclamar un local" → busca el local y escribe una prueba en texto libre (10-500
   caracteres: CIF, factura, email del dominio) → `venue_claims` en `pending`.
2. **Admin** (rol admin + TOTP): Admin › _Locales y claims_ → aprobar o rechazar (rechazo con
   explicación; no puede aprobar su propio claim). Al aprobar: fila en `venue_managers` +
   rol `venue_manager` (`supabase/migrations/20261004073939_block9_operations.sql:222-230`).
3. **Gestor del local** (`/venue/:id`): editar ficha, estadísticas, eventos oficiales,
   patrocinio, Estadísticas Pro y Flash Alerts.
4. **Patrocinio:** (a) manual: el local lo solicita, el admin lo activa con nº de factura
   (máx. 3 por ciudad, `sponsorship_slots`); o (b) autoservicio Stripe TEST detrás de
   `sponsorship_self_service_enabled` (30 días, pago único, reserva 24 h).

### Ventajas que existen hoy

| Nivel            | Precio TEST | Qué da                                                                                                                                                                                                                       |
| ---------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Gratis           | 0 €         | Ficha editable (descripción, horario, precio), eventos **"Oficial"** sin esperar confirmaciones, estadísticas básicas agregadas (afluencia/hora, edad media, % verde, check-ins semana, "van esta noche"; umbral 5 personas) |
| Destacado        | 29 €/30 d   | Pin con etiqueta "Patrocinado" en el mapa + tarjeta patrocinada en el swipe (máx. 1 de cada 10; no la ven usuarios con Pase)                                                                                                 |
| Destacado Plus   | 49 €/30 d   | + primeras posiciones en listas (máx. 2 arriba y 1 de cada 5, **solo si cumple los filtros del usuario**) — `src/features/places/model/sponsored.ts`                                                                         |
| Top              | 79 €/30 d   | Precede a Plus + **Flash Alerts** de 1 h a adultos verificados con consentimiento comercial                                                                                                                                  |
| Estadísticas Pro | 19,99 €/mes | Detalle por hora/edad/semáforo + comparativa con locales a 5 km                                                                                                                                                              |

### Huecos frente a "firmar contrato con el local"

- No existe la **empresa/contrato**: ni razón social, CIF, contacto de facturación, versión
  de "Condiciones para Locales" firmada, fechas de contrato ni plan contratado.
- La prueba del claim es solo texto; no hay subida de documento ni verificación.
- El admin **no puede invitar ni asignar** un gestor directamente: siempre espera a un claim.
- No hay **equipo** (varios gestores por local con roles; la tabla lo permite, la UI no).
- Las ventajas de local no son entitlements: se derivan de `sponsorships`/suscripción Pro.
  Un contrato offline obliga hoy a activarlos a mano uno a uno.

### Flujo propuesto

**Admin:** Locales › _Nuevo partner_ → datos de empresa + contrato (PDF, versión, fechas,
plan) → vincula uno o varios locales → genera **invitación** (enlace/código de un solo uso,
caduca en 7 días) → al canjearla se asigna gestor sin pasar por el claim.
**Local:** abre la invitación → alta con OTP (o login) → acepta "Condiciones para Locales"
(registro en `consent_records`) → onboarding del panel (completar ficha, fotos, horario) →
ve su plan y ventajas activas.
**Modelo:** `venue_accounts` (empresa) + `venue_entitlements` (ventaja, origen
`contract|stripe|admin|promo`, inicio, fin) como única fuente de verdad, igual que los
entitlements de usuario (regla del CLAUDE.md). El autoservicio Stripe y el claim siguen
para locales pequeños.

---

## 3. Más ideas para locales (diferenciadoras, ligadas a la noche)

**Rápidas y de alto valor**

1. **Fotos propias + portada** (sustituye la imagen genérica por tipo de `PlaceCover.tsx`;
   la columna `venues.photos` ya existe). Moderación, límite de fotos, sin EXIF. Gratis 1
   portada; galería ampliada en planes de pago.
2. **Estado en directo:** "Cola: poca/mucha", "Casi lleno", "Entrada gratis hasta la 1:00",
   "Happy hour ahora". Lo que Google Maps no da y encaja con "Esta Noche".
3. **Ficha enriquecida y filtrable:** música/DJ/line-up de la noche, dress code, edad
   mínima, precio de entrada y de copa, terraza, accesibilidad.
4. **Informe de resultados (ROI):** vistas de ficha, "Voy" → check-in real, rendimiento de
   cada patrocinio/Flash (siempre agregado). Es lo que convence al local de renovar.
5. **Responder al Vibe Check** y badge **"Partner verificado"**.

**Medio plazo, muy diferenciadoras** 6. **Lista de la app / guest list con QR:** "Entra gratis antes de la 1:30 con NightLife";
el portero escanea → conversión medible (la mejor prueba de valor para el local). 7. **Promos por check-in** ("2x1 en refrescos al hacer check-in"): alimenta los datos de
afluencia, que son el corazón de la app. Alcohol solo según normativa y adultos verificados. 8. **Códigos de RRPP/promotor:** cada relaciones públicas tiene su código y el local ve
quién trae gente. Muy propio del ocio nocturno en España. 9. **Equipo del local:** invitar a encargados/RRPP con permisos limitados; multi-local para
grupos. 10. **Sello "Local seguro"** (protocolo punto violeta, personal formado) visible en la ficha:
encaja con la seguridad de una app de citas. Fase posterior y delicada: aviso al
personal del local ante un SOS de alguien dentro (solo con consentimiento). 11. **Objetos perdidos gestionados por el local** ("lo tenemos en barra"). 12. **Widget/QR para su Instagram:** "Mira cuánta gente hay ahora" → bucle de captación. 13. **Historia de esta noche** (foto/vídeo 24 h): más coste de almacenamiento y moderación.

---

## 4. Reservas y pedir copas/botellas desde la app — opinión

Coincido: **pedir y pagar copas es casi otro producto**. Lo difícil no es la pantalla:

- **Dinero de terceros:** cobrar en nombre del local = marketplace (Stripe Connect, alta y
  KYC de cada local, comisiones, reembolsos, facturación e IVA como intermediario).
- **Operativa en hora punta:** el personal necesita una app/pantalla de pedidos y
  atenderla con el local lleno; sin integración con su TPV se duplica trabajo. Es la
  principal causa de fracaso de estos sistemas.
- **Alcohol:** venta a mayores verificados y normativa autonómica; responsabilidad si sale
  mal.
- Existen plataformas de ocio nocturno especializadas en entradas, listas y reservas de mesa.

**Recomendación por fases (de menor a mayor riesgo):**

1. **Solicitud de reserva de mesa/botella sin pago**: el usuario la pide, el local la
   acepta o rechaza en su panel y se avisa en la app. Sin dinero ni TPV. Encaja como ventaja
   de plan de pago para el local. → recomendable tras las ideas rápidas.
2. **Guest list con QR** (idea 6) — mismo espíritu, valor inmediato.
3. Enlace a la plataforma de reservas/entradas que ya use el local.
4. Solo tras validar demanda con 1-2 locales piloto: pedido "recoger en barra" con aviso de
   "listo" y pago en el local; el pago en la app al final y como bloque propio, después del
   lanzamiento (Bloque 12 o posterior).

---

## 5. Usuarios que informan de cómo está el local ("La gente dice")

### Qué hay hoy

**Vibe Check** (`public.ratings`): con check-in activo el usuario elige **una** opción
(Ambientazo, Buena música, Tranquilo, A tope, Buen rollo), puede cambiarla y se muestra
agregada. Además la ficha ya tiene un campo `music` (géneros) que viene del catálogo.
Es una buena base pero mezcla cosas distintas en una sola elección y no dice "cuánta gente",
"cola" ni "qué música suena ahora".

### Propuesta: "Cómo está ahora"

- **Varias preguntas rápidas de un toque** (en vez de una sola):
  - Gente: vacío · normal · lleno · a tope.
  - Cola para entrar: sin cola · poca · larga.
  - Música: me gusta / no me gusta + "suena ahora" (reguetón, techno, comercial, indie…).
  - Ambiente: las opciones actuales del Vibe Check.
- **Música: la declara el local y la confirma la gente.** El local pone su estilo y el
  line-up de la noche; la ficha muestra "El local dice: techno" junto a
  "La gente dice: 70 % techno ahora". Esa transparencia da confianza.
- **Solo cuenta lo reciente:** "ahora" = votos de los últimos 60-90 min; con el histórico
  se muestra "normalmente los sábados a la 1:00 está lleno".
- **Anti-trampas:** solo con check-in (ya existe), un voto por pregunta y hora, mínimo de
  votos para mostrar (como el umbral de 5 de las estadísticas), los gestores no votan su
  propio local, peso mayor a usuarios verificados. Combinar con el dato objetivo de
  check-ins.
- **Sin reseñas de texto libre al principio:** exigen moderación (DSA) y generan
  conflictos con los locales; con etiquetas se obtiene casi todo el valor. Más adelante,
  comentarios cortos moderados y respuesta del local.
- **Para el local:** el resultado le llega en su panel (resumen gratis; detalle e
  histórico en Estadísticas Pro). Encaja con la idea 2 ("estado en directo"): el local
  informa y la gente lo valida.
- En nativo, aviso suave "¿Cómo está Kapital?" 30 min después del check-in para
  conseguir votos.

---

## 6. Guía de usuario y guía de locales (públicas, sin login)

- Nuevas páginas dentro de la web pública que ya existe sin login (`PublicLayout`, rutas
  `/legal/*` en `src/app/router.tsx:281`): **`/guia`** (usuarios) y **`/guia/locales`**
  (negocios), enlazadas desde Bienvenida, el índice legal, Perfil y el Panel de locales.
- **Guía de usuario:** qué es la app; mapa y estadísticas en directo; Esta Noche Voy / Aquí
  Ahora y check-in; swipe, match y chat; semáforo y modo discreto; verificaciones (edad,
  foto, identidad); seguridad (bloquear, reportar, SOS Lite); eventos y Vibe Check; objetos
  perdidos; temas; qué es gratis y qué da Pase / Pase VIP / Pase de una noche / Chispa /
  Foco / Mensaje directo; privacidad (siempre agregado, nunca ubicación exacta); preguntas
  frecuentes (cómo entrar, cómo borrar la cuenta…).
- **Guía de locales:** cómo reclamar o recibir la invitación del local; qué incluye gratis;
  niveles Destacado / Plus / Top y Estadísticas Pro con lo que da cada uno; Flash Alerts y
  sus reglas (alcohol, consentimiento); eventos oficiales; reglas de transparencia ("siempre
  etiquetado, nunca altera los datos"); contacto comercial.
- Todos los textos en `es.json`/`en.json`; precios solo si están activos (mientras sean de
  prueba se muestra "Próximamente" o "Consultar", sin inventar importes definitivos).
- Se actualiza la guía en cada bloque que añada funciones (punto del checklist "Hecho cuando").

---

## 7. Garantía de no romper lo existente (regresión)

Línea base hoy: 48 ficheros de tests con Vitest + Testing Library (`npm run check`) y
scripts de red/billing/RLS por bloque (`scripts/block*-*.mjs`). No hay pruebas de extremo
a extremo en navegador.

En cada bloque nuevo:

1. **Antes de tocar nada:** `npm run check` y scripts existentes en verde → se guarda la
   línea base (nº de tests, resultado) en `docs/PROGRESS.md`.
2. **Suite E2E de regresión con Playwright** (está en la lista permitida del PRD 3.5;
   Chromium ya está en el entorno). Primer paso del siguiente bloque, antes de cualquier
   cambio funcional, cubriendo los recorridos críticos con mocks y en móvil + escritorio:
   alta completa, login SMS, cerrar sesión, mapa → ficha → check-in, Esta Noche y swipe,
   match y chat, Premium/paywall, panel de locales (claim, ficha, patrocinio), admin con MFA
   simulado, web pública/legal sin login. Se ejecuta en CI y se añade a `npm run check`
   (o `npm run test:e2e`).
3. **Tests nuevos para lo nuevo:** unitarios (adaptadores, hooks, pantallas) + E2E del
   recorrido nuevo + RLS/RPC por rol (anónimo, usuario, venue_manager, admin) para cada
   migración.
4. **Cambios aditivos y detrás de flag:** cada función nueva con su `feature flag` apagada
   por defecto (p. ej. `email_login_enabled`, `live_status_enabled`); el comportamiento
   actual sigue siendo el camino por defecto hasta validar en producción. Migraciones solo
   aditivas (nuevas tablas/columnas), sin borrar ni renombrar nada.
5. **Validación en el despliegue de Vercel** con cuentas `is_test`, Security Advisors,
   `npm audit` y auditoría de red antes de pedir OK.

---

## Propuesta de orden (cada uno como bloque con su plan, tests y puerta de seguridad)

0. **Red de seguridad:** suite E2E de regresión con Playwright + línea base (sin cambios
   funcionales).
1. Login de vuelta con código por email (detrás de flag) + **guías públicas** de usuario y
   de locales.
2. "Cómo está ahora" (evolución del Vibe Check) + música declarada por el local.
3. Partners y contratos: `venue_accounts`, `venue_entitlements`, invitaciones admin→local,
   aceptación de Condiciones para Locales.
4. Fotos propias + estado en directo del local + ficha enriquecida + informe ROI.
5. Reservas sin pago y guest list con QR.
   Fuera de este plan: **Face ID / huella** se hace dentro del **Bloque 11** (app nativa, aún
   sin implementar), junto con Capacitor; se anota allí como requisito. Google/Apple, opcional
   y con tu permiso, también en ese bloque si se decide.

Archivos clave si se aprueba: `src/adapters/supabase/{client,onboarding,business,admin}.ts`,
`src/features/venue-panel/*`, `src/features/admin/screens/AdminVenuesScreen.tsx`,
`src/features/places/components/PlaceCover.tsx`, nuevas migraciones en `supabase/migrations/`,
textos en `src/i18n/locales/{es,en}.json`.

## Verificación (por bloque, cuando se apruebe)

`npm run check`, tests de RLS por rol (anónimo, usuario, venue_manager, admin), Security
Advisors de Supabase, `npm audit`, prueba en el despliegue de Vercel con un local de prueba
`is_test` y actualización de `docs/PROGRESS.md` y `docs/SECURITY.md`.
