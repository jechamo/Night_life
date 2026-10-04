-- Public invoker must only use functions granted to the caller (flag helper is closed).
create or replace function public.has_entitlement(_key text) returns boolean
language sql stable security invoker set search_path='' as $$
 select public.feature_enabled('premium_enabled') and exists(select 1 from public.entitlements
 where user_id=(select auth.uid()) and key=_key and status='active' and starts_at<=now() and (ends_at is null or ends_at>now())
 and (mode='live' or (coalesce((select value from public.app_settings where key='payments_mode'),'disabled')<>'live' and private.sees_test_data())))
$$;
