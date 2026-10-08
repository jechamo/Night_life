# Roadmap R2 — «Cómo está ahora» (plan)

Origen: [ROADMAP_2026-10.md](./ROADMAP_2026-10.md) §5. OK del propietario el 08/10/2026.
Aditivo: el Vibe Check actual no se toca. Todo detrás de `live_status_enabled` (apagado).

## Qué ve la gente

En la ficha de cada local o evento, una sección «Cómo está ahora»:

- Votos de un toque, solo con check-in activo en ese sitio:
  - Gente: vacío · normal · lleno · a tope.
  - Cola: sin cola · poca · larga.
  - Música: me gusta / no me gusta y qué suena (lista cerrada de estilos).
- Solo cuenta lo reciente (últimos 90 minutos) y se muestra a partir de 3 votos; con menos
  se indica «Aún pocos votos».
- «El local dice» (estilos y line-up de esta noche que declara el gestor) junto a
  «La gente dice» (estilo más votado ahora).
- «Normalmente…»: valor de gente más votado el mismo día de la semana y la misma hora en
  las últimas 8 semanas, con al menos 5 votos.

## Qué ve el local

Panel del local › «Música y ambiente»: declarar estilos y line-up de esta noche, y ver el
mismo resumen de «Cómo está ahora» que ven los usuarios.

## Servidor (migración aditiva)

- Tabla `private.place_reports` (sin acceso de cliente) con un voto por persona, sitio,
  pregunta y noche; se actualiza si cambia el voto. Retención 60 días (cron diario).
- Columnas nuevas en `venues`: `tonight_lineup`, `lineup_night` (el line-up caduca solo).
- RPC `report_place_status`, `place_live_status` y `venue_set_music`; todas comprueban el
  flag en servidor, registro completo, límites de uso y, al votar, check-in activo. Los
  gestores no votan en su propio local. Los votos de cuentas de prueba solo cuentan para
  testers/admin.

## Hecho cuando

- ✅ Flag apagado: ficha, Vibe Check y panel idénticos (unitarias y E2E actuales en verde).
- ✅ Flag encendido: votar, cambiar voto, umbral de 3, «El local dice / La gente dice»,
  «Normalmente…» y panel del local (unitarias + E2E con el simulador).
- ✅ Pruebas SQL nuevas por rol (anónimo, sin check-in, con check-in, gestor, flag apagado).
- ✅ Guías actualizadas; check, build, audit, E2E ×3, Advisors; PROGRESS y SECURITY.
