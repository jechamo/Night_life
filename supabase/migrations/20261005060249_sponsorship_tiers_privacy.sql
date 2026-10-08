-- The advertised tiers have distinct behavior: map pin, list priority, Flash Alerts.
create function private.visible_sponsorships() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 perform private.require_registered();
 return (select coalesce(jsonb_agg(jsonb_build_object('id',venue_id,'tier',case rank when 0 then 'top' when 1 then 'featured_plus' else 'featured' end) order by rank,venue_id),'[]')
 from(select s.venue_id,min(case s.tier when 'top' then 0 when 'featured_plus' then 1 else 2 end) rank from public.sponsorships s join public.venues v on v.id=s.venue_id
 where s.status='active' and current_date between s.starts_on and s.ends_on and (not v.is_test or private.sees_test_data())
 and (s.mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) group by s.venue_id) tiers);
end $$;
create function public.visible_sponsorships() returns jsonb language sql security invoker set search_path='' as $$ select private.visible_sponsorships() $$;
revoke all on function public.visible_sponsorships(),private.visible_sponsorships() from public,anon,authenticated;
grant execute on function public.visible_sponsorships(),private.visible_sponsorships() to authenticated;

create or replace function private.venue_flash_alert(p_venue uuid,p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare fid uuid; st timestamptz:=(p->>'startsAt')::timestamptz; en timestamptz:=(p->>'endsAt')::timestamptz;
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('flash-alert',5);
 if not exists(select 1 from public.sponsorships where venue_id=p_venue and tier='top' and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) and status='active' and current_date between starts_on and ends_on)
 or en<=st or en>st+interval '24 hours' or st<now()-interval '5 minutes' then raise exception 'not allowed' using errcode='42501'; end if;
 if coalesce((p->>'containsAlcohol')::boolean,false) and not public.feature_enabled('flash_alcohol_allowed') then raise exception 'alcohol policy required' using errcode='42501'; end if;
 insert into public.flash_alerts(venue_id,title,body,contains_alcohol,starts_at,ends_at,status)
 values(p_venue,p->>'title',p->>'body',coalesce((p->>'containsAlcohol')::boolean,false),st,en,'active') returning id into fid;
 perform private.audit('venue.flash_alert',fid::text); return fid;
end $$;

create or replace function private.visible_flash_alerts(p_venue uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); result jsonb;
begin
 perform private.require_place(p_venue);
 if not private.latest_consent(u,'marketing') then return '[]'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'body',body,'endsAt',ends_at) order by starts_at desc),'[]') into result
 from public.flash_alerts f where venue_id=p_venue and status='active' and now() between starts_at and ends_at
 and (not contains_alcohol or public.feature_enabled('flash_alcohol_allowed'))
 and exists(select 1 from public.sponsorships where venue_id=p_venue and tier='top' and (mode='live' or (private.sees_test_data() and private.flag_value('payments_mode')<>'live')) and status='active' and current_date between starts_on and ends_on);
 return result;
end $$;
