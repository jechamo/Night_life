# R4 — Escaparate del local (roadmap 2026-10)

Aprobado por el propietario el 08/10/2026. Todo aditivo y detrás de `venue_showcase_enabled`
(apagado): con el flag apagado la ficha, el panel, el buscador y el admin quedan idénticos.

## Decisiones del propietario

- Fotos: gratis 3 (portada + 2); con plan (patrocinio activo o Estadísticas Pro, comprado o
  por contrato) hasta 10. Al terminar el plan las fotos de más se ocultan, no se borran.
- Moderación: todas las fotos pasan por el admin antes de verse (Admin › Fotos de locales,
  con motivo si se rechazan).
- Informe de resultados: resumen de 30 días y resultado de patrocinios y Flash para todos
  los gestores; con Estadísticas Pro, evolución por día y comparación con el periodo anterior.
- Ficha enriquecida solo en la ficha; el buscador y sus filtros no cambian en R4.

## Servidor (migraciones aditivas)

- Flag `venue_showcase_enabled` = off (18 flags).
- Bucket privado `venue-photos` (5 MB; WebP/JPEG/PNG). Carpeta `<venue_id>/`. Subir y borrar:
  solo gestores del local (con el flag, dentro del límite). Leer: admin, gestores del local y
  cualquier usuario registrado si la foto está aprobada y dentro del límite visible. Sin
  actualizar objetos. URLs firmadas de corta duración.
- `private.venue_photos` (estado `pending|approved|rejected`, portada, motivo, quién y cuándo).
- `private.venue_details` (dress code, edad mínima, precio de entrada y de copa, terraza,
  accesible).
- `private.venue_notices` (lo dice el local): puerta (`no_queue|short_queue|long_queue|
almost_full|full`, caduca a los 90 min), «entrada gratis hasta» y «happy hour hasta»
  (máx. 8 h). Siempre etiquetado «Lo dice el local».
- Vistas de ficha: una por persona, local y noche (`private.venue_view_marks`, con HMAC y
  borrado a los 2 días) → contador diario `private.venue_daily_views` (400 días). No cuentan
  las vistas de los gestores del propio local.
- Informe (`venue_report`): agregados con umbral de 5 (por debajo se muestra «menos de 5»).
- Admin (aal2, auditado): lista de fotos pendientes y aprobar/rechazar con motivo.
- Cron diario de limpieza (marcas, avisos caducados, contadores antiguos).

## Cliente

- Ficha (`PlaceDetails`): galería con las fotos aprobadas, «Lo dice el local» y datos de la
  ficha enriquecida. `PlaceCover` usa la portada aprobada; sin portada, la ilustración actual.
- Panel del local (`/venue/:id`): Fotos (subir con `usePlatform().images`, que recomprime y
  quita EXIF; portada; borrar; estado y motivo), Ficha enriquecida, En directo y Resultados.
- Admin: sección «Fotos de locales» (`/admin/venue-photos`).
- Guías: puntos nuevos solo con el flag encendido.

## Hecho cuando

- ✅ Flag apagado: ficha, panel, portadas, admin y guías idénticos (unitarias + E2E).
- ✅ Flag encendido: el gestor sube una foto → pendiente → el admin la aprueba → se ve en la
  ficha y como portada; límite 3/10; avisos y ficha enriquecida visibles; informe
  (unitarias + E2E).
- ✅ SQL por rol (`supabase/tests/showcase.sql`, 61/61): anónimo, usuario, gestor de otro
  local, gestor, admin aal1/aal2; flag apagado; límites; Storage; umbrales; auditoría.
- ✅ RLS 37/37, Advisors sin errores, `npm audit` 0, docs.
- ❌ Parte 5 (`PENDING_5_venue_showcase_cleanup.sql`, con `DELETE`): Supabase la cancela sin
  confirmación; la ejecuta el propietario en el SQL Editor.
