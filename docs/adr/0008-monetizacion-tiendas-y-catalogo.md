# ADR 0008 — Monetización con tiendas, catálogo propio y sin anuncios de terceros

- **Estado:** aceptada (OK del propietario, 2026-10-02)
- **Fecha:** 2026-10-02

## Contexto

El propietario quiere cobrar por Google Play y App Store con un modelo inspirado en las apps de
citas líderes (niveles, compras sueltas, publicidad) sin parecer una copia. Detalle en
`docs/MONETIZATION.md`.

## Decisión

- Un único catálogo y entitlements para todos los canales: Stripe en la web, compras dentro de la
  app en iOS/Android (origen `apple`/`google`, ya previsto en PRD 6.13 y Anexo B).
- Productos propios ligados a la noche: Pase, Pase VIP, **Pase de una noche**, Chispas, Foco,
  Mensaje directo y Modo viaje.
- Sin redes de anuncios de terceros (AdSense/AdMob): solo patrocinios de locales, incluida una
  tarjeta patrocinada en el swipe que no ven los suscriptores.
- Todos los filtros siguen gratis (se retira `advanced_filters`).
- Nuevo Bloque 11: apps nativas con Capacitor + compras en tiendas.

## Consecuencias

- Bloque 4 diseña el paywall con este catálogo; Bloque 9 añade IDs de producto por tienda y
  saldo de créditos; Bloque 11 integra StoreKit / Play Billing (o RevenueCat, si se autoriza).
