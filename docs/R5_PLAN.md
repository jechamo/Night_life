# R5 — Reservas sin pago y lista de invitados con QR (roadmap 2026-10)

Aprobado por el propietario el 08/10/2026. Todo aditivo y detrás de `venue_bookings_enabled`
(apagado): con el flag apagado la ficha, el panel y el perfil quedan idénticos. Sin dinero,
sin TPV y sin terceros nuevos.

## Decisiones del propietario

- QR propio, sin librerías: generador ISO 18004 dentro de la app. Cada entrada lleva además
  un código corto. En la puerta se escanea con la cámara si el navegador lo permite
  (`BarcodeDetector`, vía `src/platform`) y si no se teclea el código.
- Todos los locales, gratis; cada local activa reservas y/o listas en su panel.
- Para reservar o apuntarse hace falta la edad verificada.
- El local solo ve el nombre de perfil, el nº de personas y la hora; sin teléfono. Todo se
  comunica en la app (aceptar, rechazar con motivo, cancelar).

## Servidor (migraciones aditivas, sin `DELETE`)

- Flag `venue_bookings_enabled` = off (19 flags).
- `private.venue_booking_settings` (reservas sí/no, listas sí/no, máximo de personas).
- `private.venue_reservations`: noche, hora de llegada, personas (1-20), tipo
  `table|bottle`, estado `requested|accepted|rejected|cancelled|expired`, motivo del local.
  Máx. 3 solicitudes activas por persona y 1 por local y noche; hasta 14 días vista.
- `private.venue_guestlists` (una por local y noche: título, válida hasta, aforo, abierta o
  cerrada) y `private.venue_guestlist_entries` (una por persona; `confirmed|cancelled|
  checked_in`). El código de la entrada se deriva con HMAC del id (no se guarda en claro) y
  la puerta lo valida con límite de intentos.
- Cron: caduca solicitudes sin respuesta y cierra listas pasadas (solo `update`); a los 90
  días se desvincula a la persona (`user_id` nulo) y se conservan solo los totales.
- RPC `security definer` con envoltorios `invoker`, solo `authenticated`; gestor del local
  para su panel; auditoría de decisiones y de la puerta.

## Cliente

- Ficha (flag on): «Reservar» (fecha, hora, personas, mesa o botella) y «Lista de
  invitados» (apuntarse / salir) si el local lo ofrece.
- «Mis reservas» (`/reservas`, desde Perfil): estado de cada reserva y entradas de lista con
  QR y código; cancelar.
- Panel del local: ajustes, solicitudes (aceptar / rechazar con motivo), lista de esta noche
  (crear, cerrar, apuntados, validar en la puerta con cámara o código).
- Guías: puntos nuevos solo con el flag encendido.

## Hecho cuando

- Flag apagado: ficha, panel, perfil y guías idénticos (unitarias + E2E).
- Flag encendido: reservar → el local acepta/rechaza → la persona lo ve; apuntarse a la
  lista → QR + código → el local lo valida una vez (unitarias + E2E).
- QR: matrices comprobadas contra una implementación de referencia.
- SQL por rol: anónimo, sin edad verificada, usuario, gestor de otro local, gestor; flag
  apagado; límites; códigos inválidos y repetidos; caducidad; auditoría.
- Suites previas, Advisors, `npm audit`, docs.
