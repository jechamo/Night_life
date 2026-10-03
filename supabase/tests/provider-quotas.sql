-- Minimal publication gate for quota controls. No requests to Mapbox/Google.
-- Always aborts the transaction with a result summary; owner data is untouched.
begin;
insert into auth.users(id,instance_id,aud,role,phone,phone_confirmed_at,created_at,updated_at)
values('00000000-0000-4000-8000-00000000b701','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','34600999701',now(),now(),now());
insert into public.profiles(id,name,birthdate,gender,onboarded_at,is_test)
values('00000000-0000-4000-8000-00000000b701','Quota test','1990-01-01','other',now(),true);
create temp table _results(test text primary key,ok boolean not null);
grant all on _results to authenticated;
insert into _results values('anon cannot configure',not has_function_privilege('anon',
 'public.admin_configure_provider(text,integer,integer,boolean,integer)','execute'));
insert into _results values('client cannot reserve quota',not has_function_privilege('authenticated',
 'public.provider_reserve(text,text,integer)','execute'));
insert into _results values('no public definer',not exists(select 1 from pg_proc p join pg_namespace n
 on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef));
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b701","role":"authenticated","aal":"aal2"}',true);
do $$ begin
 begin perform public.admin_configure_provider('mapbox',1000,2000,true);
  insert into _results values('non-admin denied',false);
 exception when insufficient_privilege then insert into _results values('non-admin denied',true); end;
end $$;
reset role;
insert into public.user_roles(user_id,role) values('00000000-0000-4000-8000-00000000b701','admin');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b701","role":"authenticated","aal":"aal1"}',true);
do $$ begin
 begin perform public.admin_configure_provider('mapbox',1000,2000,true);
  insert into _results values('MFA required',false);
 exception when insufficient_privilege then insert into _results values('MFA required',true); end;
end $$;
reset role;
update private.provider_access set monthly_used=42,monthly_reset_on=date_trunc('month',now() at time zone 'UTC')::date,
 daily_used=1,daily_reset_on=(now() at time zone 'UTC')::date where capability='mapbox' and mode='free_quota';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-00000000b701","role":"authenticated","aal":"aal2"}',true);
select public.admin_configure_provider('mapbox',1000,2000,true);
do $$ begin
 begin perform public.admin_configure_provider('mapbox',45001,45001,true);
  insert into _results values('free margin enforced',false);
 exception when invalid_parameter_value then insert into _results values('free margin enforced',true); end;
 begin perform public.admin_configure_provider('google_places',20,20,true,0);
  insert into _results values('unverified Google denied',false);
 exception when invalid_parameter_value then insert into _results values('unverified Google denied',true); end;
end $$;
select public.admin_set_map_token('pk.eyJ1IjoibmlnaHRsaWZlLXRlc3QifQ.abcdefghij');
reset role;
insert into _results select 'admin sets public token',public_token like 'pk.%' from private.provider_access
 where capability='mapbox' and mode='free_quota';
set local role authenticated;
do $$ begin
 begin perform public.admin_set_map_token('sk.eyJ1IjoibmlnaHRsaWZlLXRlc3QifQ.abcdefghij');
  insert into _results values('admin cannot set secret token',false);
 exception when invalid_parameter_value then insert into _results values('admin cannot set secret token',true); end;
end $$;
reset role;
insert into _results select 'cap change preserves usage',monthly_used=42 and monthly_budget=2000
 from private.provider_access where capability='mapbox' and mode='free_quota';
insert into _results select 'change audited',exists(select 1 from public.admin_audit_log
 where actor_id='00000000-0000-4000-8000-00000000b701' and action='provider.configure');
update private.provider_access set monthly_used=0,daily_used=0,daily_budget=2,monthly_budget=2,
 available=true,free_access_confirmed=true,observed_provider_usage=0,
 usage_observed_at=now(),expires_at=now()+interval '1 hour'
 where capability='mapbox' and mode='free_quota';
insert into _results values('first reservation allowed',private.provider_consume('mapbox','free_quota',1));
insert into _results values('second reservation allowed',private.provider_consume('mapbox','free_quota',1));
insert into _results values('third blocked',not private.provider_consume('mapbox','free_quota',1));
insert into _results select 'no overshoot',monthly_used=2 and daily_used=2 from private.provider_access
 where capability='mapbox' and mode='free_quota';
update private.provider_access set expires_at=now()-interval '1 minute' where capability='mapbox' and mode='free_quota';
insert into _results values('expired proof blocks',not private.provider_consume('mapbox','free_quota',1));
set local role authenticated;
do $$ begin
 begin perform public.admin_configure_provider('mapbox',1000,2000,true);
  insert into _results values('renewal requires observation',false);
 exception when invalid_parameter_value then insert into _results values('renewal requires observation',true); end;
end $$;
select public.admin_configure_provider('mapbox',1000,2000,true,10000);
reset role;
insert into _results select 'observation lowers ceiling',maxBudget=35000 from
 (select (q->>'maxBudget')::integer as maxBudget from
   jsonb_array_elements(private.admin_provider_access()) q where q->>'capability'='mapbox') x;
insert into _results values('Google remains blocked',not private.provider_available('google_places','free_quota'));
do $$ begin
 raise exception 'QUOTA RESULTS % passed / % failed: %',
 (select count(*) from _results where ok),(select count(*) from _results where not ok),
 coalesce((select string_agg(test,'; ') from _results where not ok),'none failed');
end $$;
