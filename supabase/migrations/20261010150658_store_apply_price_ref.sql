-- Bloque 11b: store_apply guarda en `purchase_orders.price_id` (obligatorio) la referencia
-- del producto de la tienda (`proveedor:identificador`). Sin cambios de privilegios.
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
 on conflict on constraint payment_events_provider_provider_event_id_key do nothing;

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
    insert into public.purchase_orders(user_id, plan_code, mode, amount_cents, price_id, provider, status, paid_at, provider_subscription_id, store_transaction_id)
    values(p_user, pl.code, mode, pl.price_cents, provider || ':' || (item->>'productIdentifier'), provider, 'paid', coalesce((item->>'startsAt')::timestamptz, now()), ref, ref);
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
    insert into public.purchase_orders(user_id, plan_code, mode, amount_cents, price_id, provider, status, paid_at, store_transaction_id)
    values(p_user, pl.code, mode, pl.price_cents, provider || ':' || (item->>'productIdentifier'), provider, 'paid', at_time, ref) returning * into o;
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
