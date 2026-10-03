# Plan del Bloque 8 — 2026-10-04

Alcance autorizado: PRD 6.6 y 6.6.1. Al terminar, ejecutar las pruebas de los bloques 7 y 8.

1. Implementar compatibilidad recíproca y prioridades en servidor, respetando edad
   verificada, consentimientos, semáforo, modo discreto, bloqueos e aislamiento `is_test`.
2. Persistir likes y pases; aplicar el límite configurable y los entitlements en
   servidor. Crear un único match transaccional y avisar a ambos participantes.
3. Conectar matching y chat reales mediante adaptadores validados y Broadcast privado.
   Cubrir mensajes, lectura, escritura, reconexión y retirada de matches; evitar duplicados.
4. Persistir Anthem y su selección en el perfil. Spotify se mantiene sujeto a acceso
   gratuito autorizado (PRD 11.3); no activar proveedores de pago.
5. Conectar los simuladores de likes y mensajes a datos de prueba persistidos, con
   rol, flag, aislamiento y auditoría.
6. Verificar SQL con rollback, regresiones de cliente de los bloques 7 y 8,
   `npm run check`, build, audit y Advisors. Documentar resultados y límites reales.

No se avanza al Bloque 9.
