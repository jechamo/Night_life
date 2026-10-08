# Migraciones pendientes de aplicar

`venue_partners.sql` (roadmap R3) está escrita pero **no aplicada**: Supabase exige la
aprobación del propietario para `apply_migration`. Cuando se aplique, se mueve a
`supabase/migrations/<versión>_venue_partners.sql` con la versión que asigne Supabase y se
regeneran los tipos. Hasta entonces el flag `venue_partners_enabled` no existe en el servidor
(equivale a apagado) y las pantallas nuevas no se ven con el flag apagado.
