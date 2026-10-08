# R3 — Partners y contratos (roadmap 2026-10)

Aprobado por el propietario el 08/10/2026. Todo aditivo y detrás de `venue_partners_enabled`
(apagado): el claim, el patrocinio por Stripe/factura y Pro por Stripe siguen igual.

## Decisiones del propietario

- Contrato: solo datos y referencia (nº, empresa, CIF/NIF, plan, fechas, versión de las
  Condiciones para Locales). El PDF firmado se guarda fuera de la app.
- Plan del contrato: los niveles actuales (Destacado, Destacado Plus, Top) y/o Estadísticas
  Pro, con fechas. Funcionan igual que comprados; el precio se pacta fuera.
- Equipo: titular y encargados hacen todo como hoy; solo el titular invita o quita encargados.
- Los patrocinios por contrato no ocupan los 3 huecos por ciudad (el límite sigue para
  Stripe y factura). Las tarjetas patrocinadas del swipe se ordenan por cercanía.

## Qué hay

- **Admin › Partners:** empresas, locales vinculados, contratos (borrador → activo →
  terminado), gestores por local e invitación de titular (código de un solo uso, 7 días,
  mostrado una vez; en la base solo se guarda su HMAC).
- **Invitación:** enlace público `/invitacion/<código>` (guarda el código en el dispositivo
  para después del alta o del login) y `/venue/invitacion` para canjear aceptando las
  Condiciones para Locales.
- **Panel del local:** «Plan y ventajas» (empresa, contrato, ventajas con origen y fecha fin,
  condiciones aceptadas) y «Equipo» (solo titular). Pro incluido en contrato se indica así.
- **Reclamar** con el flag encendido exige aceptar las Condiciones para Locales.
- Fin de contrato (manual o por fecha, cron diario `nl_venue_partners_maintenance`): terminan
  el patrocinio enlazado y Pro.

## Hecho cuando

- ✅ Flag apagado: panel, ficha, reclamar y guías idénticos (unitarias + E2E).
- ✅ Flag encendido: admin crea empresa + contrato Top + Pro + invitación; el local la canjea,
  acepta las condiciones y ve su plan; el titular invita y quita encargados (unitarias + E2E).
- ✅ SQL por rol (`supabase/tests/partners.sql`): anónimo, usuario, admin aal1/aal2, titular,
  encargado; flag apagado; código erróneo/usado/revocado/caducado; condiciones; huecos;
  fin de contrato; auditoría.
- ✅ Suites previas repetidas (RLS, block9, premium-completion), guías, docs.
