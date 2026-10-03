# ADR 0010 — Mapa real, catálogo y límites de proveedores

- **Estado:** aceptado; implementado en el Bloque 7
- **Fecha:** 2026-10-03
- **Bloque:** 7

## Mapbox y costes

El propietario confirmó una cuenta Standard / Pay as you go y consumo de 0 de 50.000
cargas web gratuitas este mes. Autorizó probar dentro del tramo gratuito existente
y parametrizar el límite de Nightlife, con incrementos manuales. Esta autorización
sustituye el supuesto previo de Demo sin tarjeta. No cambia el plan ni autoriza cargos.

| Servicio mostrado en su cuenta |    Uso gratuito mensual | Uso en esta fase                          |
| ------------------------------ | ----------------------: | ----------------------------------------- |
| Map Loads for Web              |           50.000 cargas | Mapbox GL JS tras reservar cada carga     |
| Static Tiles API               |      200.000 peticiones | No utilizado                              |
| Static Images API              |       50.000 peticiones | No utilizado                              |
| Maps SDKs for Mobile           | 25.000 usuarios activos | No utilizado; una PWA usa el contador web |

Los tramos no se suman. Se reserva una unidad antes de cada inicialización del mapa;
los fallos no se reembolsan al contador, para mantener una estimación conservadora.

Registro privado persistido: límite inicial mensual/diario de 1.000, paso de 1.000,
margen de 5.000 bajo la cuota web confirmada. Admin con MFA puede ajustar, pausar y
confirmar consumo; subir el límite conserva las reservas ya acumuladas. Avisos al
80 % y 95 %, corte en el servidor al agotarlo y fallback explícito al mapa de prueba.
No existen ampliaciones automáticas. A principios de cada mes hay que confirmar
el consumo del proveedor para renovar la evidencia; una confirmación caducada corta.

La observación manual del consumo total de Mapbox se descuenta, de forma conservadora,
además de las reservas de Nightlife. El contador no consulta ni limita otros tokens,
aplicaciones o accesos directos a Mapbox; no es un tope de facturación de la cuenta.
Usar un token público restringido a los dominios previstos, nunca un token secreto.

Fuentes: [precios](https://www.mapbox.com/pricing),
[cargas GL JS](https://docs.mapbox.com/mapbox-gl-js/guides/pricing/),
[periodo y facturación](https://docs.mapbox.com/accounts/guides/invoices/).

## Google Places (EEE)

La cuenta Google es de pago; aún no se ha verificado el proyecto, el SKU concreto
ni su consumo. Registro de 20 peticiones de prueba preparado, pero deshabilitado.
No puede activarse desde este panel hasta validar la capacidad gratuita del SKU.
La clave permanece exclusivamente en servidor.

Importar no convierte contenido de Google en contenido propio. Se conserva place_id;
coordenadas se guardan un máximo de 30 días y se eliminan al caducar. No almacenar
permanentemente nombres, contactos, horarios, valoraciones o referencias de fotos
copiados de Google. Los datos editoriales deben ser aportados independientemente
por admin/gestor o fixtures. El upsert de descubrimiento solo conserva ID/coordenadas.
En mapas Mapbox solo aparecen las excepciones permitidas y nuestros datos propios.
Las fichas de Google bajo usos permitidos deben ser efímeras y respetar atribución.

Fuentes: [EEE §15](https://cloud.google.com/terms/maps-platform/eea/maps-service-terms),
[usos permitidos](https://cloud.google.com/terms/maps-platform/eea-places-api-permitted-uses),
[políticas de Places](https://developers.google.com/maps/documentation/places/web-service/policies).

## Servidor y simulación

RPC privadas con guardas y envoltorios invoker; RLS, is_test y canales Broadcast
privados separados. Cron de estadísticas y caducidad cada minuto aplicado. Refresco
externo semanal aún pendiente; nunca se activará sin reserva de cuota y prueba vigente.
Simuladores de ocho ciudades, asistencia, eventos y caducidad solo en entidades de
prueba, con permisos y auditoría.

## Implementación final

- `reserve_map_load()` reserva 1 unidad y solo entonces devuelve el token público, que
  el admin guarda desde Proveedores (`admin_set_map_token`, solo `pk.`). El cliente pide
  la reserva una vez por montaje del mapa, fuera de la caché de consultas, para que una
  invalidación no consuma otra carga.
- Mapbox GL JS va en un chunk diferido excluido del precache del service worker.
- Sin token, sin cuota o si el mapa falla se muestra el mapa de prueba con un aviso.
- Catálogo propio editable en Admin → Locales; no se usan Edge Functions externas en
  este bloque (Google y eventos externos siguen desactivados).
