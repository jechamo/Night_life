# PRD – NIGHTLIFE CONNECT (nombre provisional)
**Ocio nocturno + ligar, en tiempo real, con seguridad, cumplimiento normativo y un diseño que no parece "otra web más"**
Versión 2.3 (MVP) · Octubre 2026 · Desarrollo: Lovable · Destino: Web app (PWA) preparada para iOS y Android

---

## 1. ROL DEL ASISTENTE (META PROMPTING)

Eres un desarrollador de software y diseñador de producto experto de clase mundial en React, TypeScript, Tailwind CSS, ShadCN, Supabase y el entorno nativo de Lovable. Dominas el motion design moderno (Motion, View Transitions, Rive), Mapbox, Stripe, las PWA y Capacitor. También conoces la normativa europea y española: RGPD, LOPDGDD, LSSI-CE, DSA, Reglamento de IA y consumo.

Construye con máxima precisión y adherencia estricta a todas las restricciones de diseño, técnicas y legales. Aplica Privacidad por Diseño y por Defecto. Sigue el Plan de Construcción (sección 11) **bloque a bloque y pidiendo OK al final de cada uno**. Nunca añadas scripts, SDKs, librerías o servicios de terceros no listados sin pedir permiso.

---

## 2. DESCRIPCIÓN GENERAL Y VISIÓN

### 2.1. Resumen
App para salir de noche y ligar. Muestra en tiempo real dónde hay gente, cuánta, de qué edad y con qué ambiente, en locales y eventos. Permite conocer gente antes de salir ("Esta Noche Voy") y durante la noche ("Aquí Ahora"). Las cuentas son de adultos verificados y la app incluye seguridad activa.

**Slogan:** "Tu noche, segura y conectada."

### 2.2. Usuarios objetivo
- **Usuarios:** mayores de 18 años sin límite superior. Público objetivo de 18 a 60 años, con gustos muy distintos.
- **Locales:** discotecas, clubs, pubs, bares, garitos, lounges, terrazas y beach clubs.
- **Organizadores:** conciertos, fiestas y eventos.

### 2.3. Problema que resuelve
- No saber dónde hay ambiente ni con qué gente.
- Apps de citas con perfiles falsos y desconectadas del plan real de la noche.
- Inseguridad.
- Falta de visibilidad para locales y eventos pequeños.

### 2.4. Principios (CRÍTICO)
- **Útil desde el día 1:** con cero usuarios y cero locales que paguen. Locales importados y eventos importados o creados por usuarios.
- **Datos honestos:** nunca se simulan datos de afluencia para usuarios reales. Los datos de prueba solo los ven las cuentas de prueba (ver 6.14).
- **Gratis al máximo:** el pago aporta comodidad y ventaja, nunca funciones básicas, verificaciones ni seguridad.
- **Todo configurable desde el admin:** parámetros y feature flags, sin redesplegar.
- **Pagos integrados pero desactivados:** listos para activarse con un interruptor (ver 6.13).
- **Web primero, nativa después:** la app se lanza como web/PWA. La arquitectura queda preparada para empaquetarla como app de iOS y Android con Capacitor sin rehacer código (ver 3.3).

### 2.5. Objetivo principal (MVP)
Ciclo completo en web/PWA:
- Alta con teléfono.
- Firma de los documentos legales.
- Explorar el mapa y los eventos con estadísticas en vivo.
- Verificar la mayoría de edad para desbloquear las funciones de ligar.
- "Esta Noche Voy" o check-in.
- Matches y chat con una experiencia muy dinámica.

Además: eventos de usuarios, panel de locales, patrocinios, 5 temas visuales, pagos en modo prueba, herramientas de testing y cumplimiento normativo completo.

---

## 3. STACK Y RESTRICCIONES TÉCNICAS

### 3.1. Stack

**Frontend**
- React + TypeScript + Vite (SPA) + Tailwind CSS (tokens con variables CSS) + ShadCN.
- Mobile-First.
- PWA instalable: manifest, iconos y service worker solo para el "shell" de la app. Nunca se cachean datos personales ni sensibles.

**Movimiento**
- Motion (antes Framer Motion).
- View Transitions API con fallback.
- Rive (preferente) o Lottie.
- Mapbox GL JS con el estilo Standard en modo noche.

**Backend: Supabase**
- **Organización:** "Chaplications trade".
- **Proyecto:** `Nightlife_Connect` (ref `ocrpfeqfqzchhrghqcfb`).
- **Región:** eu-west-1 (Irlanda, UE).
- **PostgreSQL 17:** usar los servicios PostgreSQL + PostGIS, Auth (teléfono + OTP), Storage, Edge Functions, Realtime y pg_cron.
- Conectar Lovable a este proyecto mediante su integración nativa de Supabase. No crear otro proyecto.

**Pagos**
- Stripe, integrado en modo test y desactivado para el público (6.13).

### 3.2. Directrices técnicas obligatorias
- **Recursos externos:**
  - Fuentes e iconos autoalojados.
  - Prohibido Google Fonts o cualquier CDN externo.
  - Solo se permiten peticiones al propio dominio y a los terceros de 6.12 B.
  - Si en producción queda algún script del editor de Lovable, debe eliminarse.
- **Prohibida la grabación de sesiones y la captura de pulsaciones.** La analítica es opcional, con consentimiento y sin grabación.
- **Logs limpios:** sin mensajes, tokens, ubicaciones, preferencias, verificaciones ni datos de pago.
- **Secretos:** en Supabase Secrets y usados desde Edge Functions. En el frontend solo pueden estar el token público de Mapbox y la clave publicable de Stripe.
- **Roles:** en `user_roles` (user, tester, venue_manager, admin), comprobados con una función segura en las políticas RLS.
- **Validación en servidor:** la lógica sensible se valida siempre en Edge Functions o triggers. Esto incluye:
  - Límites.
  - 3 strikes.
  - Eventos.
  - Patrocinios.
  - Verificaciones (webhook de Yoti).
  - Pagos (webhook de Stripe).
  - Derechos de acceso (entitlements).
- **Feature flags:** las funciones activables se leen siempre a través de un único servicio (`useFeatureFlag` en el frontend y `feature_enabled()` en SQL), nunca con condiciones dispersas.
- **Rendimiento:**
  - Animar solo transform y opacity.
  - Objetivo de 60 fps.
  - Carga diferida de Mapbox y Rive.
  - Imágenes en WebP o AVIF.

### 3.3. Preparación para app nativa (iOS/Android)
- **Tecnología elegida: Capacitor**, el sucesor moderno de Cordova. Empaqueta esta misma web en apps nativas y es compatible con la mayoría de plugins de Cordova, así que cualquier plugin de Cordova necesario podrá usarse.
- **No se empaqueta en el MVP**, pero el código debe cumplir estas reglas desde el Bloque 1:
  1. **Capa de plataforma** (`src/platform/`): todo acceso a funciones del dispositivo pasa por servicios con interfaz común e implementación web ahora y nativa después:
     - Ubicación.
     - Cámara.
     - Vibración.
     - Almacenamiento seguro.
     - Compartir.
     - Identificador de dispositivo.
     - Biometría.
     - Notificaciones.
     - Enlaces profundos.
     - Navegador interno (para Yoti y Stripe).
     - Descargas de archivos (exportar JSON y PDF).
     - Pagos (web vs. tiendas).

     Ningún componente llama directamente a APIs del navegador para estas funciones.
  2. **SPA pura**, sin renderizado en servidor. Rutas compatibles con WebView.
  3. **Diseño táctil:**
     - Zonas seguras (`safe-area-inset`).
     - Altura `100dvh`.
     - Nada que dependa de hover.
     - Objetivos de 44 px o más.
     - Gestos con alternativa en botones.
  4. **Sesión de Supabase:** con un adaptador de almacenamiento intercambiable (web ahora, almacenamiento seguro nativo después).
  5. **Flujos externos** (Yoti, Stripe, Spotify) mediante redirección y "return URL" configurable, para poder usar enlaces profundos en la app nativa.
  6. **Pagos desacoplados del proveedor** mediante entitlements (6.13). Así se podrán añadir los pagos de Apple y Google sin tocar la lógica de la app.
- La guía para pasar a nativa está en el Anexo B.

### 3.4. Arquitectura, patrones y buenas prácticas

**Arquitectura**
- **Organización por funcionalidades:** `src/features/<funcionalidad>/` (components, hooks, services, types, tests).
  - Lo común va en `src/shared/`.
  - La plataforma, en `src/platform/`.
  - Los textos, en `src/i18n/`.
- **Capas con dependencias en un solo sentido:** UI (presentación) → hooks (estado y orquestación) → servicios (datos y Edge Functions) → adaptadores (Supabase, plataforma, proveedores). **La UI nunca llama a Supabase directamente.**
- **Puertos y adaptadores (arquitectura hexagonal ligera)** para todo lo externo:
  - Plataforma.
  - Pagos.
  - Verificación de edad.
  - Verificación facial.
  - Mapas.
  - Email.
  - Fuentes de eventos.

  Cambiar de proveedor equivale a escribir un adaptador nuevo.
- **Reglas de negocio como funciones puras y testeables**, sin depender de la UI ni de la base de datos:
  - Compatibilidad.
  - Prioridad del swipe.
  - Umbrales de estadísticas.
  - Ciclo de vida de eventos.
  - Reglas de patrocinio.
  - Límites de likes.

  Las que conceden o deniegan permisos se aplican siempre también en servidor.

**Patrones de diseño**

