-- Desistimiento conforme a la práctica legal habitual (TRLGDCU arts. 103 y 108):
--  * Créditos (Chispas, Focos, Mensajes): reembolso solo si no se ha usado ninguno de esa compra.
--  * Servicios por tiempo (suscripciones, Pase de una noche): se devuelve la parte no disfrutada.
--  * Compras de locales (B2B): no aplica el desistimiento de consumidores.
--  * Sin consentimiento expreso de inicio inmediato: reembolso completo (como hasta ahora).
-- Aditiva: columnas nuevas, funciones nuevas y redefinición de simulate_billing. Sin DELETE.

alter table public.purchase_orders
  add column if not exists immediate_start_at timestamptz,
  add column if not exists refunded_cents int check (refunded_cents >= 0);

comment on column public.purchase_orders.immediate_start_at is
  'Momento en que la persona pidió empezar ya y aceptó perder el desistimiento en lo que use.';

-- Cotización: decide si se puede desistir de un pedido y cuánto se devuelve.
create or replace function private.withdrawal_quote(p_order uuid, p_user uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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

-- Aplica un desistimiento ya reembolsado (o simulado). Idempotente por pedido.
create or replace function private.billing_withdrawal_apply(p_order uuid, p_refunded int, p_ref text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  o public.purchase_orders;
  c record;
  bal int;
  take int;
begin
  if p_refunded is null or p_refunded < 0 then
    raise exception 'invalid refund' using errcode = '22023';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('billing-event:' || p_order::text, 0));
  update public.purchase_orders
    set status = 'refunded', refunded_at = now(), refunded_cents = least(p_refunded, amount_cents)
    where id = p_order and status = 'paid'
    returning * into o;
  if not found then
    return jsonb_build_object('ignored', true);
  end if;
  insert into public.payment_events(provider, provider_event_id, type, mode, simulated, user_id)
    values ('stripe', 'withdraw:' || left(coalesce(p_ref, o.id::text), 200), 'refund', o.mode, o.simulated, o.user_id)
    on conflict (provider, provider_event_id) do nothing;
  update public.invoices set status = 'refunded'
    where payment_intent_id = o.provider_payment_intent_id;
  update public.entitlements set status = 'revoked'
    where user_id = o.user_id and origin_ref = coalesce(o.provider_subscription_id, o.id::text);
  if o.provider_subscription_id is not null then
    update public.subscriptions
      set status = 'withdrawn', withdrawal_requested_at = now(), current_period_end = now()
      where provider_subscription_id = o.provider_subscription_id;
  end if;
  -- Only what is left is taken back: the balance never goes negative.
  for c in
    select kind, sum(delta)::int amount from public.credit_ledger
    where user_id = o.user_id
      and origin_ref = coalesce(o.provider_subscription_id, o.id::text) || ':initial'
    group by kind
  loop
    select coalesce(sum(delta), 0)::int into bal from public.credit_ledger
      where user_id = o.user_id and kind = c.kind and mode = o.mode;
    take := least(c.amount, greatest(bal, 0));
    if take > 0 then
      insert into public.credit_ledger(user_id, kind, delta, reason, mode, origin_ref)
        values (o.user_id, c.kind, -take, 'withdrawal', o.mode, o.id::text || ':refund')
        on conflict do nothing;
    end if;
  end loop;
  perform private.billing_queue(o.user_id, 'withdrawal', o.id::text);
  perform realtime.send('{}', 'refresh', 'social:' || o.user_id::text, true);
  return jsonb_build_object('processed', true, 'refundedCents', least(p_refunded, o.amount_cents));
end $$;

-- Consentimiento de inicio inmediato, guardado en el pedido antes de abrir el pago.
create or replace function private.billing_record_consent(p_order uuid, p_user uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.purchase_orders
    set immediate_start_at = coalesce(immediate_start_at, now())
    where id = p_order and user_id = p_user and status in ('pending', 'expired') and venue_id is null
$$;

-- Cotización de la propia persona; sin pedido, el de su suscripción actual.
create or replace function private.my_withdrawal_quote(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := private.require_account();
  target uuid := p_order;
begin
  perform private.case_limit('withdrawal_quote', 60);
  if target is null then
    select po.id into target
    from public.subscriptions s
    join public.purchase_orders po on po.provider_subscription_id = s.provider_subscription_id
    where s.user_id = u and s.venue_id is null and po.user_id = u and po.status in ('paid', 'refunded')
    order by s.started_at desc, po.paid_at desc
    limit 1;
  end if;
  if target is null then
    return jsonb_build_object('eligible', false, 'reason', 'not_found');
  end if;
  return private.withdrawal_quote(target, u);
end $$;

-- Desistimiento de un pedido simulado (testers, payments_mode=test).
create or replace function private.simulate_withdrawal(p_order uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := private.require_account();
  q jsonb;
begin
  if not private.sees_test_data() or not public.feature_enabled('test_tools_enabled')
     or private.flag_value('payments_mode') <> 'test' then
    raise exception 'simulation forbidden' using errcode = '42501';
  end if;
  if not exists (select 1 from public.purchase_orders where id = p_order and user_id = u and simulated) then
    raise exception 'simulated order required' using errcode = 'P0002';
  end if;
  q := private.withdrawal_quote(p_order, u);
  if not coalesce((q->>'eligible')::boolean, false) then
    return jsonb_build_object('error', q->>'reason');
  end if;
  perform private.billing_withdrawal_apply(p_order, (q->>'refundCents')::int, 'sim_' || p_order::text);
  perform private.audit('test_tool.billing', 'withdraw');
  return private.premium_state();
end $$;

-- Simulador: la compra simulada registra el consentimiento (la pantalla lo exige) y el
-- desistimiento simulado sigue las mismas reglas que el real.
create or replace function private.simulate_billing(p_code text, p_action text default 'purchase')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u uuid:=private.require_account(); o jsonb; sub public.subscriptions; ref text; ord uuid; q jsonb;
begin
 if not private.sees_test_data() or not public.feature_enabled('test_tools_enabled') or private.flag_value('payments_mode')<>'test' then raise exception 'simulation forbidden' using errcode='42501'; end if;
 if p_action='purchase' then
  o:=private.billing_start_order(p_code);
  perform private.billing_record_consent((o->>'id')::uuid, u);
  ref:='sim_'||(o->>'id');
  perform private.billing_apply(jsonb_build_object('eventId',ref,'type','checkout','mode','test','simulated',true,'orderId',o->>'id','sessionId',ref,'amount',o->>'amount','currency','eur','paymentIntentId',ref,
   'subscriptionId',case when o->>'kind'='subscription' then ref end,'periodEnd',now()+interval '1 month'));
 elsif p_action in('cancel','resume','withdraw') then
  select * into sub from public.subscriptions where user_id=u and simulated and status in('active','cancel_at_period_end','past_due') order by started_at desc limit 1 for update;
  if not found then raise exception 'simulated subscription required' using errcode='P0002'; end if;
  if p_action='withdraw' then
   select id into ord from public.purchase_orders where provider_subscription_id=sub.provider_subscription_id and user_id=u and status='paid' order by created_at limit 1;
   if ord is null then return jsonb_build_object('error','not_found'); end if;
   q:=private.withdrawal_quote(ord,u);
   if not coalesce((q->>'eligible')::boolean,false) then return jsonb_build_object('error',q->>'reason'); end if;
   perform private.billing_withdrawal_apply(ord,(q->>'refundCents')::int,'sim_'||ord::text);
  else
   perform private.billing_apply(jsonb_build_object('eventId','sim_'||extensions.gen_random_uuid()::text,'type','subscription','mode','test','simulated',true,'subscriptionId',sub.provider_subscription_id,'status','active','periodEnd',sub.current_period_end,'cancelAtPeriodEnd',p_action='cancel'));
  end if;
 else raise exception 'invalid action' using errcode='22023'; end if;
 perform private.audit('test_tool.billing',p_action); return private.premium_state();
end $$;

-- Envoltorios públicos.
create or replace function public.withdrawal_quote(p_order uuid default null)
returns jsonb language sql set search_path = '' as $$ select private.my_withdrawal_quote(p_order) $$;
create or replace function public.simulate_withdrawal(p_order uuid)
returns jsonb language sql set search_path = '' as $$ select private.simulate_withdrawal(p_order) $$;
create or replace function public.billing_withdrawal_apply(p_order uuid, p_refunded int, p_ref text)
returns jsonb language sql set search_path = '' as $$ select private.billing_withdrawal_apply(p_order, p_refunded, p_ref) $$;
create or replace function public.billing_record_consent(p_order uuid, p_user uuid)
returns void language sql set search_path = '' as $$ select private.billing_record_consent(p_order, p_user) $$;

revoke all on function private.withdrawal_quote(uuid, uuid) from public, anon, authenticated;
revoke all on function private.billing_withdrawal_apply(uuid, int, text) from public, anon, authenticated;
revoke all on function private.billing_record_consent(uuid, uuid) from public, anon, authenticated;
revoke all on function private.my_withdrawal_quote(uuid) from public, anon;
revoke all on function private.simulate_withdrawal(uuid) from public, anon;
grant execute on function private.my_withdrawal_quote(uuid) to authenticated;
grant execute on function private.simulate_withdrawal(uuid) to authenticated;

revoke all on function public.withdrawal_quote(uuid) from public, anon;
revoke all on function public.simulate_withdrawal(uuid) from public, anon;
revoke all on function public.billing_withdrawal_apply(uuid, int, text) from public, anon, authenticated;
revoke all on function public.billing_record_consent(uuid, uuid) from public, anon, authenticated;
grant execute on function public.withdrawal_quote(uuid) to authenticated;
grant execute on function public.simulate_withdrawal(uuid) to authenticated;
grant execute on function public.billing_withdrawal_apply(uuid, int, text) to service_role;
grant execute on function public.billing_record_consent(uuid, uuid) to service_role;
grant execute on function private.billing_withdrawal_apply(uuid, int, text) to service_role;
grant execute on function private.billing_record_consent(uuid, uuid) to service_role;

-- Textos legales: Premium 1.1 (sigue inactiva hasta abrir pagos) y Patrocinio 1.2.
insert into public.legal_documents(slug, language, version, status, effective_at, title, summary, sections)
select 'premium', d.language, '1.1', 'inactive', now(), d.title, d.summary, d.sections
from public.legal_documents d
where d.slug = 'premium' and d.version = '1.0'
on conflict (slug, language, version) do nothing;

update public.legal_documents set sections = case language
  when 'es' then jsonb_build_array(
    jsonb_build_object('heading', 'Qué compras', 'body', 'Ventajas de comodidad (Pase, Pase VIP, Pase de una noche) y extras sueltos (Chispas, Foco, Mensaje directo). Precios con IVA incluido antes de pagar.'),
    jsonb_build_object('heading', 'Renovación y cancelación', 'body', 'Las suscripciones se renuevan al final de cada periodo (mes, trimestre o año) hasta que las canceles desde Mi suscripción. Mantienes las ventajas hasta el final del periodo pagado.'),
    jsonb_build_object('heading', 'Inicio inmediato y desistimiento', 'body', 'Tienes 14 días desde la compra para desistir desde Mi suscripción. Al pagar nos pides empezar ya y aceptas perder el desistimiento en lo que uses: los créditos (Chispas, Focos y Mensajes directos) solo se reembolsan si no has usado ninguno de esa compra, y en las suscripciones y el Pase de una noche se devuelve la parte que aún no has disfrutado. En las apps, las compras las gestiona la tienda (Apple o Google) según sus condiciones.'),
    jsonb_build_object('heading', 'Pagos', 'body', 'Los procesa una pasarela segura (Stripe en la web; App Store o Google Play en las apps). Nunca vemos ni guardamos tu tarjeta. Facturas disponibles en Mi suscripción.'))
  else jsonb_build_array(
    jsonb_build_object('heading', 'What you buy', 'body', 'Comfort perks (Pass, VIP Pass, One-night pass) and extras (Sparks, Spotlight, Direct message). Prices include VAT and are shown before paying.'),
    jsonb_build_object('heading', 'Renewal and cancellation', 'body', 'Subscriptions renew at the end of each period (month, quarter or year) until you cancel them from My subscription. You keep the perks until the end of the paid period.'),
    jsonb_build_object('heading', 'Immediate start and withdrawal', 'body', 'You have 14 days from purchase to withdraw from My subscription. When paying you ask us to start right away and accept losing the right of withdrawal for what you use: credits (Sparks, Spotlights and Direct messages) are only refunded if you have not used any from that purchase, and for subscriptions and the One-night pass we refund the part you have not enjoyed yet. In the apps, purchases are handled by the store (Apple or Google) under its terms.'),
    jsonb_build_object('heading', 'Payments', 'body', 'Handled by a secure gateway (Stripe on the web; App Store or Google Play in the apps). We never see or store your card. Invoices are in My subscription.'))
  end
where slug = 'premium' and version = '1.1';

insert into public.legal_documents(slug, language, version, status, effective_at, title, summary, sections)
select 'sponsorship', d.language, '1.2', 'published', now(), d.title, d.summary,
  d.sections || jsonb_build_array(case d.language
    when 'es' then jsonb_build_object('heading', 'Cancelación y reembolsos', 'body', 'Es una contratación entre empresas: no se aplica el derecho de desistimiento de los consumidores. Si el patrocinio o Estadísticas Pro no pueden prestarse por causa nuestra, se reembolsa la parte no prestada. Para cualquier incidencia, escríbenos desde Contacto.')
    else jsonb_build_object('heading', 'Cancellation and refunds', 'body', 'This is a business-to-business contract: the consumer right of withdrawal does not apply. If the sponsorship or Pro stats cannot be provided for reasons on our side, the part not provided is refunded. For any issue, write to us from Contact.')
  end)
from public.legal_documents d
where d.slug = 'sponsorship' and d.version = '1.1'
on conflict (slug, language, version) do nothing;
