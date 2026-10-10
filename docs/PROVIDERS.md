# Proveedores — desarrollo sin cargos

Decisión del propietario (2026-10-03). Implementar cada integración en su bloque, sin contratar
servicios ni activar claves live. Se acepta tarjeta solo si no habrá cargos ni renovación de pago.
Toda disponibilidad/caducidad se comprueba en la cuenta real antes de configurar la integración.

| Capacidad            | Pruebas                                                                           | Si no hay acceso gratuito                          |
| -------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- |
| Edad e identidad     | Veriff test primero; conservar Yoti                                               | Botones de resultado persistido                    |
| Coincidencia de foto | Producto de comparación de Veriff si está disponible                              | Resultado independiente simulado                   |
| Mapas                | Mapbox existente dentro de las 50.000 cargas gratis, con límite propio (ADR 0010) | Mapa simulado y datos de Supabase                  |
| Lugares              | Google Places desactivado (cuenta de pago, EEE); catálogo propio                  | Lugares de prueba en Supabase                      |
| Pagos web            | Stripe sandbox/test                                                               | Compra y ventajas simuladas en Supabase            |
| Pagos nativos        | RevenueCat Test Store (integrado en 11b, sin ingresos reales)                     | Compras y restauración simuladas en Supabase       |
| Anthem               | Spotify con cuenta ya elegible, sin contratar Premium                             | Canciones de prueba persistidas                    |
| SMS                  | Prueba compatible y sin cargos; teléfonos de prueba de Auth                       | OTP de prueba de Supabase, sin fingir una sesión   |
| Correo/push          | Cuentas gratuitas disponibles, correo actual del propietario                      | Resultado identificado como simulado y consultable |
| Eventos              | Fuentes gratuitas autorizadas                                                     | Eventos de prueba persistidos                      |
| Hosting/analítica    | Infraestructura actual sin ampliar planes; analítica opcional desactivada         | No añadir recursos facturables                     |

## Contrato de implementación (bloques 6–11)

- Configurar por capacidad proveedor, entorno, disponibilidad y caducidad; secretos solo en servidor.
- RPC/Edge Functions autorizadas actualizan las tablas de negocio y registran actor, resultado,
  entorno e identificador idempotente. Los botones no devuelven éxito por un fallback a mocks.
- Resultados disponibles tras recarga y desde otro dispositivo; fixtures aislados de usuarios normales.
- Simulación solo para testers autorizados; administración con MFA. Conservar cuentas reales y sus
  evidencias legales al purgar fixtures. Las decisiones test no acreditan identidad real.
- Caducidad/límite deshabilita llamadas externas y ofrece simulación explícita, sin cambio a pago.
- El Bloque 12 concentra contratación, costes aprobados, credenciales live, validación real y publicación.

## Fuentes oficiales consultadas

- [Veriff test](https://devdocs.veriff.com/docs/how-to-create-an-integration): sesiones no facturadas,
  con decisiones forzadas para pruebas; comprobar acceso de la cuenta antes de configurarlo.
- [Comparación de selfies](https://devdocs.veriff.com/docs/selfie2selfie-biometric-verification):
  requiere una integración específica; no conceder el badge de foto por verificar solo identidad.
- [Mapbox Demo](https://docs.mapbox.com/accounts/guides/demo-access/): sin tarjeta y API detenidas
  al alcanzar los límites. Sustituido por la cuenta Pay as you go ya existente del
  propietario, usada solo dentro del tramo gratuito y con corte en servidor (ADR 0010).
- [Google Cloud free trial](https://docs.cloud.google.com/free/docs/free-cloud-features):
  comprobar elegibilidad y caducidad; una cuenta de pago con cuotas gratis no cumple esta política.
- [Stripe test](https://docs.stripe.com/testing): tarjetas de prueba sin mover dinero real.
- [RevenueCat Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store):
  pruebas sin configurar cuentas de las tiendas.
- [Spotify Development Mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes):
  requiere Premium al propietario; usarlo solo si ya dispone de una cuenta elegible.

Este documento fija el trabajo futuro; no declara configuradas las integraciones pendientes.
El Bloque 6 tiene Veriff test en código y ya aplicado en Nightlife_Connect (migración,
`verification`, `veriff-webhook`, `yoti-webhook`), auditado el 2026-10-03.

**Puerta del Bloque 6:** aprobación y rechazo firmados recibidos con HTTP 200; revisión
solicitada persistida y visible en la cola real del admin; autoaprobación rechazada con 403.
Station Test no ofrece forzar `review`; ese evento se cubre en las pruebas SQL y de parser.
Foto simulada e identidad Test permanecen verificadas tras recargar, siempre en sandbox.

**Excepción aprobada por el propietario (2026-10-03):** la API de borrado responde 403.
Veriff requiere habilitar DELETE mediante soporte; su activación y la prueba de borrado real
se trasladan al Bloque 12. El servidor registra el intento como pendiente, nunca como borrado.
[Requisito oficial de Veriff](https://devdocs.veriff.com/apidocs/v1sessionsid-3).

Registro actual: `private.verification_provider_access`. Veriff edad/identidad en Test;
foto simulada; Yoti live no disponible. El 2026-10-03 Station mostró 14 días de trial:
corte conservador registrado `2026-10-16T00:00:00Z`. Al caducar, no se llama al proveedor;
el tester puede escoger simulación persistida explícita. No hay cambio automático a pago.

**Bloque 7:** registro `private.provider_access`. Mapbox con límite mensual/diario de
1.000 cargas ajustable por admin con MFA, avisos al 80 % y 95 % y corte al agotarse.
Token público `pk.` configurado desde Admin → Proveedores (pendiente del propietario).
Google Places con 20 peticiones de prueba preparadas, pero deshabilitado. Eventos externos
sin fuente gratuita autorizada: solo eventos de prueba persistidos.

**Puerta del Bloque 12:** contratos, costes aprobados, credenciales live, verificación
real de personas y comparación real de foto antes de publicar esas capacidades.
