# Plan del Bloque 10 — 2026-10-04

Autorizado por el propietario con «comienza el bloque 10», tras el cierre del
bloque 9. Fuente de verdad: PRD 3.3–3.5, 6.12, 6.15, 8 y Anexos A/B.

1. Auditar los límites de confianza del repositorio: Auth/OTP/MFA, RLS/RPC,
   Storage, verificación, lugares/presencia, matching/chat, moderación/derechos,
   pagos, herramientas y administración. Validar hallazgos con evidencia y
   corregir los críticos/altos antes del cierre. Consultar Advisors y contrastar
   el inventario real de Edge Functions y privilegios.
2. Revisar la PWA: registro, instalación, actualización desde una versión anterior,
   recuperación ante fallos de chunks y funcionamiento sin conexión. Cachear solo
   el shell; conservar la sesión y excluir datos personales, API y Mapbox.
3. Revisar accesibilidad en los cinco temas: contraste, foco, teclado, lectores,
   objetivos táctiles, formularios, estados de carga/error y movimiento reducido.
   Corregir fallos de componentes compartidos y flujos afectados.
4. Comprobar rendimiento y carga diferida: medir el build, evitar descargar mapa
   o pantallas innecesarias al entrar, revisar animaciones y documentar el alcance
   de las mediciones sin afirmar 60 fps en dispositivos no probados.
5. Ejecutar QA y casos de abuso: regresión frontend, RLS por rol e IDOR, límites,
   webhooks, aislamiento de pruebas y auditoría de red. Generar SBOM y ejecutar
   `npm audit`, `npm run check` y build. Usar fixtures propios y rollback para las
   pruebas de base de datos; no modificar la cuenta del propietario.
6. Revisar la cobertura de `src/platform`, documentar el paso a nativa en
   `docs/NATIVE.md` y el procedimiento de activación/rollback de pagos en
   `docs/PAYMENTS_GO_LIVE.md`, adaptados a los contratos existentes.
7. Actualizar `docs/API.md`, `docs/ARCHITECTURE.md`, `docs/SECURITY.md`,
   `docs/BLOCK10_TESTS.md` y `docs/PROGRESS.md`; publicar únicamente trabajo validado
   y comprobar el despliegue conforme al protocolo del repositorio.

Los proveedores siguen en sus modos actuales de prueba. La contratación,
activación live, configuración legal externa y lanzamiento público pertenecen
al bloque 12. Los avisos o comprobaciones pendientes se registrarán de forma
explícita; no se marcará la checklist completa sin evidencia.

No se inicia el bloque 11 sin OK explícito del propietario.
