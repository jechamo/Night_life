-- Owner authorised capped use of existing paid accounts' free monthly tiers.
-- This is an application limit, not a provider/account billing cap.
alter table private.provider_access drop constraint provider_access_mode_check;
alter table private.provider_access add constraint provider_access_mode_check
  check(mode in ('demo','sandbox','live','fixture','free_quota'));
alter table private.provider_access
  add column sku text not null default '',
  add column free_monthly_allowance integer not null default 0 check(free_monthly_allowance>=0),
  add column safety_margin integer not null default 0 check(safety_margin>=0),
  add column observed_provider_usage integer not null default 0 check(observed_provider_usage>=0),
  add column usage_observed_at timestamptz,
  add column increase_step integer not null default 1 check(increase_step>0);

insert into private.provider_access(capability,mode,available,free_access_confirmed,
  expires_at,daily_budget,monthly_budget,sku,free_monthly_allowance,safety_margin,
  observed_provider_usage,usage_observed_at,increase_step,notes)
values
 ('mapbox','free_quota',true,true,
  (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')+interval '1 month',
  1000,1000,'map_loads_web',50000,5000,0,now(),1000,
  'Owner reports Standard/PAYG, 0/50000 web loads on 2026-10-03. App cap only; external usage counts too. Review usage before raising cap and each month. No automatic increases.'),
 ('google_places','free_quota',false,false,null,20,20,'unconfirmed',0,0,0,null,20,
  'Paid account confirmed. Exact SKU and project usage remain unverified; no external calls authorised beyond confirmed free capacity. Keep disabled.')
on conflict(capability,mode) do nothing;

create or replace function private.provider_consume(p_capability text,p_mode text,p_n integer default 1)
returns boolean language plpgsql security definer set search_path='' as $$
declare v private.provider_access; d date:=(now() at time zone 'UTC')::date;
  m date:=date_trunc('month',now() at time zone 'UTC')::date;
begin
 if p_n is null or p_n<1 or p_n>100 then raise exception 'bad request' using errcode='22023'; end if;
 select * into v from private.provider_access where capability=p_capability and mode=p_mode for update;
 if v.capability is null or not v.available or not v.free_access_confirmed
   or (v.expires_at is not null and v.expires_at<=now()) then return false; end if;
 if p_mode='free_quota' and (v.usage_observed_at is null or v.expires_at is null
    or v.usage_observed_at < m::timestamp at time zone 'UTC'
    or v.monthly_budget>v.free_monthly_allowance-v.safety_margin-v.observed_provider_usage)
   then return false; end if;
 if v.daily_reset_on<d then v.daily_used:=0; end if;
 if v.monthly_reset_on<m then v.monthly_used:=0; end if;
 if v.daily_budget=0 or v.monthly_budget=0
    or v.daily_used+p_n>v.daily_budget or v.monthly_used+p_n>v.monthly_budget then return false; end if;
 update private.provider_access set daily_used=v.daily_used+p_n,monthly_used=v.monthly_used+p_n,
   daily_reset_on=d,monthly_reset_on=m where capability=p_capability and mode=p_mode;
 return true;
end $$;
revoke all on function private.provider_consume(text,text,integer) from public,anon,authenticated;

create or replace function private.provider_available(p_capability text,p_mode text)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from private.provider_access v
 where capability=p_capability and mode=p_mode and available and free_access_confirmed
 and (expires_at is null or expires_at>now())
 and daily_budget>0 and monthly_budget>0
 and (daily_used<daily_budget or daily_reset_on<(now() at time zone 'UTC')::date)
 and (monthly_used<monthly_budget or monthly_reset_on<date_trunc('month',now() at time zone 'UTC')::date)
 and (p_mode<>'free_quota' or (usage_observed_at is not null and expires_at is not null
   and usage_observed_at>=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC'
   and monthly_budget<=free_monthly_allowance-safety_margin-observed_provider_usage)));
$$;
revoke all on function private.provider_available(text,text) from public,anon,authenticated;