| Patrón | Dónde se usa |
|---|---|
| Adapter | Capa de plataforma y proveedores externos |
| Strategy | Proveedor de pago, proveedor de verificación, tema visual |
| Factory | Selección del proveedor según flags y entorno |
| Repository / Service | Acceso a datos por funcionalidad |
| Facade | Un cliente único por funcionalidad hacia las Edge Functions |
| Observer (pub/sub) | Realtime, encapsulado en hooks que actualizan la caché |
| State machine | Onboarding, verificación, ciclo de vida de eventos, suscripción y moderación. Estados explícitos con uniones discriminadas; transiciones validadas en servidor |
| Guard / Policy | Rutas y acciones protegidas por verificación, rol y entitlements |
| Feature flag | Sección 6.13 |
| Idempotency key | Webhooks y pagos |
| Transactional outbox | Emails y efectos externos: se encolan en una tabla dentro de la misma transacción y un proceso los envía con reintentos |

**Principios y prácticas**
- **Principios:** SOLID, KISS, YAGNI y DRY con criterio. Composición sobre herencia. Separación de responsabilidades. Única fuente de verdad (la base de datos y los entitlements).
- **TypeScript estricto:**
  - Sin `any`.
  - Tipos de la base de datos generados desde Supabase.
  - Esquemas Zod compartidos entre el cliente y las Edge Functions.
- **Datos:** TanStack Query para la caché y la invalidación. Realtime actualiza esa caché, nunca un estado paralelo.
- **Errores:**
  - Error Boundaries por pantalla.
  - Servicios que devuelven resultados tipados (éxito o error).
  - Mensajes al usuario genéricos y traducidos.
- **i18n desde el día 1:** ningún texto fijo en los componentes (ES/EN).
- **Componentes:**
  - Pequeños (orientativo: menos de 250 líneas).
  - Nombres descriptivos.
  - Comentarios que expliquen el "por qué".
- **Base de datos:**
  - Todo cambio mediante migraciones versionadas. Nunca cambios a mano en producción.
  - Nombres en snake_case.
  - Claves foráneas con el ON DELETE adecuado para el derecho de supresión.
  - Índices.
  - CHECK y enums.
  - RLS en todas las tablas.
  - Funciones SECURITY DEFINER con `search_path` fijo.
  - Fechas en UTC.
- **Tests:**
  - Unitarios (Vitest) de las reglas de negocio puras.
  - Tests de RLS por rol.
  - E2E (Playwright, si el entorno lo permite) de los flujos críticos: alta, verificación, match, chat, compra en modo test y borrado de cuenta.
- **Calidad:** ESLint + Prettier. Build sin advertencias.
- **Documentación viva:**
  - `docs/ARCHITECTURE.md`.
  - `docs/API.md`: inventario de Edge Functions y RPC.
  - `docs/SECURITY.md`: modelo de amenazas y controles.
  - `docs/adr/`: registro de decisiones de arquitectura.

### 3.5. Dependencias permitidas
Solo se pueden usar estas. Cualquier otra requiere permiso, justificación y comprobar que el paquete existe, está mantenido y es el oficial.

**Base**
- React, React Router, Vite, TypeScript.

**Interfaz**
- Tailwind CSS, ShadCN/Radix UI, lucide-react.
- Motion.
- Rive (@rive-app/react-canvas) o lottie-react.

**Datos y formularios**
- TanStack Query.
- @supabase/supabase-js.
- Zod, React Hook Form.
- date-fns.
- i18next / react-i18next.

**Funcionalidades específicas**
- mapbox-gl.
- DOMPurify.
- @vladmandic/face-api (fork mantenido de Face-API.js; sustituye al original, que está abandonado).
- vite-plugin-pwa.
- stripe (solo en Edge Functions).

**Testing y calidad**
- Vitest, Testing Library, Playwright.
- ESLint, Prettier.

