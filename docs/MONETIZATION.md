# Monetización — aprobada (2026-10-02)

Análisis pedido por el propietario: cobrar como las apps de citas líderes (suscripciones por
niveles, compras sueltas y publicidad), pagando por Google Play / App Store, sin parecer una
copia y respetando el principio del PRD "Gratis al máximo: el pago aporta comodidad y ventaja,
nunca funciones básicas, verificaciones ni seguridad".

> Precios y comisiones de este documento son hipótesis a validar (mercado, gestoría y tarifas
> vigentes de las tiendas) antes de activar nada.

## 1. Dónde se cobra

| Canal                 | Cómo                                                                             | Comisión aproximada                                                                                                              | Cuándo                                  |
| --------------------- | -------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **App iOS / Android** | Compras dentro de la app de Apple y Google (obligatorio para ventajas digitales) | 15 % en el programa de pequeñas empresas de Apple (< 1 M$/año) y en todas las suscripciones de Google; hasta 30 % en otros casos | Cuando se empaqueten las apps (Anexo B) |
| **Web / PWA**         | Stripe (ya previsto en 6.13)                                                     | ~1,5 % + 0,25 € por tarjeta UE                                                                                                   | Desde el lanzamiento web                |
| **Locales (B2B)**     | Checkout y Portal de Stripe desde el panel web                                   | Stripe                                                                                                                           | Autoservicio TEST desde 05/10/2026      |

- **Recomendación:** web con Stripe + apps con las tiendas, con **un único catálogo** y los mismos
  entitlements (origen `stripe` / `apple` / `google`). La arquitectura ya lo permite (PRD 6.13).
  Si solo se cobra por tiendas, no habría ingresos hasta tener las apps publicadas.
- En las apps **no se enlaza a la web para pagar más barato** (las reglas de Apple y Google lo
  limitan; en la UE hay alternativas por la DMA, pero con comisiones y requisitos propios).
- Ventaja de las tiendas: Apple y Google son el vendedor. Ellos cobran, emiten la factura,
  liquidan el IVA y gestionan reembolsos y desistimientos de esas compras.
- **Validación de compras:** Edge Functions con las notificaciones de servidor de Apple (App Store
  Server Notifications v2) y Google (Real-time Developer Notifications) → entitlements.
  Alternativa más rápida: **RevenueCat** (unifica tiendas + web, tiene SDK para Capacitor;
  gratis hasta cierto volumen de ingresos y después un pequeño porcentaje). Es un tercero no
  listado en el PRD 3.5: **requiere tu permiso**.

## 2. Qué copiar, qué adaptar y qué descartar

| Idea de la competencia     | ¿Encaja?                  | Nuestra versión (nombre propio, ligada a la noche)                                                                        |
| -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Likes ilimitados           | ✅ Ya en el PRD           | `unlimited_likes`                                                                                                         |
| Deshacer                   | ✅ Ya en el PRD           | `undo`                                                                                                                    |
| Cambiar de ubicación       | ✅ Encaja muy bien        | **Modo viaje**: explora y aparece en otra ciudad antes de llegar (Ibiza, festivales, despedidas)                          |
| Ver quién te ha dado like  | ✅ Ya en el PRD           | `see_likes`                                                                                                               |
| Selección diaria destacada | ⏳ Más adelante           | Exige un buen ranking; se puede hacer por reglas más adelante ("Selección de la noche")                                   |
| Likes con prioridad        | ✅ Fácil                  | **Prioridad**: tus likes aparecen antes a la otra persona                                                                 |
| Mensaje antes del match    | ✅ Ya en el PRD           | `paid_dm`, respetando el semáforo rojo                                                                                    |
| Nivel por invitación       | ❌ Descartar              | Poco volumen y riesgo de imagen elitista                                                                                  |
| Boost                      | ✅ Ya en el PRD, mejorado | **Foco**: 30 min primero en los swipes **de tu local o zona esta noche**                                                  |
| Super Like                 | ✅ Adaptar                | **Chispa**: la otra persona recibe "alguien ha sentido la chispa"                                                         |
| Anuncios entre tarjetas    | ⚠️ Solo de locales        | **Tarjeta patrocinada de local** en el swipe (ver §4), nunca anuncios de terceros                                         |
| — (idea propia)            | ✅ Diferencial            | **Pase de una noche**: ventajas hasta las 06:00 por un pago único. Encaja con salir el finde sin atarse a una suscripción |

`advanced_filters` (PRD 6.11) choca con PRD 6.5 ("todos los filtros gratis"). **Propuesta:**
mantener todos los filtros gratis (genera confianza) y retirar `advanced_filters`.

## 3. Catálogo propuesto

| Producto              | Tipo                                                         | Incluye                                                                                                                        | Precio a validar |
| --------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | ---------------- |
| **Gratis**            | —                                                            | Mapa, estadísticas, eventos, buscador y filtros, verificaciones, seguridad, ver perfiles, chat, 5 likes/día                    | 0 €              |
| **Pase**              | Suscripción mensual (también trimestral/anual con descuento) | Likes ilimitados, Deshacer, Modo viaje, temas extra, sin tarjetas patrocinadas en el swipe                                     | ~9,99 €/mes      |
| **Pase VIP**          | Suscripción mensual                                          | Todo el Pase + Quién te ha dado like, Prioridad, Incógnito, 1 Foco/semana, 3 Chispas/semana, 2 mensajes antes del match/semana | ~19,99 €/mes     |
| **Pase de una noche** | Pago único, caduca a las 06:00                               | Ventajas del Pase + 1 Foco esa noche                                                                                           | ~2,99 €          |
| **Chispas**           | Consumible (packs 1 / 5 / 15)                                | Like destacado con aviso                                                                                                       | desde ~1,49 €    |
| **Foco**              | Consumible                                                   | 30 min destacado en tu local/zona                                                                                              | ~3,99 €          |
| **Mensaje directo**   | Consumible (`paid_dm`)                                       | Escribir sin match (no si su semáforo es rojo)                                                                                 | ~1,99 €          |

