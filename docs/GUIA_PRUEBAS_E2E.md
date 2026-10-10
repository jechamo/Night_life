# Nightlife Connect — Informe funcional y guía de pruebas E2E en real

> Fecha: 10/10/2026 · Código analizado: `main` en `32eaa44` (Bloque 11a incluido).
> Entorno: producción de pruebas https://nightlife-connect-beige.vercel.app con Supabase
> `Nightlife_Connect` (pagos en **test**, verificación en **sandbox**).
> Fuentes: `docs/PRD.md`, `docs/PROGRESS.md`, `docs/ROADMAP_2026-10.md`, rutas
> (`src/app/router.tsx`), textos (`src/i18n/locales/es.json`), migraciones SQL y consultas de
> solo lectura a la base de datos real (sin datos personales).

Índice

0. [Resumen y avisos antes de empezar](#0-resumen-y-avisos-antes-de-empezar)
1. [Funcionalidades del cliente](#1-funcionalidades-del-cliente)
2. [Flujos del cliente en la app](#2-flujos-del-cliente-en-la-app)
3. [Funcionalidades del local](#3-funcionalidades-del-local)
4. [Flujos del local en la app](#4-flujos-del-local-en-la-app)
5. [Funcionalidades del admin (necesarias para probar)](#5-funcionalidades-del-admin)
6. [Acceso: SMS, email, biometría, OAuth y TOTP](#6-acceso-cuándo-sms-cuándo-email-cuándo-biometría-cuándo-oauth)
7. [Preparación de las pruebas](#7-preparación-de-las-pruebas)
8. [Casos de prueba E2E (todas las casuísticas)](#8-casos-de-prueba-e2e)
9. [Guion de una «noche de pruebas» con los 3 socios](#9-guion-de-una-noche-de-pruebas)
10. [Limpieza al terminar y registro de incidencias](#10-limpieza-y-registro-de-incidencias)

---

## 0. Resumen y avisos antes de empezar

### 0.1 Estado real del entorno (consultado hoy)

| Elemento                                    | Valor                                                                             |
| ------------------------------------------- | --------------------------------------------------------------------------------- |
| Cuentas reales                              | 3 (vosotros). Las 3 tienen roles `user` + `tester` + `admin` y la edad verificada |
| Segundo factor (TOTP)                       | Solo 1 de las 3 cuentas lo tiene configurado                                      |
| Email verificado                            | Solo 1 de las 3 cuentas                                                           |
| Perfiles de prueba                          | 0 (`is_test`)                                                                     |
| Locales                                     | 2.702, todos en **Madrid** (importados de OpenStreetMap). 0 locales de prueba     |
| Eventos / claims / gestores / códigos promo | 0 / 0 / 0 / 0                                                                     |
| Catálogo de pago                            | 14 productos con precio de Stripe TEST (ver §1.6 y §3.3)                          |
| Mapa                                        | Mapbox real activo; límite propio de 1.000 cargas/mes (150 usadas) y 1.000/día    |
| Verificación                                | Proveedor `veriff` (integración TEST) + simulador para testers                    |

Flags actuales (Admin › Feature flags):

| Flag                               | Valor         | Efecto para las pruebas                                            |
| ---------------------------------- | ------------- | ------------------------------------------------------------------ |
| `payments_mode`                    | `test`        | Stripe con tarjetas de prueba, sin dinero real                     |
| `payments_audience`                | `testers`     | **Solo los testers pueden pagar**                                  |
| `paywall_visibility`               | `coming_soon` | Quien no puede pagar ve «Próximamente» + «Avísame»                 |
| `premium_enabled`                  | `on`          | Premium activo                                                     |
| `paid_dm_enabled`                  | `on`          | Mensaje directo sin match                                          |
| `sponsored_cards_enabled`          | `on`          | Tarjetas de locales patrocinados en el swipe                       |
| `sponsorship_self_service_enabled` | `on`          | El local contrata patrocinio con Stripe desde su panel             |
| `flash_alerts_push_enabled`        | `off`         | Flash Alerts solo dentro de la app (sin push)                      |
| `flash_alcohol_allowed`            | `off`         | No se pueden publicar Flash con alcohol                            |
| `verification_mode`                | `sandbox`     | Verificaciones de prueba                                           |
| `verification_provider`            | `veriff`      | Veriff TEST (la foto siempre usa el simulador)                     |
| `test_tools_enabled`               | `on`          | Simuladores y botones «(pruebas)» visibles para testers            |
| `email_login_enabled`              | `on`          | Entrar con código por email                                        |
| `live_status_enabled`              | `on`          | «Cómo está ahora»                                                  |
| `venue_partners_enabled`           | `on`          | Partners, contratos, invitaciones y equipo                         |
| `venue_showcase_enabled`           | `on`          | Fotos del local, «Lo dice el local», ficha enriquecida, resultados |
| `venue_bookings_enabled`           | `on`          | Reservas sin pago y lista de invitados con QR                      |
| `store_payments_enabled`           | `off`         | Compras en tiendas (Bloque 11b)                                    |
| `travel_mode_enabled`              | `off`         | Modo viaje (Bloque 11b)                                            |

Ajustes: 5 likes gratis/día, umbral de edad 21, radio de check-in 150 m, estadísticas desde 5
personas, 3 confirmaciones por evento, ventana de 3 strikes 6 h, 3 patrocinios por ciudad.

### 0.2 Avisos importantes (leer antes de probar)

Estos puntos salen del código y de la base de datos. Si no se tienen en cuenta, parecerá que
algo «no funciona» cuando es una regla.

1. **Toda cuenta nueva necesita el rol `tester`** para probar casi todo. En `sandbox` la
   verificación de edad (Veriff TEST o simulador) **solo la pueden iniciar testers/admins**
   (`private.begin_verification`). Sin edad verificada no se puede ver perfiles, dar like,
   chatear, marcar «Voy», crear eventos ni reservar. Y con `payments_audience = testers` solo
   los testers pagan. → Tras el alta, otro admin le da «Dar tester» en Admin › Usuarios.
   Una cuenta **sin** tester solo sirve para comprobar lo que ve un usuario normal (paywall
   «Próximamente», no ve datos de prueba, la verificación responde «No disponible»).
2. **Teléfonos para cuentas nuevas.** El alta exige SMS. Si no hay proveedor de SMS de pago
   (política sin cargos, PRD 11.3), añadid números de prueba en Supabase › Authentication ›
   Sign In / Providers › Phone › _Test Phone Numbers and OTPs_ (formato `34600111001=123456`,
   uno por cuenta; revisad la fecha de caducidad de esos OTP). Cada número = una cuenta.
3. **Veriff TEST caduca el 16/10/2026** (corte registrado en
   `private.verification_provider_access`). Haced antes de esa fecha al menos una verificación
   por el flujo real de Veriff. Después, solo queda «Usar simulación de prueba».
4. **Segundo factor del admin:** 2 de las 3 cuentas aún no tienen TOTP. Al entrar en Admin os
   pedirá escanear un QR con Google Authenticator/Authy. Sin él no funciona ninguna acción de admin.
5. **Nadie se aprueba a sí mismo:** el admin no puede aprobar su propio claim de local, su propia
   verificación ni resolver la apelación de una decisión que tomó él. → Siempre «otro» socio.
6. **Para que dos socios se vean en el swipe** se tienen que cumplir a la vez: los dos con edad
   verificada; semáforo distinto de rojo; sin modo discreto; consentimiento de orientación
   firmado; **preferencias compatibles en ambos sentidos** (género que le interesa y rango de
   edad) y, en «Todo el mundo cerca», la **misma ciudad** en el perfil; en «Aquí Ahora»/«Esta
   Noche Voy» de un local, que el otro tenga check-in o «Voy» visible en ese local. Si los
   tres sois del mismo género y no os interesa ese género, **cambiad temporalmente las
   preferencias** para probar y volved a dejarlas después. Además: si le dais «Paso» a un socio
   ya no vuelve a salir (solo «Deshacer» con Pase lo recupera).
7. **Ban = hash del teléfono.** Banear una cuenta impide que ese teléfono vuelva a darse de alta
   hasta levantar el ban. Probadlo solo con una cuenta desechable (número de prueba extra).
8. **«Eliminar cuenta» es irreversible.** Solo con una cuenta desechable.
9. **«Purgar datos de prueba» solo borra lo `is_test`.** Lo que hagáis con vuestras cuentas
   reales (likes, matches, claims, patrocinios, compras TEST, reservas…) se queda. Ver §10.
10. **Catálogo solo en Madrid.** Para probar el check-in físico (150 m) fuera de Madrid, cread un
    local en Admin › Locales › «Nuevo local» con las coordenadas exactas de donde vais a estar
    (ciudad de la lista: Madrid, Barcelona, Valencia, Sevilla, Málaga, Bilbao, Ibiza, Zaragoza).
    En remoto, el botón «Simular que estoy aquí (pruebas)» evita la distancia.
11. **Escáner QR de la puerta:** funciona con la cámara en **Chrome de Android** y en la **app
    Android**; en **iPhone (Safari/PWA) no** (no existe `BarcodeDetector`): allí se teclea el
    código `NL-XXXXX-XXXXX`.
12. **Una sesión por navegador.** Para usar varias cuentas en el mismo móvil/PC usad perfiles de
    navegador distintos o ventanas de incógnito. En iPhone, Safari y la PWA instalada tienen
    sesiones separadas.
13. **Acceso:** SMS solo en el alta (y para borrar la cuenta); después, código por email si la
    cuenta tiene email confirmado; biometría solo en la app nativa; sin OAuth. Detalle en §6.
14. **Mapa:** cada apertura del mapa real consume 1 carga del límite propio (1.000/mes). Si se
    agota, sale el «Mapa de prueba» con aviso; el admin puede ampliarlo en Admin ›
    Configuración › Proveedores (sin coste mientras siga dentro de las 50.000 gratis de Mapbox).

### 0.3 Desajustes detectados durante el análisis (no bloquean, conviene saberlos)

| #   | Dónde                                    | Qué pasa                                                                                                              |
| --- | ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| D1  | Admin › Herramientas › «Roles simulados» | Con el backend real devuelve error (`setSimulatedRoles` rechaza siempre). Para cambiar roles: Admin › Usuarios        |
| D2  | Panel › Lista de invitados               | El aviso de hora no válida dice «próximas 12 horas», pero la regla desde el 09/10 es «antes de las 06:00»             |
| D3  | Admin › Dashboard                        | El subtítulo dice «Datos simulados del entorno de pruebas» aunque esté conectado a datos reales                       |
| D4  | Email login                              | El flag está encendido; si SMTP propio no está configurado en Supabase Auth (ver `AUTH_EMAIL.md`), el código no llega |
| D5  | Cambiar de teléfono                      | No existe en la app (el PRD pide reautenticación por OTP y aviso al usuario); hoy solo cabe crear otra cuenta         |
| D6  | OAuth (Google/Apple)                     | No implementado; decisión pendiente (§6.5)                                                                            |

---

## 1. Funcionalidades del cliente

Leyenda: **G** gratis · **V** requiere edad verificada · **P** de pago (entitlement o crédito) ·
**T** solo testers en esta fase.

### 1.1 Cuenta, alta y acceso

| Funcionalidad                                                                                            | Tipo |
| -------------------------------------------------------------------------------------------------------- | ---- |
| Bienvenida animada con «Empezar», «Ya tengo cuenta», «Cómo funciona» y «Para locales»                    | G    |
| Fecha de nacimiento: menor de 18 → no se crea cuenta ni se guarda nada                                   | G    |
| Firma de documentos legales (3 casillas sin marcar, «Firmo y acepto» / «No acepto»)                      | G    |
| Teléfono + OTP (una cuenta por teléfono; bloqueo si el teléfono/dispositivo está baneado; límites)       | G    |
| Email opcional con verificación por enlace (sirve para entrar sin SMS y recibir el PDF firmado)          | G    |
| Consentimientos (orientación con firma, ubicación precisa, promociones/Flash, analítica), todos apagados | G    |
| Perfil: nombre, género, 2-5 fotos (sin EXIF), bio; Anthem de prueba                                      | G    |
| Preferencias: a quién quieres conocer y rango de edad                                                    | G    |
| Elegir tema (5 base) y entrar                                                                            | G    |
| Login por SMS o por código de email; cerrar sesión; cerrar todas las sesiones                            | G    |
| Desbloqueo con Face ID/huella (solo app nativa)                                                          | G    |

### 1.2 Explorar (sin verificar)

| Funcionalidad                                                                                                       | Tipo |
| ------------------------------------------------------------------------------------------------------------------- | ---- |
| Inicio: ciudad, «Cerca de mí»/«Cerca del centro», 5 cercanos, rankings «Van esta noche»/«Ya están allí», favoritos  | G    |
| Descubre: mapa nocturno (Mapbox), pines con personas y edad media, búsqueda, Todo/Locales/Eventos, lista            | G    |
| Filtros (todos gratis): tipo, cantidad de personas, edad media, % en verde, distancia, precio, abierto ahora, orden | G    |
| Ficha del local/evento: «Quién hay» (umbral 5), horario, precio, dirección, teléfono, web, música, dress code       | G    |
| Ficha enriquecida del local: fotos aprobadas, «Lo dice el local» (puerta y ofertas), entrada, copa, terraza…        | G    |
| Favoritos (marcador en cada local) y pantalla «Tus locales favoritos»                                               | G    |
| Guías públicas `/guia` y `/guia/locales`, web legal, contenido ilegal (DSA), contacto, eliminar cuenta              | G    |

### 1.3 Presencia y comunidad

| Funcionalidad                                                                                                | Tipo  |
| ------------------------------------------------------------------------------------------------------------ | ----- |
| «Esta Noche Voy» (18:00-06:00; los testers pueden fuera de horario)                                          | V     |
| «Estoy Aquí» (check-in a < 150 m, 2 h, uno activo; sin verificar es invisible: cuenta en estadísticas)       | G / V |
| «Simular que estoy aquí (pruebas)» si estás lejos                                                            | T     |
| «Cómo está ahora»: gente, cola, ¿gusta la música?, qué suena (con check-in; totales desde 3 votos en 90 min) | G\*   |
| Vibe Check (con check-in; voto cambiable; agregado)                                                          | G\*   |
| Objetos perdidos (check-in en las últimas 12 h; 280 caracteres; publicar/responder/editar/borrar; 48 h)      | G\*   |
| Crear evento en lugar público (máx. 2/día; antiduplicados; «No confirmado» → «Confirmado» con 3 en 24 h)     | V     |
| Confirmar que un evento existe / Reportar evento (falso, peligroso, inapropiado)                             | V     |
| Ver Flash Alerts de locales en la ficha (si tienes consentimiento de promociones)                            | V     |

\* Requiere check-in activo en ese sitio.

### 1.4 Ligar

| Funcionalidad                                                                                                          | Tipo |
| ---------------------------------------------------------------------------------------------------------------------- | ---- |
| Esta Noche: «Aquí Ahora» / «Esta Noche Voy», lugares con gente, «Todo el mundo cerca»                                  | V    |
| Swipe con física, sellos ME GUSTA/PASO, botones equivalentes, fotos por toques, «Lugar en común», Anthem, «Aquí Ahora» | V    |
| Prioridad: mismo lugar ahora → mismo lugar esta noche → cerca; dentro, primero foto verificada                         | V    |
| Filtro «Solo verificados» (gratis)                                                                                     | V    |
| 5 likes gratis al día (día de Madrid)                                                                                  | V    |
| Match en tiempo real para los dos, pantalla de match con título contextual y rompehielos editables                     | V    |
| Chat en tiempo real con «escribiendo», «Enviado/Leído», historial paginado                                             | V    |
| Eliminar match (para ambos), bloquear (bidireccional e inmediato), reportar                                            | V    |
| Perfil de otra persona (`/people/:id`)                                                                                 | V    |
| Semáforo verde/amarillo («Solo amistad»)/rojo (invisible) y modo discreto                                              | G    |
| «Quién te ha dado like»: sin Premium solo el número con candado                                                        | V    |
| Aviso «N personas nuevas en X» y estado vacío con lugares cercanos                                                     | V    |
| Tarjetas de locales patrocinados en el swipe (máx. 1 de cada 10, etiquetadas)                                          | V    |

### 1.5 Seguridad, privacidad y derechos

| Funcionalidad                                                                                           | Tipo |
| ------------------------------------------------------------------------------------------------------- | ---- |
| Centro de verificación: teléfono, edad (obligatoria para ligar), foto ✓ y identidad (opcionales)        | G    |
| Pedir revisión humana si una verificación falla                                                         | G    |
| Reportar (posible menor, acoso, «me siento seguido/a», perfil falso, inapropiado, spam, otro)           | G    |
| Moderación y apelaciones: ver decisiones sobre tu cuenta y recurrirlas; estado de tus reportes          | G    |
| SOS: llamar al 112, avisar a un contacto (compartir), hasta 3 contactos de confianza                    | G    |
| Consentimientos: activar/revocar en cualquier momento                                                   | G    |
| Documentos firmados (PDF)                                                                               | G    |
| Privacidad y datos: descargar JSON, solicitar rectificación/oposición/limitación, eliminar cuenta (OTP) | G    |
| Pantalla de cuenta suspendida                                                                           | —    |

### 1.6 Premium y extras (todo en Stripe TEST, solo testers)

| Producto             | Precio TEST           | Qué da                                                                                                  |
| -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------- |
| Pase                 | 9,99 €/mes            | Likes ilimitados, Deshacer, temas Gold y Sapphire, sin tarjetas patrocinadas, Modo viaje (próximamente) |
| Pase trimestral      | 26,99 €/3 meses       | Igual que el Pase                                                                                       |
| Pase anual           | 89,99 €/año           | Igual que el Pase                                                                                       |
| Pase VIP             | 19,99 €/mes           | Pase + Quién te ha dado like, Prioridad, Incógnito, 1 Foco + 3 Chispas + 2 Mensajes directos por semana |
| Pase de una noche    | 2,99 € (hasta 06:00)  | Ventajas del Pase esa noche + 1 Foco                                                                    |
| Chispa ×1 / ×5 / ×15 | 1,49 / 4,99 / 11,99 € | Like destacado; la otra persona recibe «Alguien ha sentido la chispa»                                   |
| Foco                 | 3,99 €                | 30 min primero en los swipes de tu local (con check-in) o de tu ciudad                                  |
| Mensaje directo      | 1,99 €                | Escribir sin match (no si su semáforo es rojo); llega como solicitud                                    |

Además: «Canjear código» promocional (`XXXX-XXXX-XXXX`), «Mi suscripción» (cancelar en 2
toques, reactivar, portal de Stripe con facturas y métodos de pago, desistimiento con importe
calculado: créditos solo si no se ha usado ninguno; suscripciones y pase de una noche,
prorrateo), una sola suscripción activa a la vez.

### 1.7 Reservas y listas (sin pago)

| Funcionalidad                                                                                            | Tipo |
| -------------------------------------------------------------------------------------------------------- | ---- |
| «Reservar mesa» en la ficha: día, hora, personas, mesa o mesa con botella (de 30 min a 14 días vista)    | V    |
| Límites: 3 reservas activas y 1 por local y noche                                                        | V    |
| «Lista de invitados» de esta noche: «Apuntarme» / «Salir de la lista»                                    | V    |
| Mis reservas (`/reservas`): estado, motivo del local, cancelar; QR + código `NL-XXXXX-XXXXX` por entrada | V    |

### 1.8 Apariencia y ajustes

5 temas base gratis (Neon Noir, Cyberpunk, Velvet, Sunset, Mono) + Gold/Sapphire con Pase;
idioma ES/EN; «Reducir movimiento»; Ajustes › Cuenta (añadir/cambiar email); PWA instalable con
aviso sin conexión.

---

## 2. Flujos del cliente en la app

Rutas entre paréntesis. «Perfil ›» = pestaña Perfil.

**F-C1 · Alta.** `/welcome` › Empezar › fecha de nacimiento › leer y marcar las 3 casillas ›
Firmo y acepto › prefijo + móvil › Enviar código › código de 6 dígitos › (email opcional) ›
consentimientos (activar «Orientación» abre la hoja de firma «Firmo y consiento»; sin ubicación
hay que elegir ciudad) › perfil (nombre, género, 2-5 fotos) › preferencias › tema › «Entrar en
la noche» → `/home`.

**F-C2 · Entrar.** `/welcome` › Ya tengo cuenta (`/login`) › «Entrar con email» (código al email
verificado) o «Entrar con SMS». Salir: Perfil › Cuenta › Cerrar sesión.

**F-C3 · Verificar la edad.** Al intentar una acción **V** aparece «Verifica tu edad» › Verificar
ahora, o Perfil › Centro de verificación › Mayoría de edad › Verificar (`/verification/age`) ›
«Continuar la verificación» (Veriff TEST, documento + selfie) o «Usar simulación de prueba»
(`/verification/sandbox`: Aprobado / No concluyente / Rechazado) › vuelve a
`/profile/verification`. Si falla: «Pedir revisión humana» (un admin la resuelve).
Foto: Centro › Foto verificada › consentimiento › «Hacer el selfie» (simulador: Aprobado /
Coincidencia dudosa / Rechazado). Identidad: igual con su consentimiento.

**F-C4 · Explorar.** Inicio (`/home`) › ciudad › tocar un local → ficha (`/places/:id`).
Descubre (`/discover`) › buscar / Todo-Locales-Eventos / Filtros › «Ver resultados» › pin →
ficha (hoja inferior) · «Ver como lista». Marcador = favorito (Inicio › Tus locales favoritos).

**F-C5 · Salir esta noche.** Ficha › «Esta Noche Voy» (se marca «Voy esta noche ✓») o «Estoy
Aquí» (celebración y «Estás aquí hasta las HH:MM»; lejos → aviso de 150 m y, si eres tester,
«Simular que estoy aquí»). «Salir de aquí» termina el check-in.

**F-C6 · Contar cómo está.** Con check-in: ficha › «Cómo está ahora» (4 preguntas de un toque) y
«Vibe Check» (una opción). Objetos perdidos › Publicar aviso / Responder / Editar / Borrar.

**F-C7 · Eventos.** Descubre › «Crear evento» (`/events/new`) › nombre, tipo, lugar público,
inicio/fin, «Confirmo que es un lugar público» › Publicar. Otros: ficha del evento › «Confirmo
que existe (n/3)» o «Reportar».

**F-C8 · Ligar.** Esta Noche (`/tonight`) › «Aquí Ahora» (lugares donde tienes check-in/hay gente)
o «Esta Noche Voy» › lugar › swipe (`/tonight/swipe/:placeId`), o «Todo el mundo cerca»
(`/tonight/swipe`) › deslizar o botones Me gusta / Paso / Deshacer › match → «Escribir ahora»
(rompehielo editable) o «Seguir mirando». Corazón / «Quién te ha dado like» (`/tonight/likes`).
Ver perfil (`/people/:id`) › Reportar / Bloquear / «Mensaje directo».

**F-C9 · Chatear.** Chats (`/chats`) › «Nuevos matches» / «Conversaciones» › chat
(`/chats/:id`) › escribir › Enviar. Menú: Eliminar match / Bloquear / Reportar.

**F-C10 · Mi perfil y privacidad.** Perfil › Tu perfil (fotos, bio, semáforo, modo discreto,
Anthem, Incógnito si VIP) · Preferencias · Centro de verificación · Consentimientos
(`/profile/consents`) · Privacidad y datos (`/profile/privacy`) · SOS (`/profile/sos`) ·
Temas (`/profile/themes`) · Ajustes (`/profile/settings`) · Mis reservas · Guía · Legal ·
Contacto. Documentos firmados (`/profile/documents`) y Moderación (`/profile/moderation`).

**F-C11 · Comprar.** Perfil › Premium (`/premium`) › plan o extra › Confirmar compra
(`/premium/checkout/:code`) con precio, IVA, renovación, condiciones y la casilla «Quiero
empezar ya…» › Suscribirme y pagar / Pagar › Stripe Checkout (TEST) › retorno
(`/premium/return`: «Confirmando el pago» → «¡Pago completado!»). Gestionar: Mi suscripción
(`/premium/subscription`). Código: Canjear código (`/premium/redeem`).

**F-C12 · Usar ventajas.** Swipe › «Enviar Chispa (saldo)»; «Activar Foco · 30 minutos» en la
pantalla de swipe; «Deshacer»; Perfil › Modo Incógnito (VIP); Temas › Gold/Sapphire; Perfil de
otra persona › «Mensaje directo».

**F-C13 · Reservar y lista.** Ficha › «Reservas y lista de invitados» › Reservar mesa › Solicitar
reserva, o Lista de invitados › Apuntarme › Perfil › Mis reservas (`/reservas`) › enseñar QR en
la puerta.

**F-C14 · Seguridad.** Reportar desde perfil/chat · SOS · Moderación › Recurrir · Privacidad ›
Descargar mis datos / Solicitar un derecho / Cerrar todas las sesiones / Eliminar mi cuenta
(código OTP).

---

## 3. Funcionalidades del local

Un local es una cuenta normal con el rol `venue_manager` sobre uno o varios locales
(`venue_managers`, papel **Titular** u **Encargado**). Se entra por Perfil › Locales y equipo ›
**Panel de locales** (`/venue`).

### 3.1 Acceso al panel

| Vía                   | Cómo                                                                                                                |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Reclamar (claim)      | Buscar el local + prueba en texto (≥ 10 caracteres) + aceptar Condiciones para Locales → un admin aprueba → Titular |
| Invitación de partner | Admin crea empresa + contrato e «Invitar al titular» → enlace `/invitacion/<código>` (1 uso, 7 días) → Titular      |
| Invitación de equipo  | El Titular crea «Invitar encargado» → el encargado canjea el código → Encargado                                     |
| Asignación directa    | Admin › Usuarios › «Dar gestor de local» (rol global; el vínculo al local sale del claim o la invitación)           |

### 3.2 Funciones del panel (gratis)

| Funcionalidad                                                                                                                                                                | Quién               |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------- |
| Estadísticas: afluencia media por hora (semana), edad media, % en verde, check-ins de la semana, «Van esta noche» (umbral 5)                                                 | Titular y encargado |
| Ficha: descripción, horario, precio                                                                                                                                          | Titular y encargado |
| Evento oficial (sale «Oficial» sin confirmaciones)                                                                                                                           | Titular y encargado |
| Música y ambiente: hasta 3 estilos + line-up de esta noche (caduca solo) + resumen de lo que vota la gente                                                                   | Titular y encargado |
| En directo: puerta (sin cola, poca, larga, casi lleno, completo; 90 min) y ofertas «entrada gratis hasta» / «happy hour hasta» (máx. 8 h)                                    | Titular y encargado |
| Ficha del local: dress code, edad mínima, precio de entrada y de copa, terraza, accesible                                                                                    | Titular y encargado |
| Fotos: 3 gratis (10 con patrocinio o Pro), revisadas por el admin, portada                                                                                                   | Titular y encargado |
| Resultados (30 días): vistas, «Voy», check-ins, conversión «Voy» → check-in, efecto de patrocinios y Flash                                                                   | Titular y encargado |
| Reservas y lista de invitados: ajustes, solicitudes (aceptar/rechazar con motivo), lista de esta noche, **Puerta** (escanear QR o teclear código; cada entrada vale una vez) | Titular y encargado |
| Plan y ventajas: empresa, contrato, ventajas activas con su origen (contrato/tarjeta/factura), Condiciones aceptadas                                                         | Titular y encargado |
| Equipo: invitar encargados (máx. 5 pendientes, 10 miembros), anular invitación, quitar encargado                                                                             | **Solo titular**    |

Reglas: el gestor no vota «Cómo está ahora» en su local, no puede reservar en su local y sus
vistas de la ficha no cuentan en Resultados.

### 3.3 Funciones de pago del local (Stripe TEST, B2B sin desistimiento)

| Producto         | Precio TEST | Qué da                                                                                                    |
| ---------------- | ----------- | --------------------------------------------------------------------------------------------------------- |
| Destacado        | 29 € / 30 d | Pin con etiqueta «Patrocinado» + tarjeta del local en el swipe (máx. 1/10; no la ven quienes tienen Pase) |
| Destacado Plus   | 49 € / 30 d | + primeras posiciones en listas (máx. 2 arriba y 1 de cada 5, solo si cumple los filtros)                 |
| Top              | 79 € / 30 d | Precede a Plus + **Flash Alerts** de 1 h a adultos verificados con consentimiento de promociones          |
| Estadísticas Pro | 19,99 €/mes | Detalle por hora/edad/semáforo, comparativa con locales a 5 km, evolución por noche; gestión en el Portal |

Patrocinio: pago único de 30 días, 3 plazas por ciudad con reserva de 24 h, sin renovación
automática; también por contrato (no ocupa plaza) o por factura manual (flag de autoservicio
apagado). Pro: suscripción mensual que solo gestiona quien la contrató.

---

## 4. Flujos del local en la app

**F-L1 · Reclamar.** Perfil › Locales y equipo › Panel de locales (`/venue`) › «Reclamar un
local» › Busca tu local › «Cómo acreditas que lo gestionas» (≥ 10 caracteres) › aceptar
Condiciones para Locales › Enviar solicitud → «En revisión». Admin (otro socio) › Locales y
claims › Aprobar (con nota) → en `/venue` aparece en «Tus locales».

**F-L2 · Invitación de partner.** Abrir el enlace `/invitacion/<código>` › «Crear cuenta» o «Ya
tengo cuenta» › tras el alta/login, Panel › «Tengo un código de invitación»
(`/venue/invitacion`) › Comprobar código › ver local, empresa y papel › aceptar Condiciones ›
«Aceptar y unirme».

**F-L3 · Gestionar.** `/venue` › local (`/venue/:id`) › tarjetas: Plan y ventajas, Equipo,
Estadísticas, Estadísticas Pro, Ficha, Música y ambiente, En directo, Ficha del local, Fotos,
Resultados, Evento oficial, Reservas y lista de invitados, Patrocinio, Flash Alerts.

**F-L4 · Equipo.** Equipo › «Invitar encargado» › copiar enlace/código (se muestra una vez) →
el encargado lo canjea (F-L2) → aparece en el equipo · «Anular» / «Quitar».

**F-L5 · Contratar.** Patrocinio › elegir nivel › fechas › Solicitar patrocinio › Stripe
Checkout TEST › «Activado tras confirmar el pago en Stripe». Pro › contratar › Stripe › «Gestionar
suscripción Pro» (Portal).

**F-L6 · Flash Alert.** (con Top activo) Flash Alerts › título + mensaje › «Publicar durante una
hora» → aparece en la ficha del local para quien cumple las reglas.

**F-L7 · Puerta.** Reservas y lista › activar «Abrir listas de invitados» › Lista de esta noche
(título, «Válida hasta», plazas) › Abrir lista › en la puerta: «Escanear QR» o teclear el código ›
Validar → «X puede entrar» / «ya se usó a las HH:MM» / «Código no válido».

---

## 5. Funcionalidades del admin

Perfil › Locales y equipo › **Admin** (`/admin`), rol admin + TOTP en cada sesión.

| Sección                | Qué permite                                                                                                                                                                                              |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard              | Usuarios, verificados, matches hoy, ingresos test, pendientes (reportes, verificaciones, claims, derechos)                                                                                               |
| Verificaciones         | Revisión humana de casos dudosos (no la propia)                                                                                                                                                          |
| Moderación             | Reportes y DSA: Avisar / Suspender / Prohibir acceso / Desestimar / Escalar riesgo grave (nota obligatoria)                                                                                              |
| Apelaciones            | Aceptar / Rechazar (revisor distinto de quien decidió)                                                                                                                                                   |
| Bans                   | Levantar ban                                                                                                                                                                                             |
| Locales y claims       | Aprobar / Rechazar claims (no el propio)                                                                                                                                                                 |
| Eventos                | Ocultar / Borrar / Restaurar                                                                                                                                                                             |
| Patrocinios            | Activar con factura manual / Finalizar                                                                                                                                                                   |
| Pagos                  | Catálogo, suscripciones, entitlements, eventos de pago, crear código promo, conceder entitlement                                                                                                         |
| Feature flags          | Cambiar flags al momento (auditado); muestra el paywall resultante                                                                                                                                       |
| Herramientas de prueba | Generar ciudad de prueba, Llenar un local, Que me den like, Mensajes de prueba, Webhook de Stripe, Webhook de Yoti, Adelantar caducidades, Importar eventos, Reiniciar likes, Simular suspensión, Purgar |
| Derechos               | Solicitudes RGPD (plazo 1 mes) → Marcar como resuelta                                                                                                                                                    |
| Documentos legales     | Versiones; publicar una nueva obliga a todos a reaceptar (**no lo toquéis en las pruebas**)                                                                                                              |
| Configuración          | Límites (likes gratis, umbral, radio, mínimo de personas, confirmaciones, ventana de strikes, plazas) y Proveedores (Mapbox)                                                                             |
| Auditoría              | Registro inmutable de acciones de admin                                                                                                                                                                  |
| Usuarios               | Dar/Quitar tester, gestor de local, admin (teléfonos enmascarados)                                                                                                                                       |
| Locales                | Catálogo: buscar, crear/editar, importar OSM/CSV, catálogo de prueba, «Llenar con 25», eventos de prueba                                                                                                 |
| Partners               | Empresas (CIF/NIF), locales vinculados, contratos (borrador → activo → terminado), invitar titular                                                                                                       |
| Fotos de locales       | Aprobar / Rechazar con motivo / Retirar                                                                                                                                                                  |
| Riesgo grave           | Registrar actuación y referencia del aviso a las autoridades                                                                                                                                             |

---

## 6. Acceso: cuándo SMS, cuándo email, cuándo biometría, cuándo OAuth

Resumen: **el SMS es obligatorio solo para crear la cuenta** (y para borrarla). Para volver a
entrar se usa el **código por email** si la cuenta tiene un email verificado, y el SMS si no.
Mientras no se cierra sesión, la app **no vuelve a pedir nada**. La **biometría** solo existe en
la app nativa y es un candado del móvil sobre la sesión ya abierta, no un login. **OAuth
(Google/Apple) no existe hoy.** El admin añade siempre un **TOTP**.

### 6.1 Qué se pide en cada momento

| Momento                                                                         | Qué se pide                                                  | Dónde en la app                                 | Notas                                                                                                                       |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------ | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Crear la cuenta                                                                 | **SMS** (código de 6 dígitos)                                | Alta › «Tu teléfono»                            | Siempre. Antes de enviar se comprueban bans (hash del teléfono y del dispositivo) y límites: 20/h por IP y 5/h por teléfono |
| Añadir email en el alta o después                                               | **Enlace** de confirmación al email                          | Alta (email opcional) o Ajustes › Cuenta        | Es un enlace, no un código. Hasta confirmarlo sale «Sin confirmar»                                                          |
| Abrir la app con la sesión guardada                                             | **Nada**                                                     | —                                               | La sesión se guarda y se renueva sola (`persistSession` + `autoRefreshToken`)                                               |
| Abrir la **app nativa** con el bloqueo activado                                 | **Biometría** (Face ID, huella o PIN del móvil)              | Pantalla «Nightlife Connect está bloqueada»     | Al abrir en frío y al volver tras 30 s o más en segundo plano                                                               |
| Volver a entrar tras cerrar sesión, en otro móvil/navegador o tras borrar datos | **Código por email** si hay email verificado; si no, **SMS** | `/login`: «Entrar con email» o «Entrar con SMS» | Email requiere `email_login_enabled = on` (está on) y el SMTP de Supabase Auth configurado                                  |
| iPhone: pasar de Safari a la PWA instalada (o al revés)                         | Login otra vez (email o SMS)                                 | `/login`                                        | iOS guarda la sesión de Safari y la de la PWA por separado                                                                  |
| Entrar en Admin                                                                 | Login normal + **TOTP** (app autenticadora)                  | Admin › «Segundo factor»                        | En cada sesión nueva. La primera vez se configura con un QR                                                                 |
| Eliminar la cuenta                                                              | **SMS** al teléfono de la cuenta                             | Privacidad y datos › Eliminar mi cuenta         | Siempre SMS, aunque hayas entrado por email o tengas biometría                                                              |
| Cerrar todas las sesiones                                                       | Nada                                                         | Privacidad y datos › Sesiones                   | Cierra también la de este dispositivo                                                                                       |
| Cambiar de teléfono                                                             | —                                                            | No existe en la app                             | Hueco frente al PRD 6.15 A07 (ver D5). Hoy habría que crear otra cuenta                                                     |
| Pagar                                                                           | Lo que pida Stripe (3D Secure del banco)                     | Stripe Checkout                                 | No es un login de la app                                                                                                    |
| Verificar la edad / identidad                                                   | Documento + selfie en Veriff (o simulación)                  | Centro de verificación                          | No es un login de la app; no cambia la sesión                                                                               |
| Entrar con Google o Apple                                                       | —                                                            | No existe                                       | Ver §6.5                                                                                                                    |

### 6.2 SMS

- **Cuándo:** alta (obligatorio), login de respaldo y reautenticación para borrar la cuenta.
- **Por qué es obligatorio en el alta:** una cuenta por teléfono y bans por hash del teléfono. Por
  eso nunca se crean cuentas por email (`shouldCreateUser: false`).
- **Pantalla:** prefijo + número › «Enviar código» › 6 dígitos › «Verificar». «Reenviar código»
  tras una cuenta atrás; «Cambiar número».
- **Errores que veréis:** «El código no es correcto», «El código ha caducado. Pide otro»,
  «Demasiados intentos…», «Has pedido demasiados códigos. Espera unos minutos», «No podemos
  completar el alta con este número» (baneado).
- **Coste:** cada SMS real se paga al proveedor. En pruebas, números de prueba de Supabase Auth
  (gratis, código fijo).

### 6.3 Código por email

- **Cuándo:** para volver a entrar sin SMS. Se ofrece primero en `/login`; «Entrar con SMS»
  queda a un toque.
- **Requisitos:** email añadido **y confirmado** en la cuenta (hoy solo 1 de vuestras 3 cuentas
  lo tiene), flag `email_login_enabled = on` y SMTP propio + plantilla con `{{ .Token }}` en
  Supabase Auth (`docs/AUTH_EMAIL.md`).
- **Comportamiento:** código de 6 dígitos (no enlace mágico, para que en iPhone no se abra Safari
  en vez de la PWA); caduca a los 10 minutos según la configuración propuesta. La respuesta es la
  misma exista o no el email, y nunca entra con un email que no sea de una cuenta.
- **Coste:** prácticamente cero (Gmail del proyecto, unos 500 envíos/día).

### 6.4 Biometría (Face ID / huella)

- **Solo en la app nativa** (Android probada en emulador; iOS pendiente de compilar en un Mac,
  Bloque 12). En la web y en la PWA **no aparece**: el navegador no ofrece biometría a la app
  (no hay passkeys/WebAuthn).
- **Qué es y qué no:** un candado local sobre la sesión ya guardada en el Keychain/Keystore del
  móvil. **No crea sesión, no da roles ni ventajas y el servidor no se entera.** Si cierras
  sesión, la biometría no te hace entrar: hay que usar email o SMS.
- **Activar:** Perfil › Ajustes › Seguridad › «Desbloquear con Face ID o huella». La sección
  solo sale si el móvil tiene biometría **o** PIN/código. Al activar pide la huella; si se cancela
  o falla: «No se ha podido confirmar tu identidad. No se ha activado».
- **Cuándo la pide:** siempre al abrir la app en frío y al volver de segundo plano tras **30 s o
  más**. Por debajo de 30 s no (permisos, hoja de compartir, el propio aviso de huella).
- **Pantalla bloqueada:** «Nightlife Connect está bloqueada · Desbloquéala con Face ID, huella o
  el código de tu móvil» con «Desbloquear» y «Cerrar sesión». La app sigue cargada debajo
  (un mensaje a medio escribir no se pierde), pero tapada e inactiva.
- **Alternativa:** el PIN, patrón o código del móvil sirve igual que la huella.
- **Si la biometría desaparece** (borras huellas y PIN con el bloqueo activo): la app se queda
  cerrada por seguridad: «La biometría ya no está disponible en este móvil. Cierra sesión y
  vuelve a entrar con tu código».
- **Cerrar sesión desactiva el bloqueo.** Al volver a entrar hay que activarlo otra vez.
- **Es por dispositivo:** activarlo en un móvil no lo activa en otro; la sesión no se copia en
  las copias de seguridad.
- **No sustituye:** al TOTP del admin ni al SMS de borrar cuenta; los pagos siguen en Stripe.
- **Coste:** cero.

### 6.5 OAuth (Google / Apple)

- **Estado:** no implementado. No hay botones ni proveedores configurados en Supabase Auth.
- **Decisión registrada** (`ROADMAP_2026-10.md`): opcional más adelante y con vuestro permiso,
  porque son terceros nuevos (PRD 3.5). Si se ofrece Google en iOS, Apple exige ofrecer también
  «Iniciar sesión con Apple», que requiere la cuenta de desarrollador de Apple (Bloque 12).
- **Cómo encajaría sin romper las reglas:** solo como forma rápida de **volver a entrar**,
  vinculada a una cuenta creada antes con SMS. Nunca para crear cuentas sin teléfono, porque
  se perderían «una cuenta por teléfono» y los bans por hash.
- **Coste:** gratis con Google; Apple necesita la cuota anual de desarrollador.

### 6.6 Matriz por dispositivo

| Dispositivo                     | Sesión guardada en                 | SMS | Email | Biometría        | OAuth |
| ------------------------------- | ---------------------------------- | --- | ----- | ---------------- | ----- |
| Navegador (móvil o PC)          | Almacenamiento del navegador       | Sí  | Sí    | No               | No    |
| PWA instalada en Android        | Almacenamiento de Chrome           | Sí  | Sí    | No               | No    |
| PWA instalada en iPhone         | Propio de la PWA (no el de Safari) | Sí  | Sí    | No               | No    |
| App Android (APK de pruebas)    | Keystore                           | Sí  | Sí    | **Sí**           | No    |
| App iOS (pendiente de compilar) | Keychain                           | Sí  | Sí    | **Sí** (Face ID) | No    |

### 6.7 Casos de prueba de acceso

Biometría: en la app Android (APK de `docs/NATIVE.md`) en un móvil real o en el emulador
(Ajustes del emulador › Seguridad › añadir PIN y huella; para «tocar» la huella: Extended
controls › Fingerprint › Touch).

| ID     | Pasos                                                                                    | Resultado esperado                                                                        |
| ------ | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| AUT-01 | Alta de D: solo con el SMS                                                               | Cuenta creada; ningún paso pide email obligatorio                                         |
| AUT-02 | Cerrar el navegador o la app y volver a abrir al día siguiente                           | Entra directamente, sin códigos                                                           |
| AUT-03 | iPhone: con sesión en Safari, instalar la PWA y abrirla                                  | Pide login en la PWA (sesión separada); es lo esperado                                    |
| AUT-04 | Cerrar sesión › «Entrar con email» con una cuenta **sin** email confirmado               | Mismo mensaje «Si … es el email verificado…»; no llega nada; «Entrar con SMS» funciona    |
| AUT-05 | Ajustes › Cuenta › añadir email › abrir el enlace                                        | Pasa de «Pendiente de confirmar» a «Verificado»                                           |
| AUT-06 | Cerrar sesión › «Entrar con email» › código                                              | Entra sin SMS                                                                             |
| AUT-07 | Código de email pasados 10 minutos                                                       | «El código ha caducado. Pide otro»                                                        |
| AUT-08 | Email mal escrito (`ana@`)                                                               | «Revisa el email»                                                                         |
| AUT-09 | Login SMS: «Reenviar código» antes de la cuenta atrás; luego código erróneo varias veces | El botón espera a la cuenta atrás; tras varios fallos «Demasiados intentos…»              |
| AUT-10 | Entrar en Admin sin TOTP configurado (B o C)                                             | QR para configurarlo; después pide el código de 6 dígitos                                 |
| AUT-11 | Cerrar sesión, entrar por email y abrir Admin                                            | Vuelve a pedir el TOTP (nueva sesión)                                                     |
| AUT-12 | Cuenta E entrando por email › Eliminar mi cuenta                                         | Pide el código **por SMS** al teléfono de la cuenta                                       |
| AUT-13 | Móvil 1 › Privacidad › Cerrar todas las sesiones                                         | Móvil 2 con la misma cuenta pide login al siguiente uso                                   |
| AUT-14 | Web y PWA › Perfil › Ajustes                                                             | No existe la sección «Seguridad» (biometría)                                              |
| AUT-15 | App Android en un móvil sin huella ni PIN                                                | Tampoco aparece la sección «Seguridad»                                                    |
| AUT-16 | App Android › activar el interruptor › cancelar la huella                                | «No se ha podido confirmar tu identidad. No se ha activado»; el interruptor sigue apagado |
| AUT-17 | Activar con huella › cerrar la app del todo › abrirla                                    | Pantalla bloqueada; con la huella entra                                                   |
| AUT-18 | Segundo plano 10 s y volver; luego 40 s y volver                                         | A los 10 s no pide nada; a los 40 s pide la huella                                        |
| AUT-19 | Escribir un mensaje en un chat sin enviarlo › 40 s en segundo plano › desbloquear        | El mensaje a medio escribir sigue ahí                                                     |
| AUT-20 | Fallar la huella › usar el PIN del móvil                                                 | Entra con el PIN                                                                          |
| AUT-21 | En la pantalla bloqueada › «Cerrar sesión»                                               | Sale de la cuenta; hay que entrar con email o SMS                                         |
| AUT-22 | Con el bloqueo activo, quitar huellas y PIN del móvil › abrir la app                     | «La biometría ya no está disponible en este móvil…»; solo deja cerrar sesión              |
| AUT-23 | Cerrar sesión desde Perfil con el bloqueo activo › volver a entrar                       | El bloqueo está desactivado; hay que activarlo de nuevo                                   |
| AUT-24 | Misma cuenta en la app Android de otro móvil                                             | Ese móvil no tiene el bloqueo hasta activarlo allí                                        |
| AUT-25 | Buscar «Entrar con Google/Apple» en la bienvenida y en `/login`                          | No existe (estado actual)                                                                 |
| AUT-26 | Alta con el teléfono de una cuenta baneada (tras SEG-08)                                 | «No podemos completar el alta con este número»                                            |

---

## 7. Preparación de las pruebas

### 7.1 Reparto de papeles

Con 3 socios se cubre casi todo; 2 cuentas extra (números de prueba) completan los casos que
exigen un 4.º reportador, un usuario normal o una cuenta que se pueda borrar/banear.

| Cuenta | Quién                    | Papel en las pruebas                                                                                        |
| ------ | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| **A**  | Socio 1                  | Admin principal (operador): crea la empresa, el contrato y las invitaciones; cliente en el resto de pruebas |
| **B**  | Socio 2                  | **Titular** del local P (por invitación de partner) y portero en la lista; admin revisor de lo que haga A   |
| **C**  | Socio 3                  | Cliente que liga + admin revisor; **Encargado** de P hasta EQU-06 y **Titular** del local R por claim       |
| **D**  | Cuenta extra (nº prueba) | Usuario «normal»: primero **sin** tester (vista pública), luego con tester (4.º reportador)                 |
| **E**  | Cuenta extra (nº prueba) | Desechable: suspensión, ban, eliminar cuenta                                                                |

Locales para las pruebas (todos en Madrid salvo que creéis uno donde estéis):

- **Local P** (partner): uno real del catálogo o uno nuevo creado en Admin › Locales, vinculado
  a una empresa de prueba («Empresa de prueba» marcada) con contrato.
- **Local R** (claim): otro local del catálogo que reclamará C.
- **Local X** (físico, opcional): creado con las coordenadas del bar/casa donde os juntéis, para
  probar el check-in real a 150 m sin simulación.

Apuntad los nombres exactos de los locales que uséis para deshacer todo al final (§10).

### 7.2 Checklist de preparación

| ✔   | Paso                                                                                                                                                                          |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ☐   | Supabase › Auth › Phone: añadir números de prueba para D y E (y los que queráis de más)                                                                                       |
| ☐   | Cada socio en su móvil; a ser posible 1 Android (Chrome) y 1 iPhone para cubrir el QR y la PWA                                                                                |
| ☐   | A, B y C entran en Admin y configuran el TOTP los que no lo tengan                                                                                                            |
| ☐   | A, B y C revisan Perfil › Preferencias, semáforo verde, sin modo discreto y **ciudad Madrid** (o la misma ciudad)                                                             |
| ☐   | Si hace falta para que os veáis entre vosotros, ajustar «Me interesa» y el rango de edad temporalmente                                                                        |
| ☐   | A, B y C con consentimiento de Orientación firmado (Perfil › Consentimientos) y C con «Promociones y Flash Alerts» activado                                                   |
| ☐   | Tarjetas Stripe TEST a mano: `4242 4242 4242 4242` (OK), `4000 0025 0000 3155` (3D Secure), `4000 0000 0000 9995` (fondos insuficientes); fecha futura, CVC y CP cualesquiera |
| ☐   | Comprobar que ninguno de vosotros tiene ya una suscripción activa (Perfil › Premium › Mi suscripción); una de las cuentas tiene 9 entitlements de pruebas anteriores          |
| ☐   | Anotar la hora: «Esta Noche Voy» es de 18:00 a 06:00 (los testers pueden fuera de hora); listas válidas hasta las 06:00                                                       |
| ☐   | Hoja compartida de incidencias (plantilla en §10)                                                                                                                             |

---

## 8. Casos de prueba E2E

Formato: **ID · Quién · Pasos → Resultado esperado**. Marcad ✅/❌ y anotad incidencias.

### 8.1 Web pública (sin sesión) — cualquiera, en una ventana de incógnito

| ID     | Pasos                                                                            | Resultado esperado                                                                               |
| ------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| PUB-01 | Abrir la URL                                                                     | Bienvenida con slides, «Empezar», «Ya tengo cuenta», «Cómo funciona», «Para locales»             |
| PUB-02 | «Cómo funciona» y «Para locales»                                                 | `/guia` y `/guia/locales` con índice por secciones, sin pedir login                              |
| PUB-03 | `/legal`: abrir cada documento                                                   | Aviso legal, Términos, Normas, Privacidad, Cookies, Transparencia, Locales, Patrocinio, Terceros |
| PUB-04 | `/legal/illegal-content`: enviar con un enlace externo y luego con uno de la app | Rechaza el externo; acepta el propio y conserva los datos si falla                               |
| PUB-05 | `/legal/contact` y `/legal/delete-account`                                       | Se ven sin login                                                                                 |
| PUB-06 | Ir a `/home`, `/chats`, `/admin` sin sesión                                      | Redirige a bienvenida/login                                                                      |
| PUB-07 | Cambiar idioma (pie público)                                                     | Todo en inglés y vuelta a español                                                                |
| PUB-08 | Ruta inexistente `/xyz`                                                          | Página 404                                                                                       |

### 8.2 Alta y acceso — cuenta D (y E)

| ID     | Pasos                                                   | Resultado esperado                                                                              |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| ALT-01 | Empezar › fecha de un menor                             | «No podemos crear tu cuenta. No hemos guardado ningún dato»                                     |
| ALT-02 | Fecha adulta › «No acepto»                              | «Sin aceptar no podemos continuar» + «Revisar los documentos»                                   |
| ALT-03 | Comprobar las 3 casillas                                | Ninguna viene marcada; «Firmo y acepto» no avanza sin las 3                                     |
| ALT-04 | Teléfono de prueba › código erróneo                     | «El código no es correcto»                                                                      |
| ALT-05 | Código correcto + email (opcional)                      | Avanza; llega un enlace para verificar el email (si SMTP está configurado)                      |
| ALT-06 | Consentimientos: activar Orientación                    | Hoja «Consentimiento explícito» › «Firmo y consiento»; el resto apagados por defecto            |
| ALT-07 | Sin ubicación y sin ciudad                              | «Elige una ciudad o activa la ubicación»                                                        |
| ALT-08 | Perfil con 1 foto                                       | «Añade al menos 2 fotos»; con 2 avanza                                                          |
| ALT-09 | Preferencias › tema › «Entrar en la noche»              | Entra en Inicio                                                                                 |
| ALT-10 | Cerrar sesión › Ya tengo cuenta › Entrar con SMS        | Entra de nuevo                                                                                  |
| ALT-11 | Entrar con email con un email no registrado             | Misma respuesta que uno registrado y nunca entra                                                |
| ALT-12 | (cuenta con email verificado) Entrar con email › código | Entra sin SMS                                                                                   |
| ALT-13 | «Ya tengo cuenta» con un número que no terminó el alta  | «Este número no tiene una cuenta terminada» + «Completar el alta» / «Usar otro número»          |
| ALT-14 | Perfil › Ajustes › Cuenta: añadir/cambiar email         | «Te hemos enviado un enlace…»; email usado por otra cuenta → «Ese email ya está en otra cuenta» |
| ALT-15 | Perfil › Documentos firmados                            | Aparecen los documentos y el PDF                                                                |

### 8.3 Usuario normal sin tester — cuenta D antes de darle tester

| ID     | Pasos                                                         | Resultado esperado                                                                      |
| ------ | ------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| NOR-01 | Perfil › Premium                                              | «Próximamente» + «Avísame»; sin consentimiento de promociones pide activarlo            |
| NOR-02 | Activar promociones y «Avísame»                               | Queda registrado                                                                        |
| NOR-03 | Esta Noche › Ver perfiles                                     | «Verifica tu edad» › Verificar ahora › «La verificación no está disponible ahora mismo» |
| NOR-04 | Ficha de un local con check-in lejos                          | Aviso de 150 m **sin** botón «Simular»                                                  |
| NOR-05 | Mientras haya datos de prueba (tras SIM-01): Descubre / swipe | No ve perfiles, check-ins ni eventos `is_test`                                          |
| NOR-06 | Perfil                                                        | No aparece «Admin»                                                                      |
| NOR-07 | A: Admin › Usuarios › D › «Dar tester»; D recarga             | D ya ve el checkout y puede verificarse                                                 |

### 8.4 Verificaciones — D (ya tester), E, A/B/C para revisar

| ID     | Pasos                                                                         | Resultado esperado                                                                      |
| ------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| VER-01 | D: Ficha › Esta Noche Voy                                                     | Puerta «Verifica tu edad para marcar Esta Noche Voy»                                    |
| VER-02 | D: Verificar › «Continuar la verificación» (Veriff TEST, **antes del 16/10**) | Abre Veriff; al terminar vuelve a la app «En curso» hasta que llega la decisión firmada |
| VER-03 | Decisión en Veriff Station (Nightlife TEST) aprobada                          | Centro de verificación: Mayoría de edad «Verificado» (tras «Actualizar estado»)         |
| VER-04 | E: Verificar › «Usar simulación de prueba» › Rechazado                        | «No superada» + «Pedir revisión humana»                                                 |
| VER-05 | E: «Pedir revisión humana»; A: Admin › Verificaciones › Aprobar (nota)        | E queda verificado (`human_review`); A no puede aprobar una suya (error)                |
| VER-06 | E: simulación «No concluyente»                                                | Pide documento con selfie                                                               |
| VER-07 | B: Foto verificada › consentimiento › «Hacer el selfie» › Aprobado            | Badge ✓ en su perfil y en sus tarjetas                                                  |
| VER-08 | B: simulación de foto «Coincidencia dudosa (60-85 %)»                         | «En revisión humana» → otro admin decide                                                |
| VER-09 | B: cambiar la foto principal                                                  | El badge de foto se revalida (vuelve a pedirse)                                         |
| VER-10 | C: Identidad verificada › consentimiento › simulación Aprobado                | «Identidad verificada»; nunca se muestra nombre real ni DNI                             |
| VER-11 | Admin › Herramientas › «Webhook de Yoti» (sobre una cuenta sin verificar)     | Marca la edad como verificada                                                           |

### 8.5 Explorar — cualquiera

| ID     | Pasos                                                                       | Resultado esperado                                                         |
| ------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| EXP-01 | Inicio › cambiar ciudad, «Cerca de mí» (con ubicación) y «Cerca del centro» | Mosaico de 5 cercanos, rankings y favoritos se actualizan                  |
| EXP-02 | Inicio sin consentimiento de ubicación                                      | No pide GPS; usa el centro de la ciudad                                    |
| EXP-03 | Descubre: mapa real, zoom, centrar                                          | Mapa nocturno con pines; si se agota la cuota, «Mapa de prueba» con aviso  |
| EXP-04 | Buscar un local por nombre y por calle                                      | Resultados correctos                                                       |
| EXP-05 | Todo / Locales / Eventos y cada filtro + cada orden                         | Lista coherente; «No hay nada con estos filtros» si no hay resultados      |
| EXP-06 | «Ver como lista» / «Ver mapa»                                               | Cambia de vista                                                            |
| EXP-07 | Tocar un pin                                                                | Vuela la cámara y abre la ficha                                            |
| EXP-08 | Ficha con < 5 personas                                                      | «Menos de 5 personas»; sin edad media, ratio ni % verde                    |
| EXP-09 | Marcar favorito y quitarlo                                                  | Aparece/desaparece en Inicio › Tus locales favoritos; persiste al recargar |
| EXP-10 | Cambiar de tema en Perfil › Temas (los 5) y «Reducir movimiento»            | Cambio instantáneo; con reducir movimiento solo fundidos                   |

### 8.6 Presencia en directo — A, B, C en el mismo local (P o X)

| ID     | Pasos                                                                                                          | Resultado esperado                                                                     |
| ------ | -------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| PRE-01 | A: «Estoy Aquí» estando a < 150 m del local X (sin simular)                                                    | Celebración y «Estás aquí hasta las HH:MM» (2 h)                                       |
| PRE-02 | B: «Estoy Aquí» lejos                                                                                          | «Tienes que estar a menos de 150 m…» + «Simular que estoy aquí (pruebas)»              |
| PRE-03 | B: «Simular que estoy aquí»                                                                                    | Check-in hecho                                                                         |
| PRE-04 | C con la ficha abierta mientras A hace check-in                                                                | «Quién hay» se actualiza en < 5 s en el móvil de C                                     |
| PRE-05 | A: check-in en otro local                                                                                      | El anterior se cierra (solo uno activo)                                                |
| PRE-06 | A: «Salir de aquí»                                                                                             | Termina el check-in                                                                    |
| PRE-07 | C: «Esta Noche Voy» en P                                                                                       | «Voy esta noche ✓»; «Van esta noche» sube; fuera de 18-06 sale la nota de modo pruebas |
| PRE-08 | A: Admin › Herramientas › «Generar ciudad de prueba» y Admin › Locales › «Llenar con 25» en un local de prueba | El local muestra edad media, ratio y % en verde (≥ 5)                                  |
| PRE-09 | B activa modo discreto y hace check-in                                                                         | Cuenta en las estadísticas pero no sale en «Aquí Ahora» de A ni C                      |
| PRE-10 | D sin edad verificada hace check-in                                                                            | «Check-in invisible hasta que verifiques tu edad»                                      |

### 8.7 «Cómo está ahora», Vibe Check y objetos perdidos — A, C y D con check-in en P; B es el titular

| ID     | Pasos                                                                                   | Resultado esperado                                                        |
| ------ | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| VIV-01 | Sin check-in: abrir «Cómo está ahora»                                                   | «Haz check-in aquí para responder»                                        |
| VIV-02 | A, C y D (D con «Simular») responden Gente/Cola/Música                                  | Con 1-2 votos «Aún pocos votos»; con 3, porcentajes                       |
| VIV-03 | Cambiar una respuesta                                                                   | Se actualiza sin duplicar                                                 |
| VIV-04 | B (titular de P) intenta votar en P                                                     | «Gestionas este local: no puedes votar en él»                             |
| VIV-05 | Titular guarda estilos y line-up (F-L3)                                                 | En la ficha: «El local dice: …» y «Esta noche: …» junto a «La gente dice» |
| VIV-06 | Vibe Check: votar y cambiar                                                             | Resultado agregado                                                        |
| VIV-07 | Objetos perdidos: publicar (> 280 caracteres y luego normal), responder, editar, borrar | Rechaza > 280; el resto funciona                                          |
| VIV-08 | D (sin check-in en las últimas 12 h) intenta publicar                                   | «Necesitas haber hecho check-in aquí en las últimas 12 horas»             |
| VIV-09 | Admin › Herramientas › «Adelantar caducidades»                                          | Caducan check-ins y objetos perdidos de prueba                            |

### 8.8 Eventos — A crea, B y C confirman, D/E reportan

| ID     | Pasos                                                                    | Resultado esperado                                                           |
| ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| EVT-01 | A: Crear evento sin marcar «lugar público»                               | No deja publicar                                                             |
| EVT-02 | A: Publicar evento                                                       | Aparece «No confirmado (1/3)» con aviso de seguridad                         |
| EVT-03 | A: crear el mismo evento otra vez                                        | «Ya existe un evento parecido…»                                              |
| EVT-04 | A: crear 2 más el mismo día                                              | El 3.º: «Ya has creado 2 eventos hoy»                                        |
| EVT-05 | B y C: «Confirmo que existe»                                             | 2/3 → 3/3 → «Confirmado»; repetir → «Ya lo has confirmado»                   |
| EVT-06 | B crea un evento; A, C y D lo reportan «Es falso»                        | Con 3 reportes «falso» se oculta («En revisión»); aparece en Admin › Eventos |
| EVT-07 | Admin › Eventos: Restaurar / Borrar                                      | Cambia el estado                                                             |
| EVT-08 | Evento sin confirmar + Herramientas › «Adelantar caducidades»            | Los de prueba sin confirmar desaparecen (24 h simuladas)                     |
| EVT-09 | Titular publica «Evento oficial» desde el panel                          | Sale como «Oficial» y «Organizado por el local» sin confirmaciones           |
| EVT-10 | Herramientas › «Importar eventos de prueba» (requiere locales de prueba) | 3 eventos «Confirmado» de «Agenda pública», solo visibles para testers       |

### 8.9 Ligar — B y C (y A), con preferencias compatibles

| ID     | Pasos                                                                                                     | Resultado esperado                                                                 |
| ------ | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| LIG-01 | B y C con check-in en P › Esta Noche › Aquí Ahora › P                                                     | Cada uno ve al otro con el badge «Aquí Ahora» y «Lugar en común»                   |
| LIG-02 | Lo mismo con «Esta Noche Voy» en P (sin check-in)                                                         | Se ven en el modo «Esta Noche Voy»                                                 |
| LIG-03 | «Todo el mundo cerca» con la misma ciudad                                                                 | Se ven sin estar en ningún local                                                   |
| LIG-04 | Arrastrar despacio y soltar                                                                               | La tarjeta se inclina, sellos con opacidad progresiva y vuelve con efecto elástico |
| LIG-05 | Tocar los laterales de la foto                                                                            | Cambia de foto con indicador                                                       |
| LIG-06 | B da like a C; C da like a B **a la vez** (contando 3-2-1)                                                | Un solo match; los dos ven la animación «¡Match en P!» a la vez                    |
| LIG-07 | Match con «Voy» y sin check-in                                                                            | Título «¡Los dos vais a P esta noche!»                                             |
| LIG-08 | Editar un rompehielos › Enviar                                                                            | El mensaje llega al chat del otro                                                  |
| LIG-09 | Chat: escribir sin enviar / enviar / abrir el chat el otro                                                | «está escribiendo», «Enviado» → «Leído», mensaje en tiempo real                    |
| LIG-10 | Más de 100 mensajes (o chat largo) › «Cargar mensajes anteriores»                                         | Carga el historial                                                                 |
| LIG-11 | A (sin Pase) da 5 likes                                                                                   | «Te quedan N likes hoy» → «Has usado tus likes de hoy» con «Próximamente»/Premium  |
| LIG-12 | Herramientas › «Reiniciar likes»                                                                          | Vuelve a tener 5                                                                   |
| LIG-13 | A: Herramientas › «Que me den like» (tras generar personas de prueba)                                     | Un perfil de prueba da like; al devolverlo, match en directo                       |
| LIG-14 | A: Herramientas › «Enviar mensajes de prueba»                                                             | El último match escribe                                                            |
| LIG-15 | C pone semáforo amarillo                                                                                  | B lo ve con «Solo amistad»                                                         |
| LIG-16 | C pone semáforo rojo                                                                                      | C desaparece de los swipes de B; los chats siguen                                  |
| LIG-17 | B activa «Solo verificados»                                                                               | Solo perfiles con foto verificada                                                  |
| LIG-18 | B: corazón / Quién te ha dado like (sin Premium)                                                          | Número con candado, sin identidades ni fotos                                       |
| LIG-19 | C: Eliminar match con B                                                                                   | Desaparece el match y la conversación para los dos                                 |
| LIG-20 | Rehacer match; B bloquea a C                                                                              | Se dejan de ver al instante (swipe, listas «Aquí» y chats), match borrado          |
| LIG-21 | Ver el perfil de otra persona (`/people/:id`) y el Anthem (Perfil › Anthem: guardar y reproducir muestra) | Perfil con badges; muestra sintética reproducible                                  |
| LIG-22 | Ver «Has visto a todos los de aquí»                                                                       | Estado vacío con lugares cercanos con gente                                        |

### 8.10 Premium y pagos (Stripe TEST) — A, B, C

Cada compra: Confirmar compra (comprobar precio, IVA, renovación, condiciones y casilla «Quiero
empezar ya…» obligatoria) › Stripe Checkout › tarjeta `4242…` › retorno «Confirmando el pago» →
«¡Pago completado!» › Mi suscripción.

| ID     | Quién | Pasos                                                                                                                 | Resultado esperado                                                                                       |
| ------ | ----- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| PAY-01 | A     | Comprar sin marcar la casilla «Quiero empezar ya…»                                                                    | No deja continuar                                                                                        |
| PAY-02 | A     | Stripe: cancelar en la pasarela                                                                                       | «Pago cancelado. No se ha cobrado nada»                                                                  |
| PAY-03 | A     | Pagar con `4000 0000 0000 9995`                                                                                       | Stripe rechaza; no se conceden ventajas                                                                  |
| PAY-04 | A     | Comprar **Pase** con `4242…`                                                                                          | Ventajas: «Likes ilimitados», Deshacer, temas Gold/Sapphire, sin tarjetas patrocinadas                   |
| PAY-05 | A     | Intentar comprar otra suscripción                                                                                     | «Ya tienes una suscripción activa»                                                                       |
| PAY-06 | A     | Deshacer el último swipe                                                                                              | La tarjeta vuelve (animación de rebobinado)                                                              |
| PAY-07 | B     | Comprar **Pase VIP** con 3D Secure (`4000 0025 0000 3155`)                                                            | Tras autenticar: ver quién te ha dado like, Incógnito, Prioridad, saldo 1 Foco · 3 Chispas · 2 Mensajes  |
| PAY-08 | B     | Quién te ha dado like                                                                                                 | Perfiles visibles (Chispas primero)                                                                      |
| PAY-09 | B     | Perfil › Modo Incógnito                                                                                               | Solo le ven aquellos a quienes da like y sus matches                                                     |
| PAY-10 | B     | Swipe › «Enviar Chispa» a C                                                                                           | C recibe «Alguien ha sentido la chispa»; saldo −1; si ya hay match no gasta                              |
| PAY-11 | B     | «Activar Foco · 30 minutos» con check-in en P                                                                         | «Foco activo hasta las HH:MM»; B sale primero en los swipes de P; otro Foco → «Ya tienes un Foco activo» |
| PAY-12 | B     | Foco en un local sin check-in ni «Voy»                                                                                | «Para activar el Foco aquí, indica que estás en este local…»                                             |
| PAY-13 | B     | Perfil de C (sin match) › «Mensaje directo»                                                                           | Llega como solicitud con etiqueta «Mensaje directo»; saldo −1                                            |
| PAY-14 | C     | C con semáforo rojo; B intenta mensaje directo                                                                        | «Esta persona tiene el semáforo en rojo…»                                                                |
| PAY-15 | C     | Comprar **Pase de una noche**                                                                                         | «Pase de una noche activo hasta las 06:00» + 1 Foco                                                      |
| PAY-16 | C     | Comprar **1 Chispa**; desistir sin usarla                                                                             | Hoja con importe completo; reembolso y Chispa retirada del saldo                                         |
| PAY-17 | C     | Comprar **5 Chispas**, usar 1, intentar desistir                                                                      | «Ya has usado créditos de esta compra…»                                                                  |
| PAY-18 | A     | Mi suscripción › Cancelar suscripción                                                                                 | «Termina el DD/MM. No se renovará»; ventajas hasta fin de periodo                                        |
| PAY-19 | A     | Reactivar renovación                                                                                                  | «Se renueva el DD/MM»                                                                                    |
| PAY-20 | A     | «Facturas y métodos de pago en Stripe»                                                                                | Abre el Portal de Stripe (TEST) con la factura                                                           |
| PAY-21 | A     | Desistir y pedir reembolso                                                                                            | Hoja «Te devolveremos X de Y» (prorrateo) › Confirmar → ventajas terminan, factura «reembolsada»         |
| PAY-22 | B     | Comprar Foco, Pase trimestral, Pase anual, 15 Chispas (los que falten de los 14)                                      | Cada uno abre Checkout y concede lo suyo                                                                 |
| PAY-23 | A     | Admin › Pagos › Crear código (Pase, 7 días, 1 uso); D lo canjea en Canjear código                                     | «¡Listo! Tienes Pase durante 7 días»; segundo uso → «Ese código ya se ha usado»                          |
| PAY-24 | D     | Canjear códigos inventados varias veces                                                                               | «Ese código no es válido» y, tras muchos, «Demasiados intentos»                                          |
| PAY-25 | A     | Admin › Pagos › Conceder entitlement (`see_likes`, 1 día) a C                                                         | C ve quién le ha dado like; aparece en Admin › Entitlements                                              |
| PAY-26 | A     | Admin › Herramientas › «Webhook de Stripe»                                                                            | Simula un VIP confirmado (marcado como simulado)                                                         |
| PAY-27 | A     | Flags: `payments_audience = none` → B abre Premium; volver a `testers`                                                | Nadie ve el pago (oculto/«Próximamente»); las ventajas ya compradas siguen                               |
| PAY-28 | A     | Flags: `paywall_visibility = hidden` y luego `coming_soon` (con D sin tester, o mirando «Paywall resultante para ti») | «Todo gratis por ahora» / «Próximamente»                                                                 |
| PAY-29 | A     | Admin › Pagos › Eventos de pago                                                                                       | Cada webhook aparece una vez (idempotencia)                                                              |

### 8.11 Seguridad y moderación — B, C, D reportan; E es el objetivo

| ID     | Pasos                                                                                               | Resultado esperado                                                                          |
| ------ | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| SEG-01 | B reporta a E («Acoso», comentario)                                                                 | «Una persona revisará el reporte»; en Moderación de B: «En revisión»                        |
| SEG-02 | A: Admin › Moderación › reporte de B › Avisar (nota ≥ 5 caracteres)                                 | E ve el aviso explicado en Perfil › Moderación; el reporte de B deja de estar «En revisión» |
| SEG-03 | C y D reportan a E en menos de 6 h; A valida cada uno con «Avisar»                                  | Al 3.er reportador distinto validado → **suspensión automática**; E ve «Cuenta suspendida»  |
| SEG-04 | E: Moderación › Recurrir (≥ 10 caracteres)                                                          | «Apelación en revisión»                                                                     |
| SEG-05 | A intenta resolver la apelación (fue quien decidió)                                                 | Error: revisor independiente; B la acepta → se levanta la suspensión                        |
| SEG-06 | Reporte «Posible menor» sobre E validado                                                            | E debe repetir la verificación por documento («Hay que repetirla»)                          |
| SEG-07 | Admin › Moderación › «Escalar riesgo grave»                                                         | Aparece en Riesgo grave para registrar actuación y referencia                               |
| SEG-08 | **Ban** (solo E): Prohibir acceso                                                                   | E fuera; el alta con su teléfono queda bloqueada; Admin › Bans › Levantar ban la recupera   |
| SEG-09 | Reporte «Me siento seguido/a»                                                                       | Llega a moderación                                                                          |
| SEG-10 | Admin › Herramientas › «Simular suspensión» (sobre el propio admin)                                 | Pantalla de cuenta suspendida; Admin sigue accesible para revertir                          |
| SEG-11 | SOS: añadir 3 contactos (un 4.º no se permite), quitar uno, «Avisar a un contacto», «Llamar al 112» | Comparte el texto o lo copia; abre la llamada (no completarla)                              |
| SEG-12 | Formulario público de contenido ilegal (PUB-04) → Admin › Moderación                                | Aparece el aviso DSA                                                                        |

### 8.12 Privacidad y derechos — D y E

| ID     | Pasos                                                         | Resultado esperado                                                                                                     |
| ------ | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| PRI-01 | Privacidad y datos › Descargar mis datos                      | JSON con perfil, consentimientos, check-ins, reservas (sin códigos), etc.                                              |
| PRI-02 | Solicitar Rectificación / Oposición / Limitación              | «Responderemos en un mes»; en el historial con fecha límite; A lo resuelve en Derechos                                 |
| PRI-03 | Consentimientos: revocar Orientación                          | Deja de ver/aparecer en swipes; volver a firmar lo restablece                                                          |
| PRI-04 | Cerrar todas las sesiones                                     | Sale en todos los dispositivos                                                                                         |
| PRI-05 | **E**: Eliminar mi cuenta › código › Eliminar definitivamente | Cuenta borrada; matches/mensajes desaparecen para los demás; suscripciones Stripe canceladas; no puede volver a entrar |

### 8.13 Local por claim — C reclama el local R, A aprueba

| ID     | Pasos                                                                           | Resultado esperado                                                                        |
| ------ | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| CLA-01 | C: Panel › Reclamar › prueba de 5 caracteres                                    | No deja enviar (mínimo 10)                                                                |
| CLA-02 | C: sin aceptar Condiciones para Locales                                         | «Acepta las Condiciones para Locales para enviar la solicitud»                            |
| CLA-03 | C: envía bien                                                                   | «Solicitud enviada para R»; estado «En revisión»; repetir → «Ya has reclamado este local» |
| CLA-04 | C (admin) intenta aprobar su propio claim                                       | Error                                                                                     |
| CLA-05 | A: Admin › Locales y claims › Rechazar con nota; C vuelve a reclamar; A Aprueba | C ve el rechazo explicado; tras aprobar, R en «Tus locales» como Titular                  |
| CLA-06 | C: Ficha (descripción, horario, precio) › guardar                               | Se ve en la ficha pública de R                                                            |
| CLA-07 | C: Estadísticas con < 5 personas y tras «Llenar» (si es local de prueba)        | Sin edad/semáforo por debajo de 5                                                         |

### 8.14 Escaparate del local — titular de P o R

| ID     | Pasos                                                                           | Resultado esperado                                                       |
| ------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| ESC-01 | Fotos › Añadir foto (JPG/PNG/WebP)                                              | «Pendiente de revisión»; no se ve en la ficha                            |
| ESC-02 | Subir un formato no admitido / foto enorme                                      | Error de formato / tamaño                                                |
| ESC-03 | Otro admin: Fotos de locales › Aprobar una y Rechazar otra con motivo           | Aprobada en la ficha; el local ve «Rechazada · Motivo: …»                |
| ESC-04 | «Usar como portada»                                                             | La portada sustituye a la ilustración en lista, mapa y ficha             |
| ESC-05 | Subir una 4.ª foto sin plan                                                     | «Has llegado al límite de fotos de tu plan» (3; 10 con patrocinio o Pro) |
| ESC-06 | En directo: «Poca cola» + «Entrada gratis hasta 01:30» › Publicar; luego Quitar | En la ficha «Lo dice el local»; hora fuera de 8 h → error                |
| ESC-07 | Ficha del local: dress code, edad mínima, entrada 0 €, copa, terraza, accesible | Chips en la ficha («Entrada gratis», «Terraza»…)                         |
| ESC-08 | Resultados: B y C abren la ficha, marcan «Voy» y hacen check-in                 | Con < 5 «Menos de 5»; las vistas del propio gestor no cuentan            |

### 8.15 Patrocinio, Flash Alerts y Estadísticas Pro — titular de R (C), clientes A/B/D

| ID     | Pasos                                                                                                                      | Resultado esperado                                                                                           |
| ------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| SPO-01 | C: Patrocinio › Destacado › fechas › Solicitar › Stripe `4242…`                                                            | «Activo» tras el pago; pin con «Patrocinado» en el mapa                                                      |
| SPO-02 | D (sin Pase) cerca de R hace swipes (≥ 10)                                                                                 | Como mucho 1 tarjeta «Patrocinado» de R cada 10; «Ver local»                                                 |
| SPO-03 | A (con Pase) hace swipes                                                                                                   | No ve tarjetas patrocinadas                                                                                  |
| SPO-04 | C sube a Plus (otro local o al terminar) y D filtra listas                                                                 | R arriba solo si cumple los filtros; máx. 2 arriba y 1 de cada 5                                             |
| SPO-05 | Con Top: Flash Alerts › título + mensaje › Publicar durante una hora                                                       | En la ficha de R lo ven B/D con edad verificada **y** consentimiento de promociones; A sin consentimiento no |
| SPO-06 | Flash marcando «Incluye promoción de alcohol»                                                                              | «No se pudo publicar…» (`flash_alcohol_allowed = off`)                                                       |
| SPO-07 | Flash sin patrocinio Top                                                                                                   | No permitido                                                                                                 |
| SPO-08 | 4.º patrocinio de pago en Madrid con 3 activos                                                                             | Sin plaza disponible («No se ha podido abrir el pago…»)                                                      |
| SPO-09 | Flag `sponsorship_self_service_enabled = off` › solicitar › Admin › Patrocinios › Activar con nº de factura; volver a `on` | «Te enviaremos la factura…» → activo con origen factura                                                      |
| SPO-10 | C: Estadísticas Pro › contratar › Stripe                                                                                   | «Estadísticas Pro activas»: por hora/edad/semáforo, comparativa 5 km, evolución por noche                    |
| SPO-11 | C invita a B como encargado de R (Equipo); B abre la gestión de Pro                                                        | «La suscripción la gestiona la cuenta que la contrató»                                                       |
| SPO-12 | C: «Gestionar suscripción Pro» › Portal › cancelar                                                                         | Mantiene el acceso hasta fin de periodo                                                                      |
| SPO-13 | C intenta desistir de un patrocinio en Mi suscripción                                                                      | Sin botón de desistimiento (B2B)                                                                             |
| SPO-14 | Resultados de R tras el patrocinio/Flash                                                                                   | Fila del patrocinio con «Durante / Mismos días antes» y fila del Flash                                       |

### 8.16 Partners, contratos, invitaciones y equipo — A admin, B titular de P, C encargado

| ID     | Pasos                                                                                                     | Resultado esperado                                                                                                                                              |
| ------ | --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PAR-01 | A: Admin › Partners › Nueva empresa con CIF mal formado                                                   | «Revisa los datos: CIF/NIF español válido…»                                                                                                                     |
| PAR-02 | A: empresa válida (p. ej. CIF `B12345678`), marcar «Empresa de prueba»                                    | Guardada con etiqueta «Prueba»; repetir CIF → «Ya existe una empresa con ese CIF/NIF»                                                                           |
| PAR-03 | A: Locales › buscar P › Vincular                                                                          | P vinculado; vincularlo a otra empresa → «Ese local ya pertenece a otra empresa»                                                                                |
| PAR-04 | A: Contratos › Nuevo (referencia, Destacado Plus + Estadísticas Pro, fechas) › Crear (borrador) › Activar | Contrato «Activo»                                                                                                                                               |
| PAR-05 | A: «Invitar al titular»                                                                                   | Código y enlace (solo se muestran una vez; 1 uso; caduca en 7 días)                                                                                             |
| PAR-06 | B abre el enlace `/invitacion/<código>` en su móvil                                                       | «Te han invitado a gestionar un local» › Ya tengo cuenta / Continuar                                                                                            |
| PAR-07 | B: canjear sin aceptar las Condiciones                                                                    | «Tienes que aceptar las Condiciones para Locales»                                                                                                               |
| PAR-08 | B: aceptar › «Aceptar y unirme»                                                                           | P en «Tus locales»; Plan y ventajas: empresa, contrato, «Destacado Plus · incluido en tu contrato», «Estadísticas Pro · incluido en tu contrato», papel Titular |
| PAR-09 | D intenta usar el mismo código                                                                            | «El código no es válido, ha caducado o ya se ha usado»                                                                                                          |
| PAR-10 | Ficha pública de P                                                                                        | Patrocinado (sin ocupar plaza de la ciudad); Pro: «Incluido en tu contrato»; hasta 10 fotos                                                                     |
| EQU-01 | B: Equipo › Invitar encargado › copiar enlace                                                             | Invitación pendiente «Encargado · caduca el …»                                                                                                                  |
| EQU-02 | C canjea el código del encargado                                                                          | C entra como Encargado de P                                                                                                                                     |
| EQU-03 | C (encargado): editar ficha, música, evento, reservas                                                     | Puede                                                                                                                                                           |
| EQU-04 | C (encargado) busca «Invitar encargado» / quitar miembros                                                 | No le aparece (solo titular)                                                                                                                                    |
| EQU-05 | B: crear 6 invitaciones pendientes                                                                        | La 6.ª: «Has llegado al máximo de invitaciones pendientes (5)…»; Anular libera hueco                                                                            |
| EQU-06 | B: Quitar a C                                                                                             | C pierde el acceso a P                                                                                                                                          |
| EQU-07 | A: Anular una invitación pendiente de titular                                                             | Estado «Anulada»; su enlace deja de valer                                                                                                                       |
| PAR-11 | A: Terminar el contrato                                                                                   | Desaparecen las ventajas de contrato; las fotos por encima de 3 se ocultan (no se borran)                                                                       |

### 8.17 Reservas y lista de invitados con QR — B (titular de P) en la puerta, A/C/D clientes

C tiene que haber dejado de ser encargado de P (EQU-06); si no, el sistema no le deja reservar
ni apuntarse en P. Recomendado: el que hace de **portero con un Android** (Chrome) para escanear; un cliente con
iPhone para enseñar el QR.

| ID     | Pasos                                                                                                                | Resultado esperado                                                                   |
| ------ | -------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| RES-01 | Con el local sin activar: ficha de P como cliente                                                                    | «Este local no acepta reservas ahora mismo» / sin lista                              |
| RES-02 | Gestor: Reservas › activar «Aceptar solicitudes de reserva» y «Abrir listas de invitados», máx. 6 personas › Guardar | «Guardado»                                                                           |
| RES-03 | A: Reservar mesa con hora dentro de 10 min                                                                           | Rechazo (mínimo 30 min vista)                                                        |
| RES-04 | A: Reservar mesa con 8 personas                                                                                      | Rechazo por máximo del local                                                         |
| RES-05 | A: Reservar mesa con botella, mañana 23:30, 4 personas                                                               | «Solicitud enviada»; Mis reservas: «Pendiente»                                       |
| RES-06 | A: otra reserva en P esa misma noche                                                                                 | «Ya tienes una reserva en este local esa noche»                                      |
| RES-07 | A: reservas en 3 locales distintos y una 4.ª                                                                         | «Ya tienes 3 reservas activas»                                                       |
| RES-08 | Gestor: Solicitudes › Aceptar la de A                                                                                | A ve «Aceptada» en Mis reservas (el gestor solo ve nombre, personas y hora)          |
| RES-09 | D reserva; gestor › Rechazar con motivo «Completo»                                                                   | D ve «Rechazada · Motivo: Completo»                                                  |
| RES-10 | A: Cancelar reserva                                                                                                  | «Cancelada»                                                                          |
| RES-11 | Gestor intenta reservar en su propio local                                                                           | «Es tu local: gestiona las reservas desde tu panel»                                  |
| RES-12 | Gestor: Lista de esta noche › título «Entrada gratis antes de la 1:30», válida hasta 01:30, 3 plazas › Abrir lista   | Lista abierta «0 de 3 apuntados · 0 han entrado»                                     |
| RES-13 | Hora límite más allá de las 06:00                                                                                    | No se permite (texto del aviso: ver D2)                                              |
| RES-14 | A, C y D: Apuntarme                                                                                                  | «Estás en la lista. Tu QR está en Mis reservas»; contador 3 de 3                     |
| RES-15 | E (o un 4.º) intenta apuntarse                                                                                       | «La lista está completa»                                                             |
| RES-16 | A: Mis reservas › QR y código `NL-XXXXX-XXXXX`                                                                       | QR visible + «Enséñalo en la puerta antes de las 01:30»                              |
| RES-17 | Portero (Android Chrome): Puerta › Escanear QR › apuntar al QR de A                                                  | «A puede entrar»; contador «1 han entrado»; A ve «Entrada usada»                     |
| RES-18 | Escanear otra vez el QR de A                                                                                         | «A: esta entrada ya se usó a las HH:MM»                                              |
| RES-19 | Portero (iPhone): Escanear QR                                                                                        | «Este dispositivo no puede escanear: teclea el código» → teclear el código de C → OK |
| RES-20 | Teclear un código inventado                                                                                          | «Código no válido para la lista de esta noche»                                       |
| RES-21 | Permiso de cámara denegado                                                                                           | «No se pudo abrir la cámara: teclea el código»                                       |
| RES-22 | D: Salir de la lista                                                                                                 | Libera plaza; su QR deja de valer                                                    |
| RES-23 | Gestor: Cerrar lista                                                                                                 | «Lista cerrada»; nadie más puede apuntarse                                           |
| RES-24 | D sin edad verificada intenta reservar                                                                               | «Para reservar o apuntarte a una lista necesitas la edad verificada»                 |
| RES-25 | Privacidad › Descargar mis datos (A)                                                                                 | Incluye reservas y entradas sin el código                                            |

### 8.18 Admin y configuración — A (y B como segundo admin)

| ID     | Pasos                                                                    | Resultado esperado                                               |
| ------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------- |
| ADM-01 | Entrar en Admin › código TOTP erróneo / correcto                         | «Código incorrecto» / entra                                      |
| ADM-02 | Dashboard                                                                | Contadores coherentes con lo hecho                               |
| ADM-03 | Configuración › Likes gratis = 3; probar; volver a 5                     | El límite cambia sin redesplegar                                 |
| ADM-04 | Configuración › Radio de check-in a 500 m; probar; volver a 150          | Check-in permitido a más distancia                               |
| ADM-05 | Feature flags: apagar `live_status_enabled`, ver la ficha; volver a `on` | La sección desaparece y vuelve sin perder votos                  |
| ADM-06 | Igual con `venue_bookings_enabled` y `venue_showcase_enabled`            | Las secciones desaparecen y vuelven con sus datos                |
| ADM-07 | Usuarios: Dar/Quitar tester y gestor a D                                 | D gana/pierde funciones al recargar; teléfonos enmascarados      |
| ADM-08 | Auditoría                                                                | Aparecen los cambios de flags, roles, decisiones y herramientas  |
| ADM-09 | Locales › Nuevo local (local X) con web sin https / edad 30              | Errores de validación; con datos válidos se guarda               |
| ADM-10 | Configuración › Proveedores                                              | Consumo de Mapbox («N / 1000 reservas este mes»)                 |
| ADM-11 | Herramientas › Purgar datos de prueba (al final)                         | Desaparecen solo los datos `is_test`; vuestros perfiles intactos |

### 8.19 PWA, dispositivos y app Android (opcional)

| ID     | Pasos                                                                                                 | Resultado esperado                                       |
| ------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| DEV-01 | Instalar la PWA (Android: «Instalar app»; iPhone: Compartir › Añadir a inicio)                        | Abre a pantalla completa con zonas seguras correctas     |
| DEV-02 | Modo avión con la app abierta y volver                                                                | Aviso sin conexión y recuperación con la sesión intacta  |
| DEV-03 | Publicar una versión nueva (o esperar la siguiente) con la app abierta                                | Aviso de actualización y recarga sin perder sesión       |
| DEV-04 | Girar el móvil, teclado abierto en el chat                                                            | Sin desbordes horizontales                               |
| DEV-05 | APK debug Android (ver `docs/NATIVE.md`): Ajustes › Seguridad › Face ID/huella; salir > 30 s y volver | Pide huella; cerrar sesión desactiva el bloqueo          |
| DEV-06 | App Android: escanear QR en la Puerta y abrir un enlace `com.nightlifeconnect.app://legal`            | Escanea con la cámara nativa; el enlace abre la pantalla |

---

## 9. Guion de una «noche de pruebas»

Propuesta para hacerlo en 2 sesiones con los 3 socios juntos (en el mismo bar = local X) y las
cuentas D y E en un móvil/portátil extra. Tiempo estimado: 3-4 h cada sesión.

**Sesión 1 (tarde, 18:00-22:00) — cuentas, local y verificación**

1. (15 min) Preparación §7.2: números de prueba D/E, TOTP de A/B/C, preferencias y ciudad.
2. (20 min) Web pública 8.1 y alta de D y E (8.2). D comprueba 8.3 sin tester; A le da tester.
3. (30 min) Verificaciones 8.4: D por Veriff real (antes del 16/10), E por simulación con
   rechazo + revisión humana; B foto; C identidad.
4. (20 min) A crea el local X con las coordenadas del bar (ADM-09). Partners 8.16: A crea
   empresa + P (= X) + contrato; B canjea como titular; C entra como encargado (EQU).
5. (20 min) C reclama R (8.13); A rechaza y luego aprueba.
6. (40 min) Escaparate 8.14 en P y R; patrocinio Destacado de R y Pro (8.15) con tarjetas TEST.
7. (30 min) Explorar 8.5 y eventos 8.8 (A crea, B y C confirman).
8. (30 min) Acceso §6.7: emails de A/B/C confirmados, login por email, TOTP en Admin y, con el
   móvil Android que tenga la app, todos los casos de biometría (AUT-14 a AUT-24).

**Sesión 2 (noche, 22:00-02:00) — la noche en directo**

1. (20 min) Presencia 8.6 en X sin simular: A, B y C hacen check-in de verdad; D sigue desde
   casa con «Simular» y mira cómo cambian los contadores.
2. (20 min) «Cómo está ahora», Vibe Check y objetos perdidos 8.7.
3. (40 min) Ligar 8.9: B y C hacen match a la vez, chat, semáforos, bloqueo; A agota likes.
4. (40 min) Premium 8.10: A Pase, B VIP (Chispa a C, Foco en X, mensaje directo), C pase de una
   noche y Chispas con desistimiento; códigos promo para D.
5. (30 min) Reservas y puerta 8.17: B (titular) abre lista «Entrada gratis antes de la 1:30»;
   A, C y D se apuntan; B escanea en la puerta con Android; iPhone teclea; repetición rechazada.
6. (20 min) Top + Flash Alert en R (8.15) visto por quien tiene consentimiento.
7. (30 min) Seguridad 8.11 con E (3 strikes con B, C y D; apelación; ban y levantar) y
   privacidad 8.12 (D exporta; E se elimina al final).
8. (15 min) Admin 8.18 y limpieza §10.

---

## 10. Limpieza y registro de incidencias

### 10.1 Limpieza tras las pruebas

| Qué                                              | Cómo                                                                       |
| ------------------------------------------------ | -------------------------------------------------------------------------- |
| Perfiles, check-ins, eventos y matches `is_test` | Admin › Herramientas › Purgar datos de prueba                              |
| Suscripciones TEST propias                       | Mi suscripción › Cancelar (o desistir); Pro desde el Portal                |
| Patrocinios de prueba                            | Admin › Patrocinios › Finalizar                                            |
| Contrato / empresa de prueba                     | Admin › Partners › Terminar contrato y desvincular locales                 |
| Gestores de locales                              | Panel › Equipo › Quitar; Admin › Usuarios › Quitar gestor                  |
| Fotos de locales                                 | Panel › Fotos › Borrar o Admin › Fotos › Retirar                           |
| Reservas y listas                                | Cancelar reservas y Cerrar lista                                           |
| Local X creado para la prueba                    | Admin › Locales › Quitar                                                   |
| Preferencias cambiadas para el match             | Volver a dejarlas como estaban                                             |
| Flags y ajustes tocados                          | Volver a los valores de §0.1                                               |
| Cuenta D / E                                     | E eliminada en PRI-05; D eliminar o quitar tester; levantar bans de prueba |
| Números de prueba de Auth                        | Quitarlos antes del lanzamiento (PRD 6.14)                                 |

### 10.2 Plantilla de incidencia

```text
ID del caso:        (p. ej. LIG-06)
Quién / cuenta:     (A, B, C, D, E)
Dispositivo:        (modelo, Android/iOS, Chrome/Safari/PWA/app)
Fecha y hora:
Pasos exactos:
Resultado esperado:
Resultado obtenido:
Captura / vídeo:
Gravedad:           (bloqueante · alta · media · baja)
```

Nunca pongáis en las incidencias códigos OTP, códigos de invitación, códigos de entrada de lista,
enlaces de Veriff/Stripe ni datos de tarjetas reales.
