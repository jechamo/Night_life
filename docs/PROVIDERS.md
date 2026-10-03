# Proveedores — desarrollo sin cargos

Decisión del propietario (2026-10-03). Implementar cada integración en su bloque, sin contratar
servicios ni activar claves live. Se acepta tarjeta solo si no habrá cargos ni renovación de pago.
Toda disponibilidad/caducidad se comprueba en la cuenta real antes de configurar la integración.

| Capacidad            | Pruebas                                                                   | Si no hay acceso gratuito                          |
| -------------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| Edad e identidad     | Veriff test primero; conservar Yoti                                       | Botones de resultado persistido                    |
| Coincidencia de foto | Producto de comparación de Veriff si está disponible                      | Resultado independiente simulado                   |
| Mapas                | Mapbox Demo sin tarjeta                                                   | Mapa simulado y datos de Supabase                  |
| Lugares              | Google Places en prueba gratuita elegible, sin pasar a pago               | Lugares de prueba en Supabase                      |
| Pagos web            | Stripe sandbox/test                                                       | Compra y ventajas simuladas en Supabase            |
| Pagos nativos        | RevenueCat Test Store                                                     | Compras y restauración simuladas en Supabase       |
| Anthem               | Spotify con cuenta ya elegible, sin contratar Premium                     | Canciones de prueba persistidas                    |
| SMS                  | Prueba compatible y sin cargos; teléfonos de prueba de Auth               | OTP de prueba de Supabase, sin fingir una sesión   |
| Correo/push          | Cuentas gratuitas disponibles, correo actual del propietario              | Resultado identificado como simulado y consultable |
| Eventos              | Fuentes gratuitas autorizadas                                             | Eventos de prueba persistidos                      |
| Hosting/analítica    | Infraestructura actual sin ampliar planes; analítica opcional desactivada | No añadir recursos facturables                     |

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
  al alcanzar los límites. No convertirlo a Pay As You Go antes del Bloque 12.
- [Google Cloud free trial](https://docs.cloud.google.com/free/docs/free-cloud-features):
  comprobar elegibilidad y caducidad; una cuenta de pago con cuotas gratis no cumple esta política.
- [Stripe test](https://docs.stripe.com/testing): tarjetas de prueba sin mover dinero real.
- [RevenueCat Test Store](https://www.revenuecat.com/docs/test-and-launch/sandbox/test-store):
  pruebas sin configurar cuentas de las tiendas.
- [Spotify Development Mode](https://developer.spotify.com/documentation/web-api/concepts/quota-modes):
  requiere Premium al propietario; usarlo solo si ya dispone de una cuenta elegible.

Este documento fija el trabajo futuro; no declara configuradas las integraciones pendientes.