create or replace function private.admin_provider_access()
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform private.require_registered();
 if not private.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object(
  'capability',v.capability,'mode',v.mode,'sku',v.sku,'available',v.available,
  'canCall',private.provider_available(v.capability,v.mode),
  'editable',v.capability='mapbox' and v.sku='map_loads_web',
  'expiresAt',v.expires_at,'dailyBudget',v.daily_budget,
  'dailyUsed',case when daily_reset_on<(now() at time zone 'UTC')::date then 0 else daily_used end,
  'monthlyBudget',v.monthly_budget,
  'monthlyUsed',case when monthly_reset_on<date_trunc('month',now() at time zone 'UTC')::date then 0 else monthly_used end,
  'freeMonthlyAllowance',v.free_monthly_allowance,'safetyMargin',v.safety_margin,
  'observedProviderUsage',v.observed_provider_usage,'usageObservedAt',v.usage_observed_at,
  'maxBudget',greatest(0,v.free_monthly_allowance-v.safety_margin-v.observed_provider_usage),
  'increaseStep',v.increase_step) order by v.capability)
 from private.provider_access v where mode='free_quota'),'[]'::jsonb);
end $$;
revoke all on function private.admin_provider_access() from public,anon,authenticated;
grant execute on function private.admin_provider_access() to authenticated;

-- Changing a cap never resets consumption. A fresh usage observation is mandatory
-- to renew an expired monthly proof. Google stays uneditable until its SKU is verified.
create or replace function private.admin_configure_provider(p_capability text,p_daily integer,
 p_monthly integer,p_enabled boolean,p_observed_usage integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v private.provider_access; lim integer; observation integer;
begin
 perform private.require_registered();
 if not private.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
 select * into v from private.provider_access where capability=p_capability and mode='free_quota' for update;
 if v.capability is distinct from 'mapbox' or v.sku is distinct from 'map_loads_web' then
   raise exception 'unconfirmed provider' using errcode='22023'; end if;
 if p_daily is null or p_monthly is null or p_enabled is null or p_daily<0 or p_monthly<0
    or p_daily>p_monthly or p_observed_usage<0 or p_observed_usage>v.free_monthly_allowance then
   raise exception 'invalid budget' using errcode='22023'; end if;
 observation:=coalesce(p_observed_usage,v.observed_provider_usage);
 lim:=greatest(0,v.free_monthly_allowance-v.safety_margin-observation);
 if p_monthly>lim then raise exception 'above free allowance' using errcode='22023'; end if;
 if p_enabled and p_observed_usage is null and
    (not v.free_access_confirmed or v.expires_at is null or v.expires_at<=now()) then
   raise exception 'usage confirmation required' using errcode='22023'; end if;
 update private.provider_access set daily_budget=p_daily,monthly_budget=p_monthly,
  available=p_enabled,observed_provider_usage=observation,
  usage_observed_at=case when p_observed_usage is not null then now() else usage_observed_at end,
  free_access_confirmed=case when p_observed_usage is not null then true else free_access_confirmed end,
  confirmed_at=case when p_observed_usage is not null then now() else confirmed_at end,
  expires_at=case when p_observed_usage is not null then
    (date_trunc('month',now() at time zone 'UTC') at time zone 'UTC')+interval '1 month' else expires_at end
 where capability=p_capability and mode='free_quota';
 perform private.audit('provider.configure',jsonb_build_object('capability',p_capability,
  'daily',p_daily,'monthly',p_monthly,'enabled',p_enabled,'observedUsage',p_observed_usage)::text);
 return private.admin_provider_access();
end $$;
revoke all on function private.admin_configure_provider(text,integer,integer,boolean,integer) from public,anon,authenticated;
grant execute on function private.admin_configure_provider(text,integer,integer,boolean,integer) to authenticated;
create or replace function public.admin_configure_provider(p_capability text,p_daily integer,
 p_monthly integer,p_enabled boolean,p_observed_usage integer default null)
returns jsonb language sql security invoker set search_path='' as $$
 select private.admin_configure_provider(p_capability,p_daily,p_monthly,p_enabled,p_observed_usage)
$$;
revoke all on function public.admin_configure_provider(text,integer,integer,boolean,integer) from public,anon;
grant execute on function public.admin_configure_provider(text,integer,integer,boolean,integer) to authenticated;
