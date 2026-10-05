# Inicio y mejoras previas al bloque 11

Plan aprobado el 05/10/2026. Rama `codex/home-pre-block11`.

- Entrada `/home`, cinco pestañas, mosaico visual de siete zonas usando tokens de los siete temas.
- Cinco locales cercanos, hasta dos patrocinios activos; rankings de tres locales por ciudad y cifras públicas con privacidad.
- Servicio de dashboard y agregación en servidor; sin Mapbox ni reserva de carga en Inicio, favoritos o fichas.
- Ficha `/places/:placeId`, favoritos personales persistentes y likes nuevos desde la última visita correcta a la pantalla de likes. El corazón conserva el total.
- Chats pendientes: último mensaje de la otra persona, incluso leído, sobre conversaciones con mensajes. Matches activos.
- Máscara radial para ilustraciones decorativas y zonas seguras sumadas a los márgenes visuales. Contrato nativo para el bloque 11.
- GitHub/Vercel: `codex/...` → `develop` → `main`; previews por push, producción automática al integrar con CI pasado y main protegido.
- Migraciones aditivas antes del frontend dependiente; pagos en TEST. No iniciar Capacitor/bloque 11 ni contratar servicios.

Validación: pruebas UI/servicios y SQL con rollback, aislamiento y RLS, tipos/lint/formato/build/audit, recorrido sin tráfico ni cuota Mapbox, responsive/siete temas/zona segura; push preview e integración production. Registrar expresamente las comprobaciones físicas que no se hayan realizado.
