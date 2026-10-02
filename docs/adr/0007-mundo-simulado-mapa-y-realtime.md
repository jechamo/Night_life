# ADR 0007 — Mundo simulado, mapa 3D simulado y realtime (Bloque 3)

- **Estado:** aceptada (Bloque 3)
- **Fecha:** 2026-10-02

## Decisión

- **Mapa simulado** (`MockMap`) hasta Mapbox (Bloque 7): plano inclinado 38° con calles SVG
  pintadas con tokens del tema, pines de pie (`preserve-3d` + contrarrotación), heatmap con la
  rampa del tema que "respira" (solo opacidad) y cámara = `translate` + `scale` animados con
  _springs_ (solo `transform`). Cada pin es un botón con etiqueta accesible; hay vista de lista
  como alternativa.
- **Mundo simulado** (`src/mocks/world`): 9 locales y 3 eventos ficticios en un distrito
  inventado, 24 perfiles ficticios con avatares **ilustrados por código** (SVG, nunca fotos de
  personas), 2 matches con historial. Nada se persiste (solo memoria).
- **Puertos nuevos**: `PlacesService`, `AttendanceService`, `MatchingService`, `ChatService`,
  `ProfileService` y `RealtimeService`. La UI no sabe si son mocks o Supabase.
- **Realtime = Observer**: un único `RealtimeBridge` suscrito escribe cada evento (estadísticas,
  "personas nuevas", match, mensaje, escribiendo, leído) en la caché de TanStack Query. No hay
  estado paralelo. Los avisos en directo caducan solos.
- **Match**: lo decide el servicio (servidor en el Bloque 8). La pantalla de match se abre por
  el resultado del like o por un evento realtime; en el mock, los perfiles que ya te dieron like
  hacen match al instante y otros pueden devolverlo unos segundos después.
- **Reglas puras con tests**: umbrales de estadísticas, distancia/check-in 150 m, ventana
  18:00-06:00, ciclo de vida de eventos, duplicados, patrocinados (2 arriba + 1/5), filtros,
  compatibilidad en ambos sentidos, prioridad del swipe, límite de likes, rompehielos y título
  del match.
- **Modo pruebas**: con `test_tools_enabled` se puede simular estar en un local (check-in) y
  marcar "Esta Noche Voy" fuera de horario.

## Consecuencias

- La ubicación del usuario en Descubre es el centro del distrito hasta el Bloque 7.
- Las portadas de locales son ilustraciones por tipo hasta tener fotos reales o las imágenes GPT.