**Paso a nativo**
- Paquetes oficiales @capacitor/*.

---

## 4. ARQUITECTURA DE DATOS Y FLUJO

### 4.1. Tablas principales (campos clave)

**Usuarios y verificación**
- **profiles:** nombre, fecha_nacimiento_declarada, género, bio, fotos, Anthem, semáforo, modo_discreto, tema_visual, baneado, ultima_actividad, is_test.
- **verification_status:**
  - phone_verified.
  - age_verified, age_verification_method, age_threshold_used.
  - photo_verified.
  - identity_verified.
  - verification_provider, provider_session_id.
  - verification_date.
  - reverification_required.
  - **Nunca se guardan:** DNI, imágenes de documentos, selfies, vídeos ni descriptores faciales.
- **user_preferences (art. 9):** me_interesa, edad_min, edad_max.
- **user_roles**.
- **ban_identifiers:** hashes de teléfono y dispositivo.

**Legal**
- **legal_documents**.
- **consent_records:** inmutable.
- **data_requests**.
- **gdpr_audit_log**.

**Lugares y eventos**
- **venues**.
- **venue_claims**.
- **events:** estado no_confirmado/confirmado/oficial/eliminado.
- **event_confirmations**.
- **event_reports**.

**Actividad**
- **attendance:** sin posición GPS en bruto.
- **place_stats**.
- **ratings**.
- **lost_and_found**.

**Social**
- **likes**.
- **matches:** incluye lugar_del_match.
- **messages**.
- **blocks**.

**Moderación**
- **reports**.
- **moderation_decisions**.
- **appeals**.
- **bans**.
- **emergency_contacts**.

**Pagos y monetización (6.13)**
- **plans:** código, nombre, tipo (suscripción/pago único/B2B), precio, moneda, intervalo, stripe_price_id_test, stripe_price_id_live, activo.
- **entitlements:** user_id, ventaja o plan, origen (admin/promo/tester/stripe/apple/google), inicio, fin, estado. **Es la única fuente de verdad sobre qué puede hacer cada usuario.**
- **subscriptions:** proveedor, IDs del proveedor, estado, periodo_actual_fin, cancelar_al_final, desistimiento_solicitado_en.
- **payment_events:** ID del evento del proveedor (idempotencia), tipo, procesado_en. Sin datos de tarjeta.
- **promo_codes:** código, ventaja, duración, usos máximos, caducidad.
- **sponsorships**.
- **flash_alerts**.

**Configuración**
- **app_settings:** parámetros y feature flags (6.13 y 6.14), con historial de cambios en auditoría.

### 4.2. Seguridad por filas (RLS)

**Privado (solo el propietario)**
- Preferencias.
- Verificación (los demás solo ven los badges).
- Likes enviados.
- Bloqueos.
- Reportes propios.
- Contactos de emergencia.
- Consentimientos.
- Entitlements.
- Suscripción.
- Mensajes y matches (solo los participantes).

**Datos de prueba (`is_test`)**
- Solo los ven las cuentas con rol `tester` o `admin`. Nunca los usuarios reales.

**Usuarios con edad verificada**
- Perfiles con badges.
- Listas "Van/Aquí", excluyendo el modo discreto y a los bloqueados.

**Todos los usuarios registrados**
- Locales, eventos, estadísticas, Vibe Check agregado y objetos perdidos (solo lectura).

**venue_manager**
- Solo sus lugares.

**Admin**
- Moderación, verificaciones manuales, claims, patrocinios, pagos, derechos, auditoría y configuración.

### 4.3. Privacidad de las estadísticas
- **Número de personas:** siempre visible. Por debajo de 5 se muestra "Menos de 5".
- **Edad media, ratio y % en verde:** solo con 5 personas o más.
- **Modo discreto:** cuenta en las estadísticas, pero no aparece en las listas.
- **Ubicación:** nunca se muestra la ubicación exacta de una persona.

---

## 5. FLUJO DE USUARIO DETALLADO

### 5.1. Pantallas

**Onboarding**
1. Bienvenida.
2. Fecha de nacimiento.
3. Documentos legales y firma.
4. Teléfono + OTP.
5. Consentimientos.
6. Perfil.
7. Preferencias.
8. Elegir tema.

**App (Bottom Tab Bar)**
- 🗺️ Descubre.
- 🎉 Esta Noche.
- 💬 Chats.
- 👤 Perfil.

**Secundarias**
- Centro de verificación.
- Fichas de lugar y de evento.
- Crear evento.
- Filtros y resultados.
- Perfil de otra persona.
- Chat.
- Pantalla de match.
- **Premium y paywall.**
- **Checkout.**
- **Mi suscripción:** gestionar, cancelar, desistir y facturas.
- **Canjear código.**
- Privacidad y datos.
- Documentos firmados.
- Moderación y apelaciones.
- Temas.
- Cuenta suspendida.

**Web pública, sin login**
- Aviso legal.
- Términos.
- Privacidad.
- Cookies.
- Terceros.
- Eliminar cuenta y ejercer derechos.
- Contenido ilegal.
- Contacto.
- Condiciones de Premium (se publican al activar los pagos).

**Paneles**
- Locales.
- Admin, incluidas las secciones "Pagos", "Feature flags" y "Herramientas de prueba".

### 5.2. Onboarding y verificación (orden obligatorio)

1. **Bienvenida:** animada.
2. **Fecha de nacimiento (pantalla neutra):** si es menor de 18, no se crea la cuenta y no se guardan datos.
3. **Documentos legales y firma:** ver 6.1.
4. **Teléfono + OTP:**
   - Una cuenta por teléfono.
   - Se bloquea el alta si el hash del teléfono o del dispositivo está baneado.
   - Email opcional y verificado.
   - Límites antifraude de SMS.
5. **Consentimientos específicos:** ver 6.1.
6. **Perfil:** nombre, género, fotos (2-5), bio y Anthem opcional.
7. **Preferencias:** si el usuario da el consentimiento de orientación.
8. **Elegir tema visual.**
9. **Entrada a la app.** Sin verificar, el usuario puede explorar el mapa, los eventos, las estadísticas y el buscador.
10. **Verificación de mayoría de edad, obligatoria para ligar y contactar:** se pide al intentar por primera vez:
    - Ver perfiles.
    - Dar like.
    - Chatear.
    - Marcar "Voy" o hacer check-in visible.
    - Crear eventos.
    - Recibir promociones de alcohol.

    Ver 6.2.
11. **Foto verificada e Identidad verificada (opcionales):** se ofrecen después.

### 5.3. Navegación principal

**🗺️ DESCUBRE**
- **Mapa 3D nocturno a pantalla completa.**
- **Buscador flotante de cristal.**
- **Selector:** Todo / Locales / Eventos.
- **Chips con color de acento.**
- **Pines** con badge de personas y edad media, halo "en directo" y etiquetas "Patrocinado" y "No confirmado".
- **Heatmap** en tiempo real.
- **Al tocar un pin:** la cámara vuela al lugar y se abre la ficha (bottom sheet con física de muelle). La ficha incluye:
  - **Bloque "Quién hay"** con números que cuentan en directo.
  - Fotos, horario, precio y dirección.
  - Vibe Check.
  - Acciones: "Esta Noche Voy", "Estoy Aquí", "Ver perfiles", "Votar" y "Objetos perdidos".
  - En los eventos: "Confirmo que existe" y "Reportar".
- **Botón "+ Crear evento".**

**🎉 ESTA NOCHE**
- **Selector:** "Aquí Ahora" / "Esta Noche Voy".
- Lista de lugares con transición de elemento compartido.
- **Swipe de perfiles:** ver 6.6.1.
- **Prioridad de aparición:**
  1. Mismo lugar ahora.
  2. Mismo lugar esta noche.
  3. Lugares cercanos.
  4. Dentro de cada grupo, primero los perfiles con foto verificada.
- **Filtro gratuito:** "Solo verificados".

**💬 CHATS**
- Lista de matches.
- Chat en tiempo real con indicador de escritura y leído.
- Eliminar match, bloquear y reportar.

**👤 PERFIL**
- Perfil, preferencias, Anthem, semáforo y modo discreto.
- Centro de verificación.
- Temas.
- Ajustes (incluido "Reducir movimiento").
- **Premium.** Su comportamiento depende de los flags (6.13).
- Privacidad y datos.
- Legal.
- Contacto.

---

## 6. FUNCIONALIDADES CLAVE

### 6.1. Documentos legales, consentimientos y firma (CRÍTICO)

**Documentos**
Públicos, versionados, en ES/EN, con marcadores [DATOS EMPRESA]. Deben revisarse por un abogado.
1. Aviso Legal (incluye el punto de contacto DSA).
2. Términos y Condiciones.
3. Normas de la Comunidad.
4. Política de Privacidad.
5. Política de Cookies y Tecnologías Similares.
6. Transparencia de Clasificación y Patrocinados.
7. Condiciones para Locales y Organizadores.
8. Condiciones de Patrocinio.
9. **Condiciones de Premium:** se redactan ya y se cargan como inactivas. Se publican al activar los pagos.
10. Lista pública de terceros.

**Información por capas**
Recuadro de información básica en cada formulario, con enlace a la política completa.

**Pantalla de firma (antes del alta)**
- Casillas no premarcadas:
  - (a) "Confirmo que soy mayor de 18 años".
  - (b) "Acepto los Términos y Condiciones y las Normas".
  - (c) "He leído la Política de Privacidad".
- Botón **"Firmo y acepto"**.
- Opción "No acepto".

**Consentimientos y avisos**

| Tratamiento | Cuándo | Base legal | Si no se acepta |
|---|---|---|---|
| Verificación de edad (Yoti) | Al desbloquear las funciones de ligar | Protección de menores e interés legítimo (validar con abogado). Pantalla informativa + aviso de IA | Solo exploración |
| Foto verificada | Opcional | Consentimiento explícito (art. 9.2.a), con firma | Sin badge |
| Identidad verificada (Yoti) | Opcional | Consentimiento explícito | Sin badge |
| Orientación y preferencias | Onboarding | Consentimiento explícito (art. 9.2.a), con firma | Sin matches |
| Ubicación precisa | Onboarding | Consentimiento | Explora eligiendo ciudad |
| Ubicación en segundo plano | Al activar el auto check-in (nativo) | Consentimiento independiente | Check-in manual |
| Comunicaciones comerciales y Flash Alerts | Onboarding o Ajustes | LSSI-CE art. 21 | Sin promociones |
| Push (V2) | Al activarlas | Consentimiento + permiso del sistema operativo | Sin push |
| Spotify | Al conectarlo | Consentimiento | Sin Anthem |
| Analítica | Onboarding | Consentimiento | Sin analítica |

**Evidencias, PDF y reaceptación**
- `consent_records` inmutable.
- PDF firmado disponible en la app y por email.
- Revocación tan fácil como el consentimiento.
- Reaceptación obligatoria al cambiar la versión de un documento.

### 6.2. Verificaciones: edad, foto e identidad

**Principio:** comprobar lo necesario sin conocer la identidad. El servicio solo recibe resultados booleanos.

**Nivel 0 – Teléfono (obligatorio)**
- OTP en el alta.

**Nivel 1 – Mayoría de edad (obligatoria para ligar) con Yoti Age Verification**
- **Método principal:** estimación facial con detección de vida pasiva. Umbral configurable, 21 por defecto.
- **Si no es concluyente:** documento con selfie, Digital ID u otros métodos de Yoti en el mismo flujo.
- **Resultado:** llega por webhook firmado a una Edge Function. Se guardan los booleanos, el método, el umbral, la fecha y el `provider_session_id`.
- **Aviso previo de IA**, con opción de revisión humana o de otro método.
- **Reporte "posible menor":** suspensión cautelar y nueva verificación por documento.
- **Modo:** `verification_mode` = sandbox (pruebas) / live. Ver 6.14.

**Nivel 2 – ✓ Foto verificada (opcional, incentivada)**
- Selfie en vivo con gesto, comparada con las fotos.
- Face-API.js en el dispositivo + validación en servidor, o comparación facial de Yoti si el contrato la incluye (configurable).
  - Similitud superior al 85% → badge.
  - Entre el 60% y el 85% → revisión manual.
- Incentivos: badge, prioridad en el swipe y filtro "Solo verificados".
- El badge se revalida si cambia la foto principal.
- Imágenes borradas al terminar. Sin descriptores.
- Desactivada la estimación de edad y de género de Face-API.js.

**Nivel 3 – ✓ Identidad verificada (opcional)**
- Documento y selfie mediante Yoti.
- Solo se guarda el booleano. Nunca se muestran el nombre real, el DNI ni la fecha de nacimiento.

**Regla para todos los niveles**
- Revisión humana de las decisiones automáticas negativas.
- Prohibido inferir datos sensibles a partir de imágenes.
- Proveedores en la UE o en un país con adecuación (Yoti: Reino Unido).

### 6.3. Check-in y "Esta Noche Voy"

**"Esta Noche Voy"**
- Desde las 18:00.
- Caduca a las 06:00.

**Check-in**
- **Manual** en la web: a menos de 150 m del lugar.
- **Automático** en la app nativa: en un radio de 50 m, con consentimiento de segundo plano.
- Dura 2 horas y se renueva si el usuario sigue allí. Solo uno activo por usuario.
- Solo se guarda "lugar y hora".

### 6.4. Estadísticas en vivo
- Se recalculan cada 1-2 minutos.
- Realtime y números animados.
- Se aplican los umbrales de 4.3.

### 6.5. Buscador y filtros (todo gratis)
- **Filtros:**
  - Texto.
  - Tipo.
  - Cantidad de personas.
  - Edad media (de 18 a 60+).
  - % en verde.
  - Ratio.
  - Distancia.
  - Precio.
  - Asistencia.
  - Abierto ahora.
  - Fecha.
- **Orden:** distancia, más o menos gente, edad media o mejor valorado.
- Vista de lista o de mapa.
- **Patrocinados:** solo si cumplen los filtros, como máximo 2 arriba y 1 de cada 5, siempre etiquetados.

### 6.6. Ligar
- **Semáforo:** 🟢 abierto a ligar · 🟡 solo amistad · 🔴 invisible en los swipes.
- **Compatibilidad en ambos sentidos.**
- **Like mutuo** → match → chat.
- **Límite diario de likes gratis:** configurable (5 por defecto). Ilimitados con el entitlement `unlimited_likes`.
- **Bloquear:** bidireccional.
- **Eliminar match:** se elimina para ambos.

#### 6.6.1. Experiencia de swipe y match (pieza estrella)

**Pila de tarjetas con profundidad**
- La siguiente tarjeta asoma debajo, a escala y con desenfoque.
- Las fotos se cambian tocando los laterales, con indicador de progreso.

**Arrastre con física real**
- La tarjeta se inclina según el dedo.
- Al arrastrar aparecen los sellos "ME GUSTA" / "PASO" con la opacidad proporcional.
- Si la velocidad es suficiente, la tarjeta sale despedida. Si no, vuelve con efecto elástico.
- Vibración al cruzar el umbral (en nativo).
- Siempre hay botones equivalentes, por accesibilidad.

**Señales de contexto**
- Badge "Aquí Ahora" brillante si la persona está en el mismo lugar.
- Chip del Anthem con mini ecualizador animado.
- Chip "Lugar en común".

**Match en tiempo real**
- Se detecta en servidor y se envía por Realtime a ambos usuarios. Si los dos están conectados, ven la animación a la vez.

**Pantalla de match**
- Las dos fotos vuelan y se juntan, con partículas del color del tema.
- Título contextual: "¡Match en Kapital!" si están en el mismo sitio, o "¡Los dos vais a Kapital esta noche!".
- Los dos Anthems como chips reproducibles.
- **Rompehielos sugeridos por reglas, sin IA:** basados en el lugar o el artista en común. El usuario los puede editar.
- Botones: "Escribir ahora" y "Seguir mirando".

**Vida en la pantalla**
- Aviso discreto en directo: "3 personas nuevas en Kapital".
- Estado vacío animado: "Has visto a todos los de aquí" + lugares cercanos con gente.

**Premium**
- "Deshacer" con animación de rebobinado.
- Pantalla de "Quién te ha dado like" con desenfoque si no tiene el entitlement y el paywall está visible.

**Reducir movimiento**
- Si el sistema lo pide, todo se sustituye por fundidos.

### 6.7. Eventos creados por usuarios
- **Quién:** usuarios con edad verificada, como máximo 2 eventos al día.
- **Dónde:** solo lugares públicos.
- **Antiduplicados.**
- **Ciclo de vida:**
  - "No confirmado" → "Confirmado" con 3 confirmaciones distintas en 24 horas. Si no las consigue, se borra.
  - Al terminar, se archiva.
- **Moderación:** 3 reportes de "falso" → se oculta y pasa a revisión.
- **Locales:** pueden reclamar eventos y crear eventos "Oficiales".
- **Importados:** entran como "Confirmado".

### 6.8. Vibe Check y objetos perdidos
- **Vibe Check:** requiere check-in activo, el voto se puede cambiar y se muestra agregado.
- **Objetos perdidos:**
  - Requiere check-in en las últimas 12 horas.
  - Publicar, responder, editar y borrar.
  - Máximo 280 caracteres.
  - Se borra a las 48 horas.

### 6.9. Seguridad y moderación (DSA)
- **Reportes** (incluido "posible menor").
- **3 strikes:** 3 reportes válidos en 6 horas → suspensión y revisión humana, con bans por hash.
- **Decisiones explicadas y apelaciones** revisadas por humanos.
- **Formulario público** para notificar contenido ilegal.
- **Aviso a las autoridades** ante riesgo grave.
- **SOS Lite.**

### 6.10. Paneles

**Locales (gratis)**
- Reclamar ficha, editarla, eventos oficiales, estadísticas agregadas y solicitar patrocinio.

**Admin**
- Dashboard.
- Verificaciones.
- Moderación.
- Bans.
- Locales y claims.
- Eventos.
- Patrocinios.
- **Pagos:** planes, suscripciones, entitlements, códigos promocionales y eventos de pago.
- **Feature flags.**
- **Herramientas de prueba.**
- Derechos.
- Documentos legales.
- Configuración.
- Auditoría.

### 6.11. Monetización (modelo)

**Usuarios**
- Todo lo anterior es gratis, incluidas todas las verificaciones.
- **Premium (entitlements):**
  - `unlimited_likes`.
  - `see_likes`.
  - Todos los filtros siguen gratis (decisión de monetización aprobada).
  - `incognito`.
  - `priority_likes`.
  - `travel_mode` (integración pendiente del bloque 11).
  - `no_sponsored_cards`.
  - `undo`.
  - `premium_themes`.
- **Mensaje directo de pago sin match** (`paid_dm`, pago único). Respeta el semáforo rojo.
- **Créditos:** Chispa (`spark`) con aviso anónimo y like; Foco (`spotlight`) con
  prioridad 30 minutos en un local con check-in o la ciudad del perfil; mensaje
  directo (`paid_dm`). Consumo transaccional en servidor. Chispas 1/5/15 y Pase
  mensual/trimestral/anual en el catálogo web TEST del cierre autorizado de 8/9.

**Locales**
- Aparecer y gestionar la ficha es gratis.
- **Patrocinio en 3 niveles** [PRECIOS A DEFINIR]:
  - **Destacado.**
  - **Destacado Plus.**
  - **Top.**
- **Autoservicio web Stripe TEST** (autorizado el 05/10/2026): patrocinios de
  30 días desde el panel, detrás de `sponsorship_self_service_enabled`. Importes
  provisionales: Destacado 29 €, Plus 49 €, Top 79 €. El webhook activa tras pago
  confirmado; cupos por ciudad y reserva pendiente de 24 h, sin renovación automática.
- Destacado etiqueta el pin y admite tarjetas; Plus añade prioridad en listados;
  Top precede a Plus y habilita Flash. El Pase elimina tarjetas del swipe, máximo 1/10.
- **Estadísticas Pro:** 19,99 €/mes de prueba por local; suscripción independiente,
  agregados por hora/edad/semáforo y comparativa anónima de zona. Estadísticas básicas
  gratis. La gestión del pago corresponde a su titular mediante Portal de Stripe.
- **Reglas fijas:** etiqueta siempre visible, nunca altera los datos, solo aparece si cumple los filtros y los huecos son limitados.
- **Flash Alerts:** dentro de la app, con consentimiento y edad verificada. Alcohol según la normativa autonómica.

### 6.12. Cumplimiento normativo

**A) Inventario de datos**

| Categoría | Finalidad | Base legal | Conservación |
|---|---|---|---|
| Teléfono (y email opcional) | Acceso y antifraude | Contrato e interés legítimo | Mientras la cuenta esté activa |
| Fecha de nacimiento declarada | Edad visible, estadísticas y compatibilidad | Contrato | Mientras la cuenta esté activa |
| Resultados de verificación | 18+, seguridad y acreditación | Protección de menores, interés legítimo y consentimiento | Mientras la cuenta esté activa + plazo legal, bloqueados |
| Imagen o documento de verificación | Verificar | Según el nivel | **No se conserva** |
| Perfil | Mostrar el perfil | Contrato | Mientras la cuenta esté activa |
| Preferencias y orientación | Compatibilidad | Consentimiento explícito | Hasta revocación o borrado |
| Check-ins | Mapa, estadísticas y ligar | Consentimiento y contrato | 30 días |
| Likes, matches y mensajes | Ligar | Contrato | Hasta que se borre el match o la cuenta |
| Vibe Check, eventos y objetos perdidos | Funciones | Contrato | 30 días, 12 meses y 48 h |
| Moderación y bans | Seguridad | Interés legítimo y DSA | 2 años, o mientras dure el ban |
| Evidencias de consentimiento | Art. 7 RGPD | Obligación legal | Mientras la cuenta esté activa + prescripción, bloqueadas |
| Spotify | Anthem | Consentimiento | Hasta que se desconecte |
| Comunicaciones comerciales | Promociones | Consentimiento | Hasta revocación |
| Datos técnicos | Seguridad | Interés legítimo | Máximo 90 días |
| Analítica | Mejora | Consentimiento | Máximo 13 meses |
| Pagos (IDs del proveedor, estado, facturas; nunca datos de tarjeta) | Premium | Contrato y obligación legal | Facturas 6 años |
| Datos de prueba (`is_test`) | Testing | Interés legítimo | Se purgan antes del lanzamiento |

**B) Terceros**

| Tercero | Uso | Ubicación y garantías | Estado |
|---|---|---|---|
| Supabase (proyecto Nightlife_Connect) | Base de datos, auth, archivos, funciones | eu-west-1 (UE) | Activo |
| Proveedor de SMS de Supabase Auth | OTP | Elegir uno con garantías UE | Activo |
| Veriff | Edad e identidad (solo booleanos, integración de test) | UE | Activo (test; no acredita identidad real) |
| Yoti | Edad e identidad (solo booleanos) | Reino Unido (adecuación hasta 2031) | Alternativa; live en el Bloque 12 |
| Lovable (si aloja la web) | Hosting | Verificar | Activo |
| Mapbox | Mapa | EE. UU. (DPF / cláusulas tipo) | Activo |
| Google Places | Locales (desde servidor) | EE. UU. (DPF) | Activo |
| Spotify | Anthem | UE | Activo |
| Email transaccional | Documentos y avisos | Preferiblemente UE | Activo |
| Fuentes de eventos | Importación (sin datos de usuarios) | — | Activo |
| Stripe | Pagos | Irlanda/EE. UU. | **Integrado en modo test, desactivado para el público** |
| Analítica (opcional) | Métricas | Autoalojada o UE | Opcional |
| Apple / Google (pagos dentro de la app y push) | Al pasar a nativa | EE. UU. (DPF) | Futuro |

**C) IA**
- **Usos:** estimación de edad (Yoti) y comparación facial.
- **Por reglas (sin IA):** el emparejamiento y los rompehielos.
- Avisos, revisión humana y prohibición de inferir datos sensibles.

**D) Declaraciones de las tiendas (al pasar a nativa)**
- App Store: etiqueta de privacidad y privacy manifest.
- Google Play: "Seguridad de los datos" y URL de eliminación de cuenta.
- Clasificación 18+.

**E) Seguridad**
- HTTPS y cifrado en reposo. No se anuncia cifrado de extremo a extremo.
- Segundo factor para el admin.
- Mínimo privilegio.
- Brechas notificadas a la AEPD en 72 horas.

**F) Accesibilidad**
- WCAG 2.1 AA en todos los temas.
- Respeto a la opción de reducir movimiento.

**G) Eliminación de cuenta y derechos**
- **Exportar:** descarga en JSON.
- **Eliminar:**
  - Se borra todo, incluidos los mensajes enviados.
  - También en terceros. En Stripe se borra el cliente, salvo los datos de facturación obligatorios.
  - Las suscripciones activas se cancelan antes del borrado.
- **Datos que se conservan bloqueados:** solo los exigidos por ley.
- **Plazos:** respuesta máxima de 1 mes. Cuentas inactivas borradas a los 24 meses, con aviso previo.

### 6.13. Pagos integrados y desactivados (feature flags)

**Objetivo:** todo el sistema de pagos está construido y probado en modo test, pero apagado para el público. Activarlo no requiere código, solo configuración.

**Flags (`app_settings`, editables en Admin → Feature flags, con auditoría)**

| Flag | Valores | Valor inicial |
|---|---|---|
| `payments_mode` | disabled / test / live | **test** |
| `payments_audience` | none / testers / all | **testers** |
| `paywall_visibility` | hidden / coming_soon / visible | **coming_soon** |
| `premium_enabled` | on / off | on (con entitlements manuales y promocionales) |
| `paid_dm_enabled` | on / off | off |
| `sponsorship_self_service_enabled` | on / off | off |
| `flash_alerts_push_enabled` | on / off | off |
| `verification_mode` | sandbox / live | sandbox |
| `test_tools_enabled` | on / off | on (off antes del lanzamiento) |

**Arquitectura**
1. **Entitlements como única fuente de verdad.**
   - La app nunca pregunta "¿ha pagado?". Pregunta "¿tiene la ventaja X?" mediante `has_entitlement()` (SQL) y `useEntitlement()` (frontend).
   - Las ventajas pueden venir de varios orígenes: admin, código promocional, tester, Stripe y, en el futuro, Apple y Google.
2. **Capa de proveedor de pago** (`src/platform/payments`):
   - Proveedor "Stripe web" ahora.
   - Proveedores "tiendas" en el futuro.
   - Proveedor "desactivado" que muestra el estado según `paywall_visibility`.
3. **Edge Functions:**
   - `create-checkout-session`: Stripe Checkout para suscripción o pago único.
   - `create-portal-session`: portal de cliente de Stripe para cancelar y ver facturas.
   - `request-withdrawal`: botón de desistimiento.
   - `stripe-webhook`:
     - Verifica la firma.
     - Es idempotente mediante `payment_events`.
     - Procesa: pago completado, suscripción creada, actualizada o cancelada, factura pagada, pago fallido y reembolso.
     - Concede o retira entitlements.
4. **Claves por modo:**
   - Supabase Secrets: `STRIPE_SECRET_KEY_TEST`, `STRIPE_WEBHOOK_SECRET_TEST`, `STRIPE_SECRET_KEY_LIVE`, `STRIPE_WEBHOOK_SECRET_LIVE`.
   - El código elige las claves según `payments_mode`.
   - Los planes guardan los IDs de precio de test y de live.
5. **Pantallas ya construidas:**
   - Paywall y comparativa Free/Premium.
   - Checkout con toda la información legal: precio con IVA, renovación, cancelación y desistimiento.
   - Botón "Suscribirme y pagar".
   - Mi suscripción: cancelar en 2 clics, botón de desistimiento siempre visible durante el plazo y facturas.
   - Canjear código.
   - Pago único de mensaje directo.
6. **Comportamiento según los flags:**
   - `audience = none`: nadie ve el pago.
   - `audience = testers`: solo los testers ven el checkout real de Stripe en modo test (tarjetas de prueba de Stripe).
   - `audience = all`: todo el mundo.
   - `paywall_visibility = coming_soon`: el resto ve "Próximamente", con un "Avísame" opcional que requiere el consentimiento comercial.
7. **Avisos automáticos:**
   - Email antes de la renovación anual.
   - Email antes del fin de una prueba gratuita.
   - Email ante un cambio de precio.
   - Confirmación de cancelación y de desistimiento.
8. **Facturas e IVA:** las facturas o recibos los genera Stripe. Antes de pasar a live, revisar con la gestoría el IVA, la facturación en España y Stripe Tax.
9. **Rollback:** poner `payments_mode = disabled` bloquea las compras nuevas. Los entitlements ya pagados se respetan hasta su fin.

**Procedimiento de activación:** ver el Anexo A.

### 6.14. Modo pruebas (testing fácil)
- **Rol `tester`:** se asigna desde el admin.
- **Teléfonos de prueba:** números con OTP fijo, configurados en Supabase Auth, solo para testers. Se eliminan antes del lanzamiento.
- **Verificación en sandbox:** con `verification_mode = sandbox`, los testers usan el entorno de pruebas de Yoti. Nunca hay "bypass" para usuarios normales.
- **Generador de datos de prueba** (Admin → Herramientas de prueba):
  - Crear una "ciudad de prueba" con locales reales importados y eventos ficticios.
  - Crear perfiles de prueba (`is_test`) con avatares ilustrados. **Nunca fotos de personas reales.**
  - Datos variados de edades, géneros y semáforos.
- **Simuladores (solo con `test_tools_enabled`):**
  - Llenar un local con N check-ins de prueba.
  - Hacer que un perfil de prueba te dé like (para ver el match en directo).
  - Enviar mensajes de prueba.
  - Simular eventos de webhook de Stripe y de Yoti.
  - Adelantar caducidades (eventos de 24 h, check-ins, objetos perdidos).
  - Reiniciar el límite de likes.
  - Conceder o retirar entitlements.
- **Aislamiento:** los datos `is_test` solo los ven los testers y los admins (RLS).
- **Botón "Purgar datos de prueba":** borra todo lo `is_test` con confirmación.
- **Antes del lanzamiento:**
  - Purgar los datos de prueba.
  - Poner `test_tools_enabled = off`.
  - Quitar los teléfonos de prueba.
  - Poner `verification_mode = live`.

### 6.15. Seguridad (OWASP), obligatoria en todos los bloques

**Principios:** denegar por defecto, mínimo privilegio, defensa en profundidad, fallar cerrado, nunca confiar en el cliente, validar en la entrada y codificar en la salida.

**A) OWASP Top 10:2025 (web)**

| Riesgo | Medidas en Nightlife Connect |
|---|---|
| A01 Pérdida de control de acceso (incluye SSRF) | Ver detalle debajo de la tabla |
| A02 Configuración de seguridad incorrecta | Ver detalle debajo de la tabla |
| A03 Fallos en la cadena de suministro | Solo dependencias de 3.5. Lockfile versionado. Auditoría de vulnerabilidades en cada bloque. SBOM al cerrar el proyecto. Revisar cada paquete que proponga la IA (paquetes "alucinados" o con nombres parecidos a los reales) |
| A04 Fallos criptográficos | HTTPS siempre y cifrado en reposo de Supabase. **Hashes de teléfono y dispositivo con HMAC-SHA256 y clave secreta**, porque un hash simple de un número de teléfono se revierte por fuerza bruta. Firmas de webhooks verificadas con las librerías oficiales. Nada de criptografía casera. Rotación de secretos documentada |
| A05 Inyección (incluye XSS) | Ver detalle debajo de la tabla |
| A06 Diseño inseguro | Modelo de amenazas (STRIDE) en `docs/SECURITY.md` para: alta y OTP, verificación, check-in y "Aquí Ahora" (riesgo de seguimiento), likes y chat, reportes, eventos, pagos y entitlements, herramientas de prueba y admin. Casos de abuso en el apartado E |
| A07 Fallos de autenticación | Ver detalle debajo de la tabla |
| A08 Fallos de integridad de software y datos | El cliente no puede escribir en verificación, roles, entitlements, bans ni estadísticas; solo el servidor. Webhooks firmados e idempotentes. Migraciones revisadas antes de aplicarse. Builds reproducibles desde el repositorio |
| A09 Fallos de registro y alertas | **Se registran:** fallos de login y OTP, abuso de límites, acciones de admin, cambios de flags, fallos de webhooks y borrados de cuenta. **Alertas** por email ante picos anómalos. Sin datos sensibles en los logs. Máximo 90 días |
| A10 Manejo inadecuado de condiciones excepcionales | **Fallar cerrado:** si falla la comprobación de flags, entitlements o verificación, se deniega. Errores genéricos para el usuario y detalle solo en el servidor. Error Boundaries. Tiempos de espera y reintentos con backoff. Operaciones de varios pasos (match, compra, borrado) en transacciones |

**Detalle de A01 – Control de acceso**
- RLS activa y "denegar por defecto" en todas las tablas.
- Políticas probadas por rol: anónimo, usuario, verificado, tester, venue_manager y admin.
- Buckets de Storage privados, con URLs firmadas de corta duración.
- Las acciones de admin se comprueban en servidor, no solo ocultando botones.
- La clave `service_role` nunca sale de las Edge Functions.
- Las peticiones salientes solo van a dominios de una lista blanca, nunca a URLs aportadas por el usuario.

**Detalle de A02 – Configuración**
- **Cabeceras de seguridad:**
  - CSP estricta, limitada a los dominios declarados.
  - HSTS.
  - X-Content-Type-Options.
  - Referrer-Policy.
  - Permissions-Policy: cámara y ubicación solo en el propio dominio.
  - `frame-ancestors 'none'`.
- Si el hosting no permite cabeceras, CSP mediante meta y valorar un hosting que sí las permita.
- CORS restringido a los dominios propios.
- Sin source maps públicos ni modo debug en producción.
- Proveedores de Auth que no se usen, desactivados.
- Security Advisors de Supabase sin avisos.

**Detalle de A05 – Inyección**
- Consultas siempre parametrizadas con el cliente de Supabase.
- En funciones SQL, nunca concatenar texto: usar parámetros o `format` con `%L`/`%I`.
- Nunca `dangerouslySetInnerHTML` con contenido de usuarios o importado.
- El Markdown de los documentos legales se sanea con DOMPurify.
- **En Mapbox, popups con nodos DOM o texto, nunca `setHTML` con datos de usuarios.**
- Validación con Zod de toda entrada.

**Detalle de A07 – Autenticación**
- OTP de corta duración y con límite de intentos por número, IP y dispositivo.
- JWT de corta duración con rotación de refresh tokens.
- Opción de cerrar sesión en todos los dispositivos.
- **MFA (TOTP) obligatorio para los admins.**
- **Reautenticación por OTP** para acciones sensibles: eliminar la cuenta, cambiar de teléfono o de email.
- Aviso al usuario cuando cambia su teléfono (riesgo de duplicado de SIM).

**B) OWASP API Security Top 10 (2023)**
Se aplica a PostgREST de Supabase, a las RPC y a las Edge Functions.

| Riesgo | Medidas |
|---|---|
| API1 Autorización a nivel de objeto (BOLA/IDOR) | RLS + tests que intentan leer o editar recursos de otro usuario: perfiles, mensajes, matches, suscripciones y documentos firmados |
| API2 Autenticación | JWT verificado en todas las Edge Functions. Solo los webhooks quedan exentos, porque verifican firma |
| API3 Autorización a nivel de propiedad (BOPLA, asignación masiva) | Vistas públicas que exponen solo las columnas permitidas (el perfil público no incluye teléfono, fecha exacta, preferencias ni estados internos). Los campos sensibles viven en tablas separadas sin permiso de escritura del cliente. Las Edge Functions solo aceptan campos de una lista blanca |
| API4 Consumo de recursos sin límite | Ver detalle debajo de la tabla |
| API5 Autorización a nivel de función | Toda función de admin, venue_manager o tester comprueba el rol en servidor. Las herramientas de prueba comprueban además `test_tools_enabled` en servidor |
| API6 Flujos de negocio sensibles | Antiautomatización en altas, swipes masivos, reportes coordinados, creación de eventos, canje de códigos (fuerza bruta) y lectura masiva de perfiles (scraping): límites, detección de patrones y bloqueo temporal |
| API7 SSRF | Lista blanca de dominios para cualquier petición saliente |
| API8 Configuración | CORS, cabeceras y errores sin detalles internos |
| API9 Inventario | `docs/API.md` con cada función (propósito, autenticación, rol y límites). Se eliminan las funciones sin uso. Ninguna función de prueba accesible en producción |
| API10 Consumo inseguro de APIs | Las respuestas de Yoti, Stripe, Places, Spotify y las fuentes de eventos se validan con Zod y con tiempos de espera. Su contenido (por ejemplo, las descripciones de eventos importados) se trata como no confiable y se sanea |

**Detalle de API4 – Límites de uso**
- **Límites por usuario e IP** en: OTP, likes, mensajes, reportes, eventos, búsquedas y canje de códigos.
- **Paginación** con tamaño máximo.
- **Fotos:**
  - Límite de tamaño y tipo.
  - Se recodifican en el cliente y se suben **sin metadatos EXIF**, que pueden incluir la ubicación GPS de casa.
- **Cuotas de Yoti, Places y Mapbox** con alertas de coste.

**C) OWASP Top 10 para aplicaciones LLM (2025)**
La app no usa LLMs en el MVP: el emparejamiento y los rompehielos funcionan por reglas. Este apartado se aplica a dos ámbitos.

*1. Desarrollo asistido por IA (Lovable)*
- **LLM01 Inyección de prompts:** no pegar en Lovable contenido externo sin revisar. El Knowledge del proyecto contiene solo este PRD y documentos propios.
- **LLM02 Divulgación de información sensible:** nunca pegar en el chat claves, secretos, datos reales de usuarios ni claves live. Los secretos se introducen solo en Supabase Secrets.
- **LLM03 Cadena de suministro:** revisar cada dependencia que proponga la IA (ver 3.5).
- **LLM05 Manejo inadecuado de la salida:** el código generado se considera no confiable hasta revisarlo. Revisión humana obligatoria de las políticas RLS, las migraciones, las Edge Functions y la lógica de pagos antes de dar OK a cada bloque. Apoyo en los Security Advisors de Supabase y en el escáner de seguridad de Lovable, si está disponible.
- **LLM06 Agencia excesiva:** las herramientas de IA conectadas a Supabase no ejecutan SQL destructivo ni migraciones en producción sin confirmación explícita. Tras el lanzamiento, el desarrollo se hace en una rama o proyecto aparte.

*2. Checklist antes de activar futuras funciones con LLM* (moderación, asistentes, rompehielos con IA):
- Separar las instrucciones del sistema del contenido de usuario y tratar este como posible inyección (LLM01).
- No enviar datos sensibles al modelo. Proveedor en la UE o con adecuación y contrato de encargado (LLM02).
- Sin secretos ni reglas críticas en el prompt del sistema (LLM07).
- Validar y codificar la salida del modelo antes de mostrarla o usarla (LLM05).
- Sin herramientas con permisos de escritura sin aprobación humana (LLM06).
- No entrenar con datos de usuarios (LLM04). Si hay búsqueda semántica, aislar los vectores por usuario (LLM08).
- Avisar de que es IA y de que puede equivocarse (LLM09 y art. 50 del Reglamento de IA).
- Límites de uso y de coste por usuario (LLM10).

**D) Protección de datos personales en la app**
- **Fotos:** sin EXIF, en un bucket privado y servidas con URLs firmadas.
- **"Aquí Ahora":**
  - No se muestra a otros usuarios la hora exacta del check-in.
  - El bloqueo oculta la presencia en ambos sentidos al instante.
  - Límite de consultas de perfiles.
  - Motivo de reporte "Me siento seguido/a".
- **Admin:** todo acceso a datos sensibles queda registrado. Las preferencias de orientación solo se consultan si una moderación lo justifica, y queda registrado.

**E) Casos de abuso que deben estar cubiertos**

| Caso | Mitigación |
|---|---|
| Un menor miente sobre su edad | Yoti obligatorio para ligar, reporte "posible menor" y reverificación por documento |
| Un usuario baneado intenta volver | HMAC de teléfono y dispositivo, límites de alta |
| Seguimiento o acoso mediante los check-ins | Modo discreto, bloqueo, sin hora exacta, límites de consulta y reporte específico |
| Reportes en masa para expulsar a alguien | Solo cuentan los reportes válidos, detección de coordinación y revisión humana |
| Scraping de perfiles | Edad verificada para ver perfiles, límites y detección de patrones |
| Concederse Premium manipulando la app | Entitlements que solo puede escribir el servidor |
| Fuerza bruta de códigos promocionales | Límites, códigos largos y bloqueo temporal |
| Evento falso para atraer a alguien a una trampa | Solo lugares públicos, 3 confirmaciones, reportes y aviso de seguridad en los eventos no confirmados |
| Herramientas de prueba expuestas en producción | Doble control en servidor: rol + flag |
| Inyección mediante contenido importado | Saneado y validación (API10) |

**F) Proceso**
- **Puerta de seguridad** al cerrar cada bloque (ver 11.1).
- **Antes del lanzamiento:** auditoría completa en el Bloque 10. Se recomienda también un pentest externo.
- **Después del lanzamiento:**
  - Revisión mensual de dependencias y de los Security Advisors.
  - Rotación de secretos.
  - Procedimiento de respuesta a incidentes, enlazado con el de brechas del RGPD (6.12 E).

**G) Checklist de cierre de seguridad (Bloque 10)**
- [ ] RLS en todas las tablas y tests por rol superados, incluidos los intentos de IDOR.
- [ ] Security Advisors de Supabase: 0 avisos de seguridad.
- [ ] Ninguna clave secreta en el frontend ni en el repositorio.
- [ ] Cabeceras de seguridad y CSP verificadas.
- [ ] Límites de uso activos en todas las funciones sensibles.
- [ ] Fotos sin EXIF y buckets privados.
- [ ] Webhooks con firma e idempotencia probados.
- [ ] Auditoría de dependencias sin vulnerabilidades críticas ni altas, y SBOM generado.
- [ ] Inventario de API completo y ninguna función de prueba accesible.
- [ ] Logs sin datos sensibles y alertas funcionando.
- [ ] Casos de abuso del apartado E probados.
- [ ] `docs/SECURITY.md` cerrado.

---

## 7. INTEGRACIONES Y LÓGICA EXTERNA

Ver 6.12 B. Reglas comunes:
- Las llamadas con secretos se hacen desde Edge Functions.
- Los webhooks (Yoti, Stripe) se verifican por firma y son idempotentes.
- Los flujos externos se abren mediante el servicio de navegador de la capa de plataforma, con "return URL" configurable.
- Cada nueva integración requiere actualizar la tabla de terceros, la Política de Privacidad y las declaraciones antes de activarse.

---

## 8. LINEAMIENTOS DE DISEÑO UI/UX

### 8.1. Dirección creativa
"Una app nocturna que se siente viva". No debe parecer una web ni una plantilla.
- **El mapa 3D nocturno es el escenario.**
- **La interfaz flota encima en capas de cristal.**
- **"En directo" como seña de identidad:** pulsos, contadores y un heatmap que respira.
- **Sin degradados abusivos ni neón chillón** en el tema por defecto.

### 8.2. Sistema de temas
Todo son tokens (variables CSS). Cada tema cambia los colores, la tipografía, el estilo del mapa, la paleta del heatmap y la intensidad del movimiento. Todos cumplen el contraste AA.

| Tema | Para quién | Look |
|---|---|---|
| **Neon Noir** (por defecto) | Todos | Negro profundo, violeta y cian con brillo suave, cristal sutil |
| **Cyberpunk** | Público joven y techno | Magenta, amarillo ácido y cian; "glitch" breve; acentos monoespaciados |
| **Velvet** | 35-60, lounges | Burdeos, negro cálido y dorado; serifa elegante; movimiento pausado |
| **Sunset** | Terrazas y verano | Naranjas y rosas sobre azul noche |
| **Mono** | Accesibilidad | Alto contraste, movimiento mínimo |

- El cambio de tema es instantáneo y animado.
- **Acento por tipo de lugar:**
  - Discoteca: violeta.
  - Club: cian.
  - Pub: ámbar.
  - Garito: rojo.
  - Lounge: dorado.
  - Terraza: naranja.
  - Beach club: turquesa.
  - Eventos: magenta.
- **Los 5 temas base son gratis.** El entitlement `premium_themes` abre Gold y
  Sapphire, añadidos en el cierre funcional de 8/9 del 05/10/2026. Al perder la
  ventaja se aplica un tema base.

### 8.3. Tipografía
- Autoalojada y con licencia OFL.
- **Display:** por ejemplo, Space Grotesk o Unbounded.
- **Cuerpo:** Inter.
- **Monoespaciada:** por ejemplo, JetBrains Mono.
- **Serifa:** por ejemplo, Playfair Display.

### 8.4. Movimiento

**Momentos firma**
- Vuelo de cámara al tocar un pin.
- La tarjeta se convierte en la ficha.
- Bottom sheets con física de muelle.
- Contadores que cuentan.
- Pulso "en directo".
- Swipe y match (6.6.1).
- Animación de check-in.
- Sello en los badges.

**Microinteracciones**
- Respuesta a la presión.
- Vibración (nativo).
- Skeletons con brillo.
- Estados vacíos animados.

**Reglas**
- Duraciones de 150 a 400 ms.
- Springs naturales.
- Un protagonista por pantalla.
- Animar solo transform y opacity.
- Reducir movimiento → fundidos.

### 8.5. Componentes y patrones
- Tab Bar flotante de cristal.
- Chips.
- Cards con estadísticas inline.
- Bottom sheets.
- Swipe cards.
- Badges ✓.
- **Paywall elegante y honesto:** sin urgencias falsas, con el precio completo visible y "Ahora no" claro.

**Patrones legales**
- Etiquetas siempre legibles.
- "Rechazar" igual de visible que "Aceptar".
- Sin patrones oscuros.

**Responsividad**
- Mobile-First.
- En escritorio: mapa a la izquierda y panel a la derecha.

---

## 9. ALCANCE DEL PROYECTO

### Incluido (MVP, web/PWA)
- Alta con teléfono, firma legal, consentimientos y verificaciones (Yoti en sandbox y en live).
- Mapa 3D, heatmap, estadísticas, locales y eventos, buscador.
- Ligar completo con la experiencia de swipe y match en tiempo real.
- Vibe Check, objetos perdidos, moderación DSA, 3 strikes y SOS Lite.
- Panel de locales, patrocinios con factura y admin completo.
- **Pagos completos con Stripe en modo test**, detrás de flags:
  - Premium.
  - Mensajes directos de pago.
  - Portal de cliente.
  - Desistimiento.
  - Entitlements.
  - Códigos promocionales.
- **Modo pruebas** con testers, datos aislados, simuladores y purga.
- 5 temas y sistema de movimiento.
- PWA instalable.
- **Capa de plataforma preparada para Capacitor.**
- Derechos RGPD completos.

### Excluido (posterior)
- Activación de los pagos en live (Anexo A).
- Empaquetado nativo con Capacitor, pagos de Apple y Google, check-in automático en segundo plano, vibración, biometría del dispositivo y push (Anexo B).
- Autoservicio de patrocinios.
- SOS en modo Partner.
- Venta de entradas.
- Stories y gamificación.
- Temas Premium extra.

### Requisitos legales previos al lanzamiento
- **Abogado:** textos legales, base legal y umbral de la verificación de edad, Premium (servicio o contenido digital), alcohol, patrocinios y obligaciones DSA.
- **Gestoría:** IVA y facturación de Stripe.
- EIPD.
- Registro de Actividades de Tratamiento.
- DPO (probable).
- Contratos de encargado (Supabase, SMS, Yoti, Mapbox, Google, Spotify, email, Stripe).
- Procedimiento de brechas.

---

## 10. NOTA FINAL (CHAT MODE)

Antes de generar código:
1. Lee este documento completo.
2. Confirma tu entendimiento en Chat Mode: módulos, tablas, terceros, temas, flags de pago, modo pruebas, capa de plataforma y plan de bloques.
3. Señala dudas o riesgos.
4. Ejecuta el Plan de Construcción bloque a bloque.

---

## 11. PLAN DE CONSTRUCCIÓN POR BLOQUES (10 BLOQUES)

### 11.1. Protocolo para no perder contexto (obligatorio)
1. **El PRD vive en el proyecto:** este documento se guarda en el Knowledge del proyecto de Lovable y en `docs/PRD.md`. Es la fuente de verdad.
2. **`docs/PROGRESS.md`:** por cada bloque se anota qué se hizo, qué decisiones se tomaron, qué desviaciones hubo y qué queda pendiente.
3. **Al empezar cada bloque (Chat Mode):** releer las secciones del PRD indicadas y `PROGRESS.md`, escribir el plan y después implementar.
4. **Al terminar cada bloque:**
   - Checklist de "Hecho cuando" con ✅/❌.
   - Cómo probarlo.
   - Actualizar `PROGRESS.md`.
   - Terminar con: **"Bloque X terminado. ¿Me das OK para pasar al Bloque X+1?"**
   - **No continuar sin un OK explícito.**
5. **Límites:** no modificar bloques ya aprobados sin avisar, no añadir dependencias ni terceros no listados y no inventar requisitos.
6. **Datos:** los bloques 1-4 usan mocks en `src/mocks/`. Desde el bloque 5 se usan datos reales y de prueba (`is_test`).
7. **Puerta de seguridad, al cerrar cada bloque:**
   - Ejecutar los Security Advisors de Supabase y, si está disponible, el escáner de seguridad de Lovable.
   - Revisar las políticas RLS, migraciones y Edge Functions nuevas.
   - Comprobar las dependencias añadidas.
   - Aplicar los puntos de 6.15 que afecten al bloque.
   - Anotar los resultados en `PROGRESS.md` y en `docs/SECURITY.md`.
   - **Un bloque no se cierra con hallazgos críticos o altos abiertos.**
8. **Arquitectura desde el Bloque 1:** aplicar 3.4 y 3.5. El Bloque 1 crea además:
   - La estructura por funcionalidades.
   - TypeScript estricto.
   - ESLint y Prettier.
   - i18n.
   - Vitest.
   - Los documentos `ARCHITECTURE.md`, `API.md`, `SECURITY.md` y la carpeta `docs/adr/`.

### 11.2. Bloques

**Bloque 1 – Cimientos, diseño y arquitectura preparada**
- **PRD:** 3, 8.
- **Incluye:**
  - Estructura del proyecto.
  - **Capa de plataforma** (`src/platform/`) con implementaciones web.
  - Servicio de feature flags y de entitlements (con mocks).
  - Tokens y 5 temas con selector.
  - Fuentes autoalojadas.
  - Librería de movimiento.
  - Componentes base.
  - Tab Bar.
  - Manifest PWA.
  - `docs/PRD.md` y `docs/PROGRESS.md`.
- **Hecho cuando:**
  - Los 5 temas funcionan con animación.
  - Se respeta "reducir movimiento".
  - No hay CDNs externos.
  - Ningún componente accede directamente a las APIs del dispositivo.

**Bloque 2 – Frontend de onboarding, legal y verificación (mock)**
- **PRD:** 5.2, 6.1, 6.2.
- **Incluye:** todo el onboarding, la firma, los consentimientos, el Centro de verificación con estados simulados y el bloqueo de funciones "Verifica tu edad".
- **Hecho cuando:** el flujo se puede recorrer completo y no hay casillas premarcadas.

**Bloque 3 – Frontend de la app principal y experiencia de match (mock)**
- **PRD:** 5.3, 6.3-6.8, 6.6.1.
- **Incluye:**
  - Descubre (mapa mock, ficha y "Quién hay").
  - Esta Noche con la **pila de swipe con física, los sellos, la pantalla de match, los rompehielos y los estados vacíos**.
  - Chats.
  - Perfil.
  - Crear evento.
- **Hecho cuando:**
  - Los momentos firma y el match están implementados y fluidos en móvil.
  - Funciona con los 5 temas.

**Bloque 4 – Frontend de paneles, web pública y pantallas de pago (mock)**
- **PRD:** 5.1, 6.1, 6.9-6.11, 6.13 (UI), 6.14 (UI).
- **Incluye:**
  - Panel de locales.
  - Admin, incluidos Pagos, Feature flags y Herramientas de prueba.
  - Web pública legal.
  - Paywall, checkout, Mi suscripción (cancelar, desistir, facturas), canjear código y mensaje directo de pago.
  - Estados "Próximamente" y "oculto".
- **Hecho cuando:** todas las pantallas se pueden navegar y el paywall cambia según los flags simulados.

**Bloque 5 – Backend base, legal y modo pruebas**
- **PRD:** 3.1, 4, 6.1, 6.12, 6.14.
- **Incluye:**
  - Conexión al proyecto Supabase **Nightlife_Connect (Chaplications trade, eu-west-1)**.
  - Esquema completo, RLS, roles (incluido tester), `app_settings` con flags.
  - Auth con teléfono + OTP, teléfonos de prueba y límites.
  - Perfiles y Storage.
  - Documentos, firma, `consent_records`, PDF y email.
  - **Generador de datos de prueba, aislamiento `is_test` y purga.**
- **Hecho cuando:**
  - Un tester se da de alta con un teléfono de prueba y firma.
  - Las RLS están probadas.
  - Los datos de prueba no son visibles para un usuario normal.

**Bloque 6 – Verificaciones en desarrollo y pruebas**
- **PRD:** 6.2.
- **Incluye:**
  - Veriff primero en test; conservar Yoti como alternativa: webhook firmado y `verification_status`.
  - Foto verificada.
  - Identidad verificada.
  - Badges.
  - Bloqueo real de funciones.
  - Bans por hash.
  - Simulaciones persistidas de edad, identidad y foto; integración gratuita cuando esté disponible.
- **Hecho cuando:** una cuenta no verificada no puede ligar y no se guarda ninguna imagen ni documento.

**Bloque 7 – Mapa, lugares, eventos y estadísticas reales**
- **PRD:** 6.3-6.5, 6.7, 6.8.
- **Incluye:**
  - Mapbox con los estilos por tema.
  - Google Places.
  - Importación de eventos.
  - Eventos de usuarios con confirmación de 24 h.
  - Check-in manual.
  - Estadísticas, heatmap y buscador.
  - Vibe Check y objetos perdidos.
  - Simuladores de afluencia y de caducidad.
- **Hecho cuando:**
  - Un check-in se refleja en menos de 5 segundos.
  - Un evento sin confirmar se borra a las 24 horas (o al adelantarlo con el simulador).

**Bloque 8 – Ligar, match en tiempo real y chat**
- **PRD:** 6.6, 6.6.1.
- **Incluye:**
  - Compatibilidad y prioridades.
  - Semáforo y modo discreto.
  - Likes con límite por entitlement.
  - **Match en tiempo real para ambos usuarios.**
  - Chat en tiempo real.
  - Bloqueo y eliminar match.
  - Anthem.
  - Simulador "un perfil de prueba te da like".
- **Hecho cuando:**
  - Dos testers hacen match y ven la animación a la vez.
  - El chat funciona en tiempo real.

**Bloque 9 – Seguridad, derechos, negocio y pagos en modo test**
- **PRD:** 6.9-6.13.
- **Incluye:**
  - Moderación, 3 strikes, apelaciones y SOS Lite.
  - Exportar y eliminar cuenta (con terceros y cancelación de suscripción).
  - Patrocinios y Flash Alerts dentro de la app.
  - **Stripe en modo test:** planes, checkout, portal, desistimiento, webhook idempotente, entitlements, códigos promocionales, emails de aviso y simulador de webhooks.
  - pg_cron.
- **Hecho cuando:**
  - Un tester compra Premium con una tarjeta de prueba, obtiene las ventajas, cancela y desiste.
  - Con `audience = none` nadie ve el pago.
  - El borrado de cuenta está probado de punta a punta.

**Bloque 10 – Auditoría de seguridad OWASP, pulido, PWA y QA**
- **PRD:** 3.3-3.5, 6.12, 6.15, 8, Anexos A y B.
- **Incluye:**
  - **Auditoría de seguridad completa** con la checklist de 6.15 G (Web, API y LLM):
    - Security Advisors de Supabase sin avisos.
    - Pruebas de RLS por rol.
    - Pruebas de abuso: límites, enumeración e IDOR.
    - Revisión de dependencias y SBOM.
    - `docs/SECURITY.md` cerrado.
  - **Este punto bloquea el lanzamiento:** no puede quedar ninguna vulnerabilidad crítica o alta abierta.
  - Rendimiento a 60 fps.
  - Accesibilidad AA en los 5 temas.
  - PWA instalable.
  - Auditoría de red.
  - Revisión de que la capa de plataforma cubre todas las funciones del dispositivo.
  - Documento `docs/NATIVE.md` con los pasos del Anexo B adaptados al código real.
  - Documento `docs/PAYMENTS_GO_LIVE.md` con el Anexo A.
  - QA completo.
- **Hecho cuando:**
  - La checklist legal y técnica está completa.
  - La app está lista para lanzarse en web con los pagos desactivados.
  - `PROGRESS.md` está cerrado con los pendientes.

---

**Bloque 11 – App nativa y pagos de tiendas en pruebas**
- Capacitor y servicios nativos según el Anexo B; catálogo y entitlements según la monetización aprobada.
- RevenueCat Test Store sin contratar cuentas de pago de Apple/Google.
- Restauración y notificaciones de compras en test, o simulación persistida si no hay acceso gratuito.
- Publicación, cuotas de desarrollador y validación real de tiendas se completan en el Bloque 12.

**Bloque 12 – Contratación, costes, activación live y lanzamiento**
- Presupuestos y aprobación explícita de costes; contratos y revisión legal de terceros.
- Configurar credenciales live, cuentas de tiendas, productos y precios definitivos.
- Validar verificaciones reales, pagos/reembolsos y publicación con las puertas de seguridad completas.
- Los resultados de prueba no se convierten en pruebas de identidad ni compras live: requieren validación real.
- Aplicar el Anexo A y las tareas de publicación del Anexo B exclusivamente en este bloque.

### 11.3. Integración sin cargos (decisión del propietario, 2026-10-03)

Esta política se aplica a todos los proveedores y prevalece sobre las activaciones live de los
bloques anteriores. Primero se usa sandbox/demo/prueba gratuita; si no está disponible, se ofrece
simulación explícita mediante botones con resultados persistidos en las tablas funcionales de
Supabase, permisos de tester/admin, aislamiento, auditoría e idempotencia. No basta un mock local
ni un registro de auditoría sin actualizar el estado de la funcionalidad.

Se acepta registrar tarjeta únicamente para una prueba sin cargos ni renovación de pago. No
contratar ni ampliar planes, ni cambiar automáticamente a un entorno facturable. Al caducar o
agotar una prueba se deshabilitan las llamadas externas y se ofrece simulación explícita.

Selección para pruebas: Veriff primero (Yoti conservado como alternativa); Mapbox Demo sin tarjeta;
Google Places solo con prueba gratuita elegible; Stripe test; RevenueCat Test Store; Spotify solo
con una cuenta de desarrollo ya elegible, sin contratar Premium. SMS/correo/push usan las cuentas
gratuitas disponibles o simulación persistida; Auth mantiene teléfonos de prueba. Eventos usan
fuentes gratuitas autorizadas o fixtures persistidos. Hosting sin ampliaciones y analítica opcional
desactivada. Detalles y fuentes en `docs/PROVIDERS.md`.

En los bloques 6–11 el cierre requiere desarrollo y pruebas completos, con validaciones live
pendientes identificadas para el Bloque 12. Cada cierre incluye commit, push y despliegue validado,
y pide OK antes de comenzar el siguiente bloque. Migraciones/funciones y despliegues se realizan
directamente mediante MCP de Supabase y Vercel, respectivamente.

## ANEXO A – ACTIVAR LOS PAGOS (Bloque 12)
1. Cuenta de Stripe en live verificada (empresa y banco). IVA y facturación revisados con la gestoría (Stripe Tax si aplica).
2. Crear en Stripe live los mismos productos y precios. Copiar los IDs live en `plans`.
3. Añadir a Supabase Secrets: `STRIPE_SECRET_KEY_LIVE` y `STRIPE_WEBHOOK_SECRET_LIVE`.
4. Registrar en Stripe el webhook live apuntando a la Edge Function `stripe-webhook`.
5. Configurar el portal de cliente de Stripe en live (cancelar y facturas).
6. Publicar las Condiciones de Premium y actualizar la Política de Privacidad y la lista de terceros.
7. `payments_mode = live` + `payments_audience = testers` → compra real con tarjeta propia, comprobar las ventajas y hacer un reembolso.
8. `payments_audience = all` + `paywall_visibility = visible`.
9. **Marcha atrás inmediata:** `payments_mode = disabled`.

## ANEXO B – PASAR A APP NATIVA (cuando se decida)
1. Añadir Capacitor (core, iOS, Android) y configurar appId y nombre.
2. Implementar las versiones nativas de los servicios de `src/platform/`:
   - Ubicación (incluido el segundo plano para el check-in automático).
   - Cámara.
   - Vibración.
   - Almacenamiento seguro (sesión de Supabase).
   - Biometría para desbloquear.
   - Identificador de dispositivo.
   - Push.
   - Enlaces profundos (retorno de Yoti, Stripe y Spotify).
   - Navegador interno.
   - Descargas.

   Si hace falta algún plugin de Cordova, Capacitor lo admite.
3. **Pagos en las tiendas:** decidir entre los pagos de Apple y Google o las alternativas permitidas en la UE. Añadir los orígenes `apple` y `google` a los entitlements (la lógica de la app no cambia).
4. Iconos, splash, permisos con textos explicativos y clasificación 18+.
5. Privacy manifest (iOS), "Seguridad de los datos" (Google Play) y URL de eliminación de cuenta.
6. Pruebas en dispositivos reales y publicación.
