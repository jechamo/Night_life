-- Async worker delivery requires pg_net; it creates its own net schema.
-- https://supabase.com/docs/guides/database/extensions/pg_net
create extension if not exists pg_net with schema extensions;

-- Worker headers include a Vault credential and stay server-only.
revoke all on schema net from public,anon,authenticated;
revoke all on all tables in schema net from public,anon,authenticated;
revoke all on all functions in schema net from public,anon,authenticated;
