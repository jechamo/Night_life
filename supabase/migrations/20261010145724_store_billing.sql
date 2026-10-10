-- Bloque 11b: compras en tiendas (RevenueCat; en pruebas, Test Store) con el mismo catálogo,
-- entitlements y créditos que Stripe. Aditiva: columnas y valores nuevos, funciones nuevas y
-- redefinición de withdrawal_quote (las compras de tienda las reembolsa la tienda). Sin borrados.

-- Proveedor `test_store` además de stripe/apple/google.
alter table public.subscriptions drop constraint subscriptions_provider_check;
alter table public.subscriptions add constraint subscriptions_provider_check
  check (provider in ('stripe', 'apple', 'google', 'test_store'));
alter table public.payment_events drop constraint payment_events_provider_check;
alter table public.payment_events add constraint payment_events_provider_check
  check (provider in ('stripe', 'apple', 'google', 'test_store'));
alter table public.invoices drop constraint invoices_provider_check;
alter table public.invoices add constraint invoices_provider_check
  check (provider in ('stripe', 'apple', 'google', 'test_store'));
alter table public.entitlements drop constraint entitlements_source_check;
alter table public.entitlements add constraint entitlements_source_check
  check (source in ('admin', 'promo', 'tester', 'stripe', 'apple', 'google', 'test_store'));

-- Pedidos de tienda: proveedor y transacción de RevenueCat (idempotencia).
alter table public.purchase_orders
  add column provider text not null default 'stripe'
    check (provider in ('stripe', 'apple', 'google', 'test_store')),
  add column store_transaction_id text unique check (char_length(store_transaction_id) <= 300);

-- Identificadores por tienda. Test Store usa el código del plan; los live (App Store y
-- Google Play) quedan propuestos para el Bloque 12 y no se usan en modo test.
alter table public.plans add column store_product_test text unique
  check (store_product_test ~ '^[a-z0-9_.]{3,100}$');
update public.plans set
  store_product_test = code,
  apple_product_id = coalesce(apple_product_id, 'com.nightlifeconnect.app.' || code),
  google_product_id = coalesce(google_product_id, code)
where active;

