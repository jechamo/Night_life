# Migraciones pendientes de aplicar (R3)

Las partes 1-3 de `venue_partners` ya están aplicadas y versionadas en `supabase/migrations/`
(`20261008141727_venue_partners_schema`, `…141802_venue_partners_helpers`,
`…141836_venue_partners_slots`). Faltan:

- `venue_partners_admin.sql` (4/5): funciones del admin (empresas, contratos, invitaciones).
- `venue_partners_venue.sql` (5/5): funciones del local (invitación, plan, equipo).

Cada una necesita la aprobación del propietario en `apply_migration`. Al aplicarse se mueven a
`supabase/migrations/<versión>_<nombre>.sql` y se regeneran los tipos. Mientras tanto el flag
`venue_partners_enabled` existe y está apagado: nada cambia para usuarios ni locales.