Las ventajas siguen siendo **entitlements** (suscripciones y pase de una noche) y **créditos**
(Chispas, Focos, mensajes) que solo el servidor puede escribir. Entitlements nuevos: `travel_mode`,
`priority_likes`, `no_sponsored_cards`; créditos: `spark`, `spotlight`, `paid_dm`.

## 4. Publicidad

- **AdSense es para webs**; en apps nativas el equivalente es AdMob u otras redes.
- **Recomendación: no usar redes de anuncios de terceros.**
  - Chocan con el PRD (sin scripts ni SDK de terceros, sin rastreo, CSP estricta).
  - Exigen otro banner de consentimiento (TCF) y rastrean a los usuarios en una app de citas
    con datos sensibles (orientación).
  - Afean el producto y dejan poco dinero por usuario en España.
- **Alternativa propia que ya encaja en el plan:** patrocinios de locales (PRD 6.11).
  - Pines patrocinados en el mapa.
  - Flash Alerts.
  - Nueva: **tarjeta patrocinada de local en el swipe** (máx. 1 de cada 10, siempre etiquetada,
    solo locales cercanos y abiertos, alcohol solo a mayores verificados y según la normativa
    autonómica). Son contextuales, se contratan por Stripe desde el panel y no rastrean a nadie.
  - Los suscriptores no ven las tarjetas del swipe; los pines patrocinados se mantienen
    porque son información.
- **Más B2B:** "Estadísticas Pro" para locales (afluencia por horas, edad media, comparativa
  con la zona; siempre agregado y con umbral) por suscripción mensual del local.

## 5. Encaje en el plan

| Bloque          | Cambio                                                                                                                                                                                                                 |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 4 (UI simulada) | Paywall, comparativa y checkout con este catálogo (Pase, VIP, Pase de una noche, Chispas, Foco, Mensaje), botón de compra según la plataforma (web = Stripe; app = tienda) y estado "Próximamente"                     |
| 8 (ligar)       | Chispa, Prioridad y Foco en el servidor (orden del swipe y avisos)                                                                                                                                                     |
| 9 (pagos test)  | Tablas de catálogo con IDs de producto de Stripe, Apple y Google; saldo de créditos; webhooks de Stripe                                                                                                                |
| **11 (nuevo)**  | **Apps nativas y tiendas**: Capacitor (Anexo B), compras en App Store y Google Play, notificaciones de servidor de las tiendas → entitlements, restaurar compras, fichas de las tiendas (18+, privacidad) y Modo viaje |

Flags: `store_payments_enabled` y `travel_mode_enabled` siguen off. En el cierre
autorizado del 05/10, `paid_dm_enabled`, `sponsored_cards_enabled` y
`sponsorship_self_service_enabled` pasan a on. Pagos TEST y audiencia de testers
siguen aislados; la web pública no recibe compras ni patrocinios TEST.

### Cierre web autorizado de los bloques 8/9 (2026-10-05)

Chispa, Foco, Prioridad e Incógnito tienen acción y autorización del servidor.
Foco usa el local con check-in vigente o la ciudad del perfil durante 30 min.
Se mantienen los cinco temas base gratuitos del PRD y se añaden Gold/Sapphire
para `premium_themes`. Las tarjetas de locales patrocinados son como máximo una
por cada diez decisiones, cercanas y abiertas; el Pase las elimina.

| Producto nuevo   | Precio provisional Stripe TEST | Periodo                   |
| ---------------- | ------------------------------ | ------------------------- |
| Chispa ×1        | 1,49 €                         | Consumible                |
| Chispas ×15      | 11,99 €                        | Consumible                |
| Pase trimestral  | 26,99 €                        | 3 meses, renovable        |
| Pase anual       | 89,99 €                        | 1 año, renovable          |
| Destacado        | 29 €                           | 30 días, pago único       |
| Destacado Plus   | 49 €                           | 30 días, pago único       |
| Top              | 79 €                           | 30 días, pago único       |
| Estadísticas Pro | 19,99 €                        | Mes, renovable, por local |

Los precios existentes se conservan. Destacado etiqueta el pin y admite tarjetas;
Plus añade prioridad en listados; Top precede a Plus y permite Flash a adultos
verificados con consentimiento comercial. Básicas de local gratis; Pro abre horas,
edad/semáforo y comparativa de zona a 5 km con umbrales de anonimato. Pro es
independiente de la suscripción personal. Cancelación/Portal corresponden al titular
del pago. Evidencias y límites: [BLOCK8_9_COMPLETION_TESTS.md](./BLOCK8_9_COMPLETION_TESTS.md).

No se activan cobros reales ni se aprueban estos importes como precios definitivos;
las puertas jurídicas, fiscales, de proveedor y coste siguen en el bloque 12.

## 6. Decisiones (aprobadas por el propietario: "lo que recomiendes")

1. Web con Stripe **y** apps con compras de App Store / Google Play, un único catálogo.
2. RevenueCat autorizado para el Bloque 11 (se revisa su tarifa vigente antes de integrarlo);
   si no compensa, validación propia con Edge Functions.
3. Catálogo y nombres: Pase, Pase VIP, Pase de una noche, Chispa, Foco, Mensaje directo, Modo viaje.
4. Sin anuncios de terceros; tarjetas patrocinadas de locales en el swipe web
   adelantadas al cierre de 8/9 por solicitud expresa del propietario (05/10/2026).
5. Todos los filtros gratis: se retira `advanced_filters`.