-- Igual que billing_grant, pero con el origen de la tienda.
create or replace function private.store_grant(p_user uuid, p_code text, p_mode text,
  p_source text, p_ref text, p_until timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
declare p public.plans; c jsonb;
begin
 select * into p from public.plans where code = p_code;
 if p_until is null or p_until > now() then
  insert into public.entitlements(user_id, key, source, mode, origin_ref, ends_at)
  select p_user, key, p_source, p_mode, p_ref, p_until from unnest(p.entitlements) key
  on conflict(user_id, key, origin_ref) where origin_ref is not null
  do update set status = 'active', ends_at = excluded.ends_at;
 end if;
 for c in select value from jsonb_array_elements(p.credits) loop
  insert into public.credit_ledger(user_id, kind, delta, reason, mode, origin_ref)
  values(p_user, c->>'kind', (c->>'amount')::int, 'purchase', p_mode, p_ref || ':initial')
  on conflict do nothing;
 end loop;
end $$;

-- Retira ventajas y créditos de una compra reembolsada, sin dejar saldo negativo.
create or replace function private.store_revoke(p_user uuid, p_mode text, p_ref text)
returns void language plpgsql security definer set search_path = '' as $$
declare c record; bal int;
begin
 update public.entitlements set status = 'revoked' where user_id = p_user and origin_ref = p_ref and status = 'active';
 for c in select kind, sum(delta)::int amount from public.credit_ledger
  where user_id = p_user and origin_ref = p_ref || ':initial' group by kind loop
  select coalesce(sum(delta), 0)::int into bal from public.credit_ledger
   where user_id = p_user and kind = c.kind and mode = p_mode;
  if least(c.amount, bal) > 0 then
   insert into public.credit_ledger(user_id, kind, delta, reason, mode, origin_ref)
   values(p_user, c.kind, -least(c.amount, bal), 'refund', p_mode, p_ref || ':refund') on conflict do nothing;
  end if;
 end loop;
end $$;

-- Aplica el estado que la Edge Function ha leído en la API de RevenueCat (nunca el contenido
-- de un webhook). Idempotente: suscripción por id de RevenueCat y compra por transacción.
-- Solo se aplican compras del modo de pagos vigente; en test, solo a testers/admin.
create or replace function private.store_apply(p_user uuid, p jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
#variable_conflict use_variable
declare
 payments_mode text := private.flag_value('payments_mode');
 tester boolean := exists(select 1 from public.user_roles where user_id = p_user and role in ('tester', 'admin'));
 item jsonb; pl public.plans; o public.purchase_orders; sub public.subscriptions;
 provider text; mode text; ref text; until_at timestamptz; at_time timestamptz; st text;
 applied int := 0; skipped int := 0; venue uuid;
begin
 if p_user is null or not exists(select 1 from public.profiles where id = p_user) then
  raise exception 'unknown customer' using errcode = '22023';
 end if;
 if jsonb_typeof(p->'subscriptions') is distinct from 'array' or jsonb_typeof(p->'purchases') is distinct from 'array'
  or char_length(coalesce(p->>'eventId', '')) not between 1 and 200 then
  raise exception 'invalid snapshot' using errcode = '22023';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('store:' || p_user::text, 0));
 insert into public.payment_events(provider, provider_event_id, type, mode, user_id)
 values('test_store', p->>'eventId', 'store_' || coalesce(p->>'source', 'sync'), coalesce(nullif(payments_mode, 'disabled'), 'test'), p_user)
 on conflict(provider, provider_event_id) do nothing;

 for item in select value from jsonb_array_elements(p->'subscriptions') loop
  provider := case item->>'store' when 'test_store' then 'test_store' when 'app_store' then 'apple' when 'play_store' then 'google' end;
  mode := case when item->>'store' = 'test_store' or item->>'environment' = 'sandbox' then 'test' else 'live' end;
  select * into pl from public.plans where (mode = 'test' and store_product_test = item->>'productIdentifier')
   or (mode = 'live' and provider = 'apple' and apple_product_id = item->>'productIdentifier')
   or (mode = 'live' and provider = 'google' and split_part(google_product_id, ':', 1) = split_part(item->>'productIdentifier', ':', 1));
  if provider is null or not found or pl.billing_interval is null or mode <> payments_mode or (mode = 'test' and not tester)
   or char_length(coalesce(item->>'id', '')) not between 1 and 255 then skipped := skipped + 1; continue; end if;
  ref := 'rc:' || (item->>'id');
  until_at := (item->>'periodEnd')::timestamptz;
  st := case when not coalesce((item->>'givesAccess')::boolean, false) or until_at is null or until_at <= now() then 'expired'
   when item->>'status' = 'in_billing_retry' then 'past_due'
   when item->>'autoRenewal' = 'will_not_renew' then 'cancel_at_period_end' else 'active' end;
  select * into sub from public.subscriptions where provider_subscription_id = ref for update;
  if found and sub.user_id is distinct from p_user then skipped := skipped + 1; continue; end if;
  if not found then
   venue := null;
   if pl.kind = 'b2b' then
    -- Pro de local: solo con una reserva previa del mismo gestor (store_start_venue_order).
    select * into o from public.purchase_orders where user_id = p_user and plan_code = pl.code and purchase_orders.provider = provider
     and status = 'pending' and venue_id is not null and created_at > now() - interval '24 hours'
     order by created_at desc limit 1 for update;
    if not found then skipped := skipped + 1; continue; end if;
    venue := o.venue_id;
    update public.purchase_orders set status = 'paid', paid_at = now(), provider_subscription_id = ref, store_transaction_id = ref where id = o.id;
   else
    insert into public.purchase_orders(user_id, plan_code, mode, amount_cents, provider, status, paid_at, provider_subscription_id, store_transaction_id)
    values(p_user, pl.code, mode, pl.price_cents, provider, 'paid', coalesce((item->>'startsAt')::timestamptz, now()), ref, ref);
   end if;
   insert into public.subscriptions(user_id, plan_code, provider, provider_customer_id, provider_subscription_id, status, current_period_end, mode, venue_id, cancel_at_period_end)
   values(p_user, pl.code, provider, p_user::text, ref, st, coalesce(until_at, now()), mode, venue, st = 'cancel_at_period_end');
   perform private.billing_queue(p_user, 'purchase', ref);
  else
   update public.subscriptions set status = case when status = 'withdrawn' then 'withdrawn' else st end,
    current_period_end = coalesce(until_at, current_period_end), cancel_at_period_end = st = 'cancel_at_period_end' where id = sub.id;
  end if;
  if st in ('active', 'cancel_at_period_end') then
   if pl.kind <> 'b2b' then perform private.store_grant(p_user, pl.code, mode, provider, ref, until_at); end if;
   if item->>'periodStart' is not null then
    insert into public.invoices(user_id, plan_code, provider, provider_invoice_id, amount_cents, status, mode)
    values(p_user, pl.code, provider, ref || ':' || (item->>'periodStart'), pl.price_cents, 'paid', mode)
    on conflict(provider_invoice_id) do nothing;
   end if;
  else
   update public.entitlements set status = 'revoked' where user_id = p_user and origin_ref = ref and status = 'active';
  end if;
  applied := applied + 1;
 end loop;

 for item in select value from jsonb_array_elements(p->'purchases') loop
  provider := case item->>'store' when 'test_store' then 'test_store' when 'app_store' then 'apple' when 'play_store' then 'google' end;
  mode := case when item->>'store' = 'test_store' or item->>'environment' = 'sandbox' then 'test' else 'live' end;
  select * into pl from public.plans where (mode = 'test' and store_product_test = item->>'productIdentifier')
   or (mode = 'live' and provider = 'apple' and apple_product_id = item->>'productIdentifier')
   or (mode = 'live' and provider = 'google' and google_product_id = item->>'productIdentifier');
  if provider is null or not found or pl.billing_interval is not null or mode <> payments_mode or (mode = 'test' and not tester)
   or char_length(coalesce(item->>'id', '')) not between 1 and 255 then skipped := skipped + 1; continue; end if;
  ref := 'rc:' || (item->>'id');
  at_time := least(coalesce((item->>'purchasedAt')::timestamptz, now()), now());
  select * into o from public.purchase_orders where store_transaction_id = ref for update;
  if found and o.user_id is distinct from p_user then skipped := skipped + 1; continue; end if;
  if item->>'status' = 'owned' and not found then
   if pl.kind = 'b2b' then
    -- Patrocinio: la plaza se reservó antes de comprar (cupos por ciudad y fechas).
    select * into o from public.purchase_orders where user_id = p_user and plan_code = pl.code and purchase_orders.provider = provider
     and status = 'pending' and venue_id is not null and created_at > at_time - interval '24 hours'
     order by created_at desc limit 1 for update;
    if not found then skipped := skipped + 1; continue; end if;
    update public.purchase_orders set status = 'paid', paid_at = at_time, store_transaction_id = ref where id = o.id returning * into o;
    insert into public.sponsorships(venue_id, tier, status, starts_on, ends_on, requested_by, invoice_ref, mode, purchase_order_id)
    values(o.venue_id, substr(o.plan_code, 9), 'active', o.sponsorship_from, o.sponsorship_from + 29, o.user_id,
     case provider when 'apple' then 'App Store' when 'google' then 'Google Play' else 'Test Store' end, o.mode, o.id)
    on conflict(purchase_order_id) do nothing;
   else
    insert into public.purchase_orders(user_id, plan_code, mode, amount_cents, provider, status, paid_at, store_transaction_id)
    values(p_user, pl.code, mode, pl.price_cents, provider, 'paid', at_time, ref) returning * into o;
    perform private.store_grant(p_user, pl.code, mode, provider, o.id::text,
     case when pl.kind = 'one_night' then private.next_night_end(at_time) end);
   end if;
   insert into public.invoices(user_id, plan_code, provider, provider_invoice_id, amount_cents, status, mode)
   values(p_user, pl.code, provider, ref, pl.price_cents, 'paid', mode) on conflict(provider_invoice_id) do nothing;
   perform private.billing_queue(p_user, 'purchase', o.id::text);
   applied := applied + 1;
  elsif item->>'status' = 'refunded' and found and o.status = 'paid' then
   update public.purchase_orders set status = 'refunded', refunded_at = now(), refunded_cents = amount_cents where id = o.id;
   update public.invoices set status = 'refunded' where provider_invoice_id = ref;
   perform private.store_revoke(p_user, o.mode, o.id::text);
   update public.sponsorships set status = 'ended' where purchase_order_id = o.id and status = 'active';
   applied := applied + 1;
  end if;
 end loop;

 perform realtime.send('{}', 'refresh', 'social:' || p_user::text, true);
 return jsonb_build_object('applied', applied, 'skipped', skipped);
end $$;

-- Estado de compras de tienda para la persona (store-config): solo con pagos de tienda
-- activos y en el modo vigente; nunca live antes del Bloque 12.
create or replace function private.store_access()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_payment_access(); payments_mode text := private.flag_value('payments_mode');
begin
 if not public.feature_enabled('store_payments_enabled') or payments_mode <> 'test' then
  raise exception 'store_disabled' using errcode = '42501';
 end if;
 return jsonb_build_object('userId', u, 'mode', payments_mode, 'products',
  (select coalesce(jsonb_object_agg(code, store_product_test), '{}') from public.plans where active and store_product_test is not null));
end $$;

-- Reserva de local antes de comprar en la tienda (mismas reglas que Stripe).
create or replace function private.store_start_venue_order(p_code text, p_venue uuid, p_from date default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r jsonb := private.store_access(); o jsonb;
begin
 o := private.billing_start_venue_order(p_code, p_venue, p_from);
 update public.purchase_orders set provider = 'test_store' where id = (o->>'id')::uuid and status = 'pending';
 return jsonb_build_object('orderId', o->>'id', 'productIdentifier', r->'products'->>p_code);
end $$;

-- Desistimiento propio solo para Stripe: las compras de tienda las reembolsa la tienda.
create or replace function private.withdrawal_quote(p_order uuid, p_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  o public.purchase_orders;
  pl public.plans;
  s public.subscriptions;
  c record;
  bal int;
  until_at timestamptz;
  refund int;
  base jsonb;
begin
  select * into o from public.purchase_orders where id = p_order and user_id = p_user;
  if not found then
    return jsonb_build_object('eligible', false, 'reason', 'not_found');
  end if;
  select * into pl from public.plans where code = o.plan_code;
  base := jsonb_build_object('orderId', o.id, 'productCode', o.plan_code, 'amountCents', o.amount_cents);
  if o.status = 'refunded' then
    return base || jsonb_build_object('eligible', false, 'reason', 'already_refunded');
  end if;
  if o.status <> 'paid' or o.paid_at is null then
    return base || jsonb_build_object('eligible', false, 'reason', 'not_paid');
  end if;
  if o.provider <> 'stripe' then
    return base || jsonb_build_object('eligible', false, 'reason', 'store');
  end if;
  if pl.kind = 'b2b' or o.venue_id is not null then
    return base || jsonb_build_object('eligible', false, 'reason', 'business');
  end if;
  if o.paid_at < now() - interval '14 days' then
    return base || jsonb_build_object('eligible', false, 'reason', 'window_closed');
  end if;
  -- Without the express request to start now, the full right of withdrawal remains.
  if o.immediate_start_at is null then
    return base || jsonb_build_object('eligible', true, 'refundCents', o.amount_cents, 'basis', 'full');
  end if;

  if pl.kind = 'credits' then
    for c in
      select kind, sum(delta)::int amount from public.credit_ledger
      where user_id = p_user and origin_ref = o.id::text || ':initial' group by kind
    loop
      select coalesce(sum(delta), 0)::int into bal from public.credit_ledger
      where user_id = p_user and kind = c.kind and mode = o.mode;
      if bal < c.amount then
        return base || jsonb_build_object('eligible', false, 'reason', 'credits_used');
      end if;
    end loop;
    return base || jsonb_build_object('eligible', true, 'refundCents', o.amount_cents, 'basis', 'unused');
  end if;

  if pl.kind = 'subscription' then
    select * into s from public.subscriptions where provider_subscription_id = o.provider_subscription_id;
    if not found or s.status in ('withdrawn', 'expired') then
      return base || jsonb_build_object('eligible', false, 'reason', 'ended');
    end if;
    until_at := s.current_period_end;
  elsif pl.kind = 'one_night' then
    select max(ends_at) into until_at from public.entitlements
    where user_id = p_user and origin_ref = o.id::text and status = 'active';
  end if;

  if until_at is null or until_at <= now() then
    return base || jsonb_build_object('eligible', false, 'reason', 'used');
  end if;
  refund := floor(
    o.amount_cents * extract(epoch from (until_at - now()))
      / greatest(1, extract(epoch from (until_at - o.paid_at)))
  )::int;
  if refund <= 0 then
    return base || jsonb_build_object('eligible', false, 'reason', 'used');
  end if;
  return base || jsonb_build_object(
    'eligible', true, 'refundCents', least(refund, o.amount_cents), 'basis', 'prorated', 'until', until_at);
end $$;

-- Envoltorios públicos.
create or replace function public.store_apply(p_user uuid, p jsonb)
returns jsonb language sql set search_path = '' as $$ select private.store_apply(p_user, p) $$;
create or replace function public.store_access()
returns jsonb language sql set search_path = '' as $$ select private.store_access() $$;
create or replace function public.store_start_venue_order(p_code text, p_venue uuid, p_from date default null)
returns jsonb language sql set search_path = '' as $$ select private.store_start_venue_order(p_code, p_venue, p_from) $$;

revoke all on function private.store_grant(uuid, text, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function private.store_revoke(uuid, text, text) from public, anon, authenticated;
revoke all on function private.store_apply(uuid, jsonb) from public, anon, authenticated;
revoke all on function private.store_access() from public, anon;
revoke all on function private.store_start_venue_order(text, uuid, date) from public, anon;
revoke all on function public.store_apply(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.store_access() from public, anon;
revoke all on function public.store_start_venue_order(text, uuid, date) from public, anon;
grant execute on function private.store_apply(uuid, jsonb) to service_role;
grant execute on function public.store_apply(uuid, jsonb) to service_role;
grant execute on function private.store_access() to authenticated;
grant execute on function public.store_access() to authenticated;
grant execute on function private.store_start_venue_order(text, uuid, date) to authenticated;
grant execute on function public.store_start_venue_order(text, uuid, date) to authenticated;
