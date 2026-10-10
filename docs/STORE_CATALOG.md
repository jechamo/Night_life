# Catálogo de tiendas — RevenueCat (Bloque 11b)

Un único catálogo para web (Stripe) y apps (App Store, Google Play; en pruebas, RevenueCat
Test Store). La tabla `plans` es la fuente de verdad: cada producto tiene su identificador de
Test Store (`store_product_test`, igual al código) y los identificadores live propuestos
(`apple_product_id`, `google_product_id`), que solo se usarán tras la puerta del Bloque 12.
Las ventajas y los créditos los concede el servidor (`store_apply`), nunca RevenueCat ni la app.

Estado comunicado por el propietario el 10/10/2026: catálogo creado en RevenueCat. Pendiente
de validarlo con «Comprobar catálogo», cotejar precios en el panel y ejecutar las compras
desde la app; casos manuales en [`GUIA_PRUEBAS_E2E.md`, §7.3 y §8.21](GUIA_PRUEBAS_E2E.md).

## Por qué los productos de Test Store se crean en el panel

La API v2 de RevenueCat crea productos, pero **no permite fijar el precio de Test Store**, y en
Test Store el precio no se puede editar después de crear el producto. Crearlos por API los
dejaría sin precio. Por eso se crean una vez en el panel (unos 10 minutos) y la app lo verifica
con Admin › Pagos › «Comprobar catálogo» (Edge Function `store-admin`, solo admin con MFA).

## Cómo crearlos

RevenueCat › proyecto `proj1484f178` › **Product catalog › Products › pestaña Test Store ›

- New**. Por cada fila: identificador exactamente igual, tipo, duración (solo suscripciones),
  precio en EUR y nombre. No hace falta offering ni entitlements de RevenueCat: el servidor mapea
  cada producto a sus ventajas.

| Identificador Test Store | Tipo         | Duración | Precio  | Nombre                   | Qué da (servidor)                                                                                   |
| ------------------------ | ------------ | -------- | ------- | ------------------------ | --------------------------------------------------------------------------------------------------- |
| `pass_monthly`           | Subscription | 1 mes    | 9,99 €  | Pase mensual             | Likes ilimitados, Deshacer, Modo viaje, temas, sin tarjetas patrocinadas                            |
| `pass_quarterly`         | Subscription | 3 meses  | 26,99 € | Pase trimestral          | Igual que el Pase                                                                                   |
| `pass_annual`            | Subscription | 1 año    | 89,99 € | Pase anual               | Igual que el Pase                                                                                   |
| `vip_monthly`            | Subscription | 1 mes    | 19,99 € | Pase VIP                 | Pase + Quién te ha dado like, Prioridad, Incógnito, Foco; 1 Foco, 3 Chispas y 2 Mensajes por semana |
| `one_night`              | Consumable   | —        | 2,99 €  | Pase de una noche        | Ventajas del Pase hasta las 06:00 + 1 Foco                                                          |
| `sparks_1`               | Consumable   | —        | 1,49 €  | 1 Chispa                 | 1 Chispa                                                                                            |
| `sparks_5`               | Consumable   | —        | 4,99 €  | 5 Chispas                | 5 Chispas                                                                                           |
| `sparks_15`              | Consumable   | —        | 11,99 € | 15 Chispas               | 15 Chispas                                                                                          |
| `spotlight_1`            | Consumable   | —        | 3,99 €  | Foco                     | 1 Foco (30 min destacado)                                                                           |
| `paid_dm_1`              | Consumable   | —        | 1,99 €  | Mensaje directo          | 1 mensaje antes del match                                                                           |
| `sponsor_featured`       | Consumable   | —        | 29 €    | Destacado (local)        | Patrocinio 30 días (reserva previa de plaza)                                                        |
| `sponsor_featured_plus`  | Consumable   | —        | 49 €    | Destacado Plus (local)   | Patrocinio Plus 30 días                                                                             |
| `sponsor_top`            | Consumable   | —        | 79 €    | Top (local)              | Patrocinio Top 30 días                                                                              |
| `venue_pro_monthly`      | Subscription | 1 mes    | 19,99 € | Estadísticas Pro (local) | Estadísticas Pro del local reservado                                                                |

Precios provisionales de la fase de pruebas (`MONETIZATION.md`); los definitivos y la fiscalidad
se aprueban en el Bloque 12. Los productos de locales exigen reservar antes desde el panel del
local (`store_start_venue_order`: gestor del local, cupos por ciudad y fechas, como con Stripe).

### Productos de pago añadidos entre los bloques 10 y 11 (revisados)

- Patrocinios Destacado, Plus y Top y Estadísticas Pro: incluidos arriba.
- Contratos y partners (R3): se facturan fuera de la app (contrato con el local); no son
  productos de tienda.
- Extras del escaparate (R4, más fotos) y reservas/lista de invitados (R5): no se venden por
  separado (llegan con patrocinio, Pro o contrato, o son gratis).

## Identificadores live (Bloque 12)

| Código               | App Store (propuesto)               | Google Play (propuesto)                          |
| -------------------- | ----------------------------------- | ------------------------------------------------ |
| cualquier `<código>` | `com.nightlifeconnect.app.<código>` | `<código>` (suscripción: `<código>:<base plan>`) |

Se crean en App Store Connect y Google Play Console con las cuentas de desarrollador, se
importan en RevenueCat y se activan con `payments_mode = live` siguiendo `PAYMENTS_GO_LIVE.md`.
Hasta entonces `store_apply` ignora cualquier dato live.

## Comprobación

Admin › Pagos › **Comprobar catálogo**: app Test Store, clave pública (`REVENUECAT_SDK_TEST`
coincide con la del proyecto), permiso de lectura de clientes y estado de cada producto
(`Correcto`, `Falta`, `No coincide` en tipo o duración). Productos de más se listan aparte.
El importe mostrado en el informe procede de `plans`: no comprueba el precio configurado
en RevenueCat. Comparad también los precios del panel y de la pantalla de compra.
