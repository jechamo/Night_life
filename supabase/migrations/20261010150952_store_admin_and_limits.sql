-- Bloque 11b: catálogo esperado para la verificación de RevenueCat (solo admin con MFA,
-- auditado) y límite de sincronizaciones por persona/red. Aditiva.

create or replace function private.store_admin_catalog()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
 perform private.audit('store.catalog_check', null);
 return (select coalesce(jsonb_agg(jsonb_build_object(
   'code', code, 'kind', kind, 'priceCents', price_cents, 'interval', billing_interval,
   'intervalCount', billing_interval_count, 'test', store_product_test,
   'apple', apple_product_id, 'google', google_product_id) order by kind, code), '[]')
  from public.plans where active);
end $$;

-- Sincronizar consulta la API de RevenueCat con la clave secreta: 60 por hora y red.
create or replace function private.store_sync_access()
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
 perform private.case_limit('store_sync', 60);
 return private.store_access();
end $$;

create or replace function public.store_admin_catalog()
returns jsonb language sql set search_path = '' as $$ select private.store_admin_catalog() $$;
create or replace function public.store_sync_access()
returns jsonb language sql set search_path = '' as $$ select private.store_sync_access() $$;

revoke all on function private.store_admin_catalog() from public, anon;
revoke all on function private.store_sync_access() from public, anon;
revoke all on function public.store_admin_catalog() from public, anon;
revoke all on function public.store_sync_access() from public, anon;
grant execute on function private.store_admin_catalog() to authenticated;
grant execute on function private.store_sync_access() to authenticated;
grant execute on function public.store_admin_catalog() to authenticated;
grant execute on function public.store_sync_access() to authenticated;
