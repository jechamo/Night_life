# Pruebas del Bloque 9 — 2026-10-04

| Comprobación                                | Resultado                                                     |
| ------------------------------------------- | ------------------------------------------------------------- |
| TypeScript, ESLint, Prettier y Vitest       | 325/325; 43 archivos                                          |
| Regresión frontend de bloques 7 y 8         | 69/69                                                         |
| SQL del bloque 9                            | 72/72; rollback completo                                      |
| SQL matching / locales / cuotas / OSM / RLS | 62/19/19/13/33; cero fallos                                   |
| Firma Stripe y autenticación reciente, Deno | 12/12                                                         |
| Compra y gestión real de Stripe test        | 11/11                                                         |
| Borrado con dos cuentas Auth independientes | 10/10 + comprobaciones servidor/proveedor                     |
| Puertas HTTP, CORS y esquemas internos      | 19/19                                                         |
| `npm audit` con CA del sistema              | 0 vulnerabilidades                                            |
| Build                                       | Correcto; chunk diferido de Mapbox de 1,86 MB, aviso conocido |

Las suites SQL terminan con una excepción deliberada de resumen, con **0 fallos**;
esto revierte todos los fixtures. Se ejecutaron por MCP contra
`ocrpfeqfqzchhrghqcfb`. Las pruebas no conceden ventajas mediante el navegador.

## Compra externa real en test

El Checkout alojado mostró «Entorno de prueba», VIP 19,99 EUR, tarjeta de prueba
4242 y renovación mensual. Se completó el pago en Stripe. El endpoint recibió
eventos firmados y persistió la compra con `simulated=false`.

- Pedido `84a8d90e-f1f6-48a6-a3c5-ffcbef90e82e`.
- Evento Checkout `evt_1UMkN9Jrzx7OE9xvZwQN0C4I` y evento de factura
  `evt_1UMkN9Jrzx7OE9xvwFQdqlbW`.
- Suscripción `sub_1UMkN8Jrzx7OE9xvKADIcFgJ`, ahora cancelada y reembolsada.
- Portal alojado válido; cancelación al final del periodo mantuvo las ventajas;
  reactivación restauró la renovación; desistimiento confirmó el reembolso,
  revocó los entitlements y dejó los créditos a cero. Recibo marcado reembolsado.
- Créditos iniciales VIP: 3 Chispas, 1 Foco y 2 mensajes directos, concedidos una vez.

Las pruebas SQL verifican eventos repetidos con el mismo y distinto ID, refund,
evento tardío tras refund y rechazo de modo incorrecto. Deno verifica cuerpo
original, alteración, secreto incorrecto, ausencia de firma y timestamp vencido.
La UI confirma pago solo después de consultar el pedido propio persistido.

## Borrado de punta a punta

Se creó una segunda suscripción activa de test, aún sin fulfillment local:
`sub_1UMkRCJrzx7OE9xvxc1aYYCL`. La cuenta tenía una conversación real y una foto
privada en Storage. La exportación incluyó mensajes propios y excluyó el contenido
enviado por su interlocutor. Se registró una rectificación con plazo legal.

Tras autenticar de nuevo con contraseña, `delete-account` respondió `deleted=true`.
No se falsificó ningún JWT. Las comprobaciones posteriores confirmaron:

- Auth y perfil eliminados, nuevo login rechazado, foto y conversación eliminadas.
- Mapa privado de cliente de Stripe eliminado.
- Stripe confirmó `cus_VNVHqNQ8IxXlCa` con `deleted=true` y ambas suscripciones
  canceladas, incluida la pendiente de fulfillment local.
- Factura conservada sin usuario y evidencia mínima bloqueada por HMAC,
  inaccesible al cliente. Sin documento, imagen, selfie o fecha de nacimiento copiados.
- Los fixtures restantes y el local temporal se retiraron: **1 perfil real,
  0 perfiles de prueba**, igual que al iniciar.

## Cobertura de seguridad y negocio

SQL: SOS atómico con máximo tres contactos; export completo; plazo de un mes;
MFA en admin; tres reportes distintos validados en seis horas; apelación por otro
revisor; bloqueo de cuenta suspendida; promoción sin duplicados; panel de local
gratuito; aprobación independiente; estadísticas umbraladas; patrocinio exige
factura manual; Flash solo con consentimiento y alcohol cerrado por defecto;
`audience=none` deniega checkout preservando ventajas ya adquiridas.

El contacto de pago consume un crédito en servidor, comprueba compatibilidad y
semáforo rojo, y se etiqueta como mensaje directo. La flag permanece apagada.
Los outboxes usan leases, límite de diez intentos y backoff; un lease incorrecto
no puede marcar entrega y dos workers no reclaman el mismo documento. Los
envíos a fixtures se marcan simulados; no se atribuye una entrega SMTP real a
estos ensayos. Veriff dispone de una cola cerrada de reintento de retirada;
este ensayo de borrado no contenía una sesión Veriff externa.

Security Advisors: un WARN previo `auth_leaked_password_protection` y doce INFO
de tablas privadas con RLS sin políticas y permisos revocados. No se declara
«sin avisos». Véanse [RLS sin políticas](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
y [protección de contraseñas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
No se ampliaron planes ni se activaron claves live.

## Reproducción

1. `npm run check`, `npm run test:blocks:7-8`, `npm run build` y
   `NODE_OPTIONS=--use-system-ca npm audit` (en PowerShell, asignar primero `$env:NODE_OPTIONS`).
2. Ejecutar `supabase/tests/block9.sql` por MCP; exigir resumen sin fallos y rollback.
3. `DENO_TLS_CA_STORE=system deno test --allow-env --node-modules-dir=none
supabase/functions/_shared/billing-security.test.ts`; en PowerShell, asignar la
   variable antes del comando. Comprobar las entradas Edge con `deno check`.
4. `npm run test:network:9` comprueba las funciones desplegadas sin credenciales.
5. Para otro ensayo externo, crear dos cuentas desechables `is_test` con rol tester,
   verificación sandbox, preferencias compatibles y consentimientos. Guardar sus
   credenciales solo en `.tmp/block9-live-credentials.json` (estructura `ids`,
   `emails`, `password`). No usar una cuenta real para el borrado.
6. Completar un VIP test en Checkout. `npm run test:billing:9` cancela, reactiva y
   reembolsa la compra de esa primera cuenta. El ensayo no es de solo lectura.
7. `npm run test:erasure:9` elimina la primera cuenta después de crear conversación
   y foto; exige IDs de fixtures terminados en `e901/e902`. Comprobar Stripe y
   Storage por MCP y retirar la segunda cuenta. Recrear el mismo UUID dentro de
   24 horas puede reutilizar la idempotencia de Stripe; usar un UUID de fixture nuevo.
8. Eliminar el archivo temporal de credenciales al finalizar. Nunca publicar
   secretos, tokens, enlaces temporales de Portal ni datos de tarjetas en el repo.

La retención de históricos fue autorizada expresamente por el propietario después
de una previsualización con cero filas vencidas. La activación y el despliegue final
se registran en `docs/PROGRESS.md`.

## Cron comprobado

El job de mantenimiento del 04/10/2026 a las 11:10 (Madrid) terminó con
status succeeded. La llamada al worker recibió HTTP 200: sent=0, simulated=0,
failed=0, purged=0. El ensayo fue sobre la cola vacía real. La suite SQL verifica
además caducidad y concesión semanal VIP repetida sin duplicar créditos.

El cron usa processed_at e ignora suscripciones sin propietario. La extensión
[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net) quedó instalada.
Los esquemas net y private no son accesibles por la API pública (406/PGRST106).
