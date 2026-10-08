-- Isolate wallet display by payment mode; billing access stays with the payer.
create or replace function private.premium_state() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); sub jsonb; inv jsonb; credits jsonb; night timestamptz;
begin
 select jsonb_build_object('id',id,'productCode',plan_code,'provider',provider,'status',status,'startedAt',started_at,'currentPeriodEnd',current_period_end,'simulated',simulated)
 into sub from public.subscriptions where venue_id is null and user_id=u and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) order by started_at desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'productCode',plan_code,'amountCents',amount_cents,'issuedAt',issued_at,'status',status,'url',hosted_url,'orderId',(select po.id from public.purchase_orders po where po.provider_payment_intent_id=invoices.payment_intent_id and po.user_id=u limit 1)) order by issued_at desc),'[]')
 into inv from public.invoices where user_id=u and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live'));
 select jsonb_object_agg(kind,amount) into credits from(select kind,greatest(0,coalesce((select sum(delta) from public.credit_ledger where user_id=u and credit_ledger.kind=ck.kind and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live'))),0)) amount from unnest(array['spark','spotlight','paid_dm']) ck(kind)) balances;
 select max(ends_at) into night from public.entitlements where user_id=u and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) and status='active' and ends_at>now() and origin_ref in(select id::text from public.purchase_orders where user_id=u and plan_code='one_night' and status='paid');
 return jsonb_build_object('subscription',sub,'invoices',inv,'credits',credits,'oneNightUntil',night,'notifyMe',coalesce((select notify_me from private.billing_profiles where user_id=u),false));
end $$;
create or replace function private.venue_billing_state(p_venue uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare sub jsonb;
begin
 perform private.require_venue_manager(p_venue);
 select jsonb_build_object('id',id,'status',status,'currentPeriodEnd',current_period_end,'canManage',user_id=auth.uid()) into sub from public.subscriptions where venue_id=p_venue and plan_code='venue_pro_monthly' and (mode='live' or private.sees_test_data()) order by started_at desc limit 1;
 return jsonb_build_object('pro',private.venue_has_pro(p_venue),'subscription',sub);
end $$;
create or replace function private.venue_stats(p_venue uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb; by_hour jsonb; n int; pro boolean; zone_average numeric;
begin
 perform private.require_venue_manager(p_venue);
 perform private.case_limit('venue-stats',120);
 pro:=private.venue_has_pro(p_venue);
 if pro then
 select case when count(distinct a.user_id)>=5 and count(distinct a.venue_id)>=3 then round(count(*)::numeric/count(distinct a.venue_id),1) end into zone_average
 from public.attendance a join public.venues v on v.id=a.venue_id join public.venues own on own.id=p_venue
 where a.kind='check_in' and a.created_at>=now()-interval '7 days' and a.venue_id<>p_venue
 and extensions.st_dwithin(v.location,own.location,5000) and (not v.is_test or private.sees_test_data());
 end if;
 -- No individual identities or fine-grained timestamps; small hourly cohorts hidden.
 select coalesce(jsonb_agg(jsonb_build_object('hour',hour_of_day,'people',case when people>=5 then people else 0 end) order by hour_of_day),'[]') into by_hour
 from(select extract(hour from created_at at time zone 'Europe/Madrid')::int as hour_of_day,count(distinct user_id) people
 from public.attendance where venue_id=p_venue and kind='check_in' and created_at>=now()-interval '7 days' group by 1) h;
 select count(distinct user_id) into n from public.attendance where venue_id=p_venue and kind='check_in' and created_at>=now()-interval '7 days';
 select private.threshold_stats(people,average_age,green_percent,ratio,going_tonight) into s from public.place_stats where venue_id=p_venue;
 return jsonb_build_object('pro',pro,'zoneAverageCheckIns',zone_average,'byHour',case when pro then by_hour else '[]'::jsonb end,'averageAge',case when pro then s->'averageAge' else 'null'::jsonb end,'greenPercent',case when pro then s->'greenPercent' else 'null'::jsonb end,
 'checkInsWeek',case when n>=5 then n else 0 end,'goingTonight',coalesce(s->'goingTonight','0'));
end $$;
