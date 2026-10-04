-- Block 9: private case work, account rights and free venue management.
alter table public.reports add column validated_at timestamptz,
 add column validated_by uuid references auth.users(id) on delete set null;
create index reports_validated_by_idx on public.reports(validated_by);
alter table public.appeals add column explanation text check(char_length(explanation)<=2000);
alter table public.moderation_decisions add column revoked_at timestamptz;

create table public.illegal_content_notices (
 id uuid primary key default gen_random_uuid(), reference text not null unique,
 report_id uuid not null references public.reports(id) on delete cascade,
 url text not null check(char_length(url)<=500), email text not null check(char_length(email)<=200),
 category text not null check(category in('minor','sexual','violence','hate','fraud','privacy','ip','other')),
 created_at timestamptz not null default now()
);
alter table public.illegal_content_notices enable row level security;
create policy "notices: admin" on public.illegal_content_notices for select to authenticated using((select private.is_admin()));
create index illegal_content_notices_report_idx on public.illegal_content_notices(report_id);
create table public.safety_escalations (
 id uuid primary key default gen_random_uuid(), report_id uuid not null unique references public.reports(id) on delete cascade,
 explanation text not null check(char_length(explanation) between 5 and 2000),
 status text not null default 'pending' check(status in('pending','reviewed')),
 created_by uuid references auth.users(id) on delete set null, created_at timestamptz not null default now()
);
alter table public.safety_escalations enable row level security;
create policy "escalations: admin" on public.safety_escalations for select to authenticated using((select private.is_admin()));
create index safety_escalations_by_idx on public.safety_escalations(created_by);
create table private.case_limits (
 subject_hmac text not null, action text not null, bucket bigint not null, hits integer not null,
 created_at timestamptz not null default now(), primary key(subject_hmac,action,bucket)
);
alter table private.case_limits enable row level security;
create table private.ban_links (
 ban_id uuid not null references public.bans(id) on delete cascade,
 identifier_id uuid not null references public.ban_identifiers(id) on delete cascade, primary key(ban_id,identifier_id)
);
alter table private.ban_links enable row level security;
create index ban_links_identifier_idx on private.ban_links(identifier_id);
revoke all on private.case_limits,private.ban_links from public,anon,authenticated;
revoke all on public.illegal_content_notices,public.safety_escalations from anon,authenticated;
grant select on public.illegal_content_notices,public.safety_escalations to authenticated;
grant all on public.illegal_content_notices,public.safety_escalations to service_role;

-- Appeals and rights remain accessible to suspended accounts; social actions do not.
create function private.require_account() returns uuid
language plpgsql stable security definer set search_path='' as $$
declare u uuid:=(select auth.uid());
begin
 if u is null or not exists(select 1 from public.profiles where id=u and onboarded_at is not null) then
  raise exception 'account required' using errcode='42501'; end if;
 return u;
end $$;
create function private.case_limit(p_action text,p_max int) returns void
language plpgsql security definer set search_path='' as $$
declare h jsonb:=coalesce(nullif(current_setting('request.headers',true),'')::jsonb,'{}');
 s text; n int;
begin
 -- Both user and network buckets; no plaintext IP is persisted.
 for s in select private.hmac_hex('case-user:'||auth.uid()::text) where auth.uid() is not null
 union all select private.hmac_hex('case-ip:'||coalesce(nullif(h->>'cf-connecting-ip',''),nullif(h->>'x-real-ip',''),nullif(split_part(h->>'x-forwarded-for',',',1),''),'unknown')) loop
  insert into private.case_limits(subject_hmac,action,bucket,hits)
   values(s,p_action,floor(extract(epoch from now())/3600)::bigint,1)
   on conflict(subject_hmac,action,bucket) do update set hits=private.case_limits.hits+1 returning hits into n;
  if n>p_max then raise exception 'rate limited' using errcode='54000'; end if;
 end loop;
end $$;
create function private.submit_illegal_content_notice(p jsonb) returns text
language plpgsql security definer set search_path='' as $$
declare r uuid; ref text:='DSA-'||upper(encode(extensions.gen_random_bytes(8),'hex'));
begin
 perform private.case_limit('dsa-notice',5);
 if p->>'url' !~ '^https://(nightlife-connect-beige\.vercel\.app|nightlife-connect(-[a-z0-9-]+)?-chaplications-projects\.vercel\.app)/'
  or char_length(p->>'url')>500 or p->>'email' !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
  or char_length(p->>'email')>200 or char_length(btrim(p->>'explanation')) not between 20 and 2000
  or p->>'reason' not in('minor','sexual','violence','hate','fraud','privacy','ip','other')
  or coalesce((p->>'goodFaith')::boolean,false)=false then
  raise exception 'invalid notice' using errcode='22023'; end if;
 insert into public.reports(reason,comment,notice_reference) values('dsa_notice',btrim(p->>'explanation'),ref) returning id into r;
 insert into public.illegal_content_notices(reference,report_id,url,email,category)
 values(ref,r,p->>'url',lower(btrim(p->>'email')),p->>'reason');
 return ref;
end $$;
create function private.moderation_reports() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'aboutName',coalesce(p.name,e.title,''),'reason',r.reason,
 'createdAt',r.created_at,'status',case when r.status='dismissed' then 'dismissed' when r.status='open' then 'open' else 'actioned' end) order by r.created_at desc),'[]')
 into result from public.reports r left join public.profiles p on p.id=r.target_user_id left join public.events e on e.id=r.target_event_id
 where r.reporter_id=u;
 return result;
end $$;
create function private.moderation_decisions() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'action',d.action,'reason',d.reason,'explanation',d.explanation,
 'createdAt',d.created_at,'appeal',case when a.id is not null then jsonb_build_object('status',a.status,'text',a.text,'explanation',a.explanation) end) order by d.created_at desc),'[]')
 into result from public.moderation_decisions d left join public.appeals a on a.decision_id=d.id where d.user_id=u;
 return result;
end $$;
create function private.moderation_appeal(p_decision uuid,p_text text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account();
begin
 perform private.case_limit('appeal',10);
 if char_length(btrim(p_text)) not between 10 and 1000 then raise exception 'invalid appeal' using errcode='22023'; end if;
 if not exists(select 1 from public.moderation_decisions where id=p_decision and user_id=u) then raise exception 'not found' using errcode='P0002'; end if;
 insert into public.appeals(decision_id,user_id,text) values(p_decision,u,btrim(p_text)) on conflict(decision_id) do nothing;
 if not found then return jsonb_build_object('error','already_appealed'); end if;
 return (select value from jsonb_array_elements(private.moderation_decisions()) where value->>'id'=p_decision::text);
end $$;

create function private.admin_moderate(p_section text,p_id uuid,p_action text,p_note text) returns void
language plpgsql security definer set search_path='' as $$
declare r public.reports; a public.appeals; d public.moderation_decisions; u uuid;
 c int; bid uuid; iid uuid; s record;
begin
 perform private.require_admin(); perform private.require_registered();
 if char_length(btrim(coalesce(p_note,''))) not between 5 and 2000 then raise exception 'explanation required' using errcode='22023'; end if;
 if p_section='reports' then
  select * into r from public.reports where id=p_id for update;
  if not found or r.status<>'open' then raise exception 'not found' using errcode='P0002'; end if;
  u:=r.target_user_id;
  if p_action='escalate' then
   insert into public.safety_escalations(report_id,explanation,created_by) values(r.id,p_note,auth.uid()) on conflict(report_id) do nothing;
  elsif p_action='dismiss' then update public.reports set status='dismissed' where id=r.id;
  elsif p_action in('warn','suspend','ban') and u is not null then
   perform pg_advisory_xact_lock(hashtextextended('moderation:'||u::text,0));
   update public.reports set status='valid',validated_at=now(),validated_by=auth.uid() where id=r.id;
   if r.reason='possible_minor' then update public.verification_status set reverification_required=true where user_id=u; end if;
   select count(distinct reporter_id) into c from public.reports where target_user_id=u
    and status in('valid','actioned') and created_at>=now()-make_interval(hours=>private.setting_int('reports_strike_window_h',6));
   insert into public.moderation_decisions(user_id,report_id,action,reason,explanation,decided_by)
    values(u,r.id,case when p_action='ban' then 'ban' when p_action='suspend' or c>=3 then 'suspension' else 'warning' end,r.reason,p_note,auth.uid());
   if p_action in('suspend','ban') or c>=3 then
    update public.profiles set suspended=true,banned=(banned or p_action='ban') where id=u;
    perform realtime.send('{}','refresh','social:'||u::text,true);
   end if;
   if p_action='ban' then
    insert into public.bans(user_id,reason,created_by) values(u,r.reason,auth.uid()) returning id into bid;
    for s in select 'phone' as kind,private.hmac_hex('phone:'||private.normalize_phone(phone)) as hmac from auth.users where id=u and nullif(phone,'') is not null
     union all select 'device',device_hmac from public.user_devices where user_id=u loop
     insert into public.ban_identifiers(kind,hmac,reason) values(s.kind,s.hmac,bid::text)
      on conflict(kind,hmac) do update set expires_at=null returning id into iid;
     insert into private.ban_links(ban_id,identifier_id) values(bid,iid) on conflict do nothing;
    end loop;
   end if;
  elsif p_action='delete' and r.target_event_id is not null then
   update public.events set status='removed',hidden_at=now() where id=r.target_event_id;
   update public.reports set status='actioned',validated_at=now(),validated_by=auth.uid() where id=r.id;
  else raise exception 'invalid action' using errcode='22023'; end if;
 elsif p_section='appeals' then
  select * into a from public.appeals where id=p_id for update;
  if not found or a.status<>'pending' or p_action not in('accept','reject') then raise exception 'not found' using errcode='P0002'; end if;
  select * into d from public.moderation_decisions where id=a.decision_id;
  if d.decided_by=auth.uid() or a.user_id=auth.uid() then raise exception 'independent reviewer required' using errcode='42501'; end if;
  update public.appeals set status=case when p_action='accept' then 'accepted' else 'rejected' end,
   resolved_by=auth.uid(),resolved_at=now(),explanation=p_note where id=a.id;
  if p_action='accept' then
   update public.moderation_decisions set revoked_at=now() where id=d.id;
   update public.reports set status='dismissed' where id=d.report_id;
   update public.profiles set suspended=exists(select 1 from public.moderation_decisions where user_id=a.user_id and action in('suspension','ban') and revoked_at is null),
    banned=exists(select 1 from public.bans where user_id=a.user_id and (until is null or until>now())) where id=a.user_id;
  end if;
 elsif p_section='bans' and p_action='lift' then
  select user_id into u from public.bans where id=p_id for update;
  if not found then raise exception 'not found' using errcode='P0002'; end if;
  update public.bans set until=now() where id=p_id;
  update public.ban_identifiers i set expires_at=now() where exists(select 1 from private.ban_links where ban_id=p_id and identifier_id=i.id)
   and not exists(select 1 from private.ban_links l join public.bans b on b.id=l.ban_id where l.identifier_id=i.id and (b.until is null or b.until>now()));
  update public.moderation_decisions set revoked_at=now() where user_id=u and action='ban' and revoked_at is null;
  update public.profiles set banned=exists(select 1 from public.bans where user_id=u and (until is null or until>now())),
   suspended=exists(select 1 from public.moderation_decisions where user_id=u and action='suspension' and revoked_at is null) where id=u;
 else raise exception 'invalid section' using errcode='22023'; end if;
 perform private.audit('moderation.'||p_action,p_section||':'||p_id::text);
end $$;

create function private.managed_venues() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_registered(); result jsonb;
begin
 select coalesce(jsonb_agg(jsonb_build_object('placeId',v.id,'name',v.name,'claimStatus',case when m.user_id is not null then 'approved' else c.status end,
 'description',v.description,'hours',v.hours,'price',v.price,'sponsorship',(select jsonb_build_object('tier',s.tier,'status',s.status,'from',s.starts_on,'to',s.ends_on)
 from public.sponsorships s where s.venue_id=v.id and s.status in('requested','active') order by s.created_at desc limit 1)) order by v.name),'[]')
 into result from public.venues v left join public.venue_claims c on c.venue_id=v.id and c.user_id=u
 left join public.venue_managers m on m.venue_id=v.id and m.user_id=u where (c.id is not null or m.user_id is not null) and (not v.is_test or private.sees_test_data());
 return result;
end $$;
create function private.venue_claim(p_venue uuid,p_evidence text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_registered();
begin
 perform private.require_place(p_venue); perform private.case_limit('venue-claim',10);
 if char_length(btrim(p_evidence)) not between 10 and 500 then raise exception 'invalid evidence' using errcode='22023'; end if;
 insert into public.venue_claims(venue_id,user_id,evidence) values(p_venue,u,btrim(p_evidence)) on conflict(venue_id,user_id) do nothing;
 if not found then return jsonb_build_object('error','already_claimed'); end if;
 return(select value from jsonb_array_elements(private.managed_venues()) where value->>'placeId'=p_venue::text);
end $$;
create function private.require_venue_manager(p_venue uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_registered(); perform private.require_place(p_venue);
 if not private.manages_venue(p_venue) and not private.is_admin() then raise exception 'forbidden' using errcode='42501'; end if;
end $$;
create function private.venue_edit(p_venue uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('venue-edit',30);
 if (p-'description'-'hours'-'price')<>'{}' then raise exception 'invalid fields' using errcode='22023'; end if;
 update public.venues set description=coalesce(p->>'description',description),hours=coalesce(p->>'hours',hours),price=coalesce((p->>'price')::int,price),catalog_owned=true where id=p_venue;
 perform private.audit('venue.edit',p_venue::text);
 return(select value from jsonb_array_elements(private.managed_venues()) where value->>'placeId'=p_venue::text);
end $$;
create function private.venue_official_event(p_venue uuid,p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare v public.venues; eid uuid; st timestamptz:=(p->>'startsAt')::timestamptz; en timestamptz:=(p->>'endsAt')::timestamptz;
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('official-event',10);
 select * into v from public.venues where id=p_venue;
 if st<now()-interval '1 hour' or en<=st or en>st+interval '7 days' then raise exception 'invalid dates' using errcode='22023'; end if;
 insert into public.events(venue_id,created_by,title,category,place_name,address,location,starts_at,ends_at,description,status,origin,is_test,source)
 values(v.id,auth.uid(),p->>'title','party',v.name,v.address,v.location,st,en,coalesce(p->>'description',''),'official','venue',v.is_test,'venue') returning id into eid;
 perform private.audit('venue.official_event',eid::text); return eid;
end $$;
create function private.venue_stats(p_venue uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s jsonb; by_hour jsonb; n int;
begin
 perform private.require_venue_manager(p_venue);
 -- No individual identities or fine-grained timestamps; small hourly cohorts hidden.
 select coalesce(jsonb_agg(jsonb_build_object('hour',hour_of_day,'people',case when people>=5 then people else 0 end) order by hour_of_day),'[]') into by_hour
 from(select extract(hour from created_at at time zone 'Europe/Madrid')::int as hour_of_day,count(distinct user_id) people
 from public.attendance where venue_id=p_venue and kind='check_in' and created_at>=now()-interval '7 days' group by 1) h;
 select count(distinct user_id) into n from public.attendance where venue_id=p_venue and kind='check_in' and created_at>=now()-interval '7 days';
 select private.threshold_stats(people,average_age,green_percent,ratio,going_tonight) into s from public.place_stats where venue_id=p_venue;
 return jsonb_build_object('byHour',by_hour,'averageAge',s->'averageAge','greenPercent',s->'greenPercent',
 'checkInsWeek',case when n>=5 then n else 0 end,'goingTonight',coalesce(s->'goingTonight','0'));
end $$;
create function private.venue_sponsorship(p_venue uuid,p_tier text,p_from date,p_to date) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('sponsorship',10);
 if p_from<current_date or p_to<p_from or p_to>p_from+366 or p_tier not in('featured','featured_plus','top') then raise exception 'invalid sponsorship' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('sponsorship:'||p_venue::text,0));
 if exists(select 1 from public.sponsorships where venue_id=p_venue and status in('requested','active') and starts_on<=p_to and ends_on>=p_from) then raise exception 'overlapping sponsorship' using errcode='23505'; end if;
 insert into public.sponsorships(venue_id,tier,starts_on,ends_on,requested_by) values(p_venue,p_tier,p_from,p_to,auth.uid());
 return(select value from jsonb_array_elements(private.managed_venues()) where value->>'placeId'=p_venue::text);
end $$;

insert into public.app_settings(key,kind,value,min_value,max_value) values('sponsorship_slots','setting','3',1,10);
insert into public.app_settings(key,kind,value,allowed_values) values('flash_alcohol_allowed','flag','off',array['on','off']);
create function private.venue_flash_alert(p_venue uuid,p jsonb) returns uuid
language plpgsql security definer set search_path='' as $$
declare fid uuid; st timestamptz:=(p->>'startsAt')::timestamptz; en timestamptz:=(p->>'endsAt')::timestamptz;
begin
 perform private.require_venue_manager(p_venue); perform private.case_limit('flash-alert',5);
 if not exists(select 1 from public.sponsorships where venue_id=p_venue and status='active' and current_date between starts_on and ends_on)
 or en<=st or en>st+interval '24 hours' or st<now()-interval '5 minutes' then raise exception 'not allowed' using errcode='42501'; end if;
 if coalesce((p->>'containsAlcohol')::boolean,false) and not public.feature_enabled('flash_alcohol_allowed') then raise exception 'alcohol policy required' using errcode='42501'; end if;
 insert into public.flash_alerts(venue_id,title,body,contains_alcohol,starts_at,ends_at,status)
 values(p_venue,p->>'title',p->>'body',coalesce((p->>'containsAlcohol')::boolean,false),st,en,'active') returning id into fid;
 perform private.audit('venue.flash_alert',fid::text); return fid;
end $$;
create function private.visible_flash_alerts(p_venue uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_age_verified(); result jsonb;
begin
 perform private.require_place(p_venue);
 if not private.latest_consent(u,'marketing') then return '[]'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'title',title,'body',body,'endsAt',ends_at) order by starts_at desc),'[]') into result
 from public.flash_alerts f where venue_id=p_venue and status='active' and now() between starts_at and ends_at
 and (not contains_alcohol or public.feature_enabled('flash_alcohol_allowed'))
 and exists(select 1 from public.sponsorships where venue_id=p_venue and status='active' and current_date between starts_on and ends_on);
 return result;
end $$;

-- Complete export includes only the caller's own data and authored messages.
create function private.export_my_data() returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); result jsonb:='{}'; t text; field text; data jsonb;
begin
 perform private.case_limit('export',5);
 for t,field in select * from(values('profiles','id'),('verification_status','user_id'),('verification_sessions','user_id'),
 ('user_preferences','user_id'),('user_roles','user_id'),('consent_records','user_id'),('attendance','user_id'),('ratings','user_id'),
 ('lost_and_found','user_id'),('likes','from_user'),('swipe_passes','user_id'),('messages','sender_id'),('blocks','blocker_id'),
 ('reports','reporter_id'),('moderation_decisions','user_id'),('appeals','user_id'),('emergency_contacts','user_id'),
 ('events','created_by'),('venue_claims','user_id'),('venue_managers','user_id'),('sponsorships','requested_by'),
 ('entitlements','user_id'),('subscriptions','user_id'),('invoices','user_id'),('credit_ledger','user_id'),('promo_redemptions','user_id'),
 ('data_requests','user_id')) tables(t,f) loop
  execute format('select coalesce(jsonb_agg(to_jsonb(r)),''[]'') from public.%I r where %I=$1',t,field) into data using u;
  result:=result||jsonb_build_object(t,data);
 end loop;
 select coalesce(jsonb_agg(to_jsonb(m)),'[]') into data from public.matches m where u in(user_a,user_b);
 result:=result||jsonb_build_object('matches',data,'exportedAt',now());
 insert into public.data_requests(user_id,kind,status,closed_at) values(u,'export','done',now());
 insert into public.gdpr_audit_log(actor_id,subject_id,action) values(u,u,'account.export');
 return result;
end $$;
create function private.request_data_right(p_kind text) returns uuid
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); rid uuid;
begin
 perform private.case_limit('data-right',5);
 if p_kind not in('rectify','object','restrict') then raise exception 'invalid kind' using errcode='22023'; end if;
 insert into public.data_requests(user_id,kind) values(u,p_kind) returning id into rid; return rid;
end $$;

create function private.save_emergency_contacts(p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_account(); result jsonb;
begin
 perform private.case_limit('contacts',30);
 if jsonb_typeof(p)<>'array' or jsonb_array_length(p)>3 then raise exception 'invalid contacts' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended('contacts:'||u::text,0));
 delete from public.emergency_contacts where user_id=u;
 insert into public.emergency_contacts(user_id,name,phone)
 select u,btrim(value->>'name'),btrim(value->>'phone') from jsonb_array_elements(p);
 select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'phone',phone) order by created_at,id),'[]') into result from public.emergency_contacts where user_id=u;
 return result;
end $$;
-- Owner writes use the atomic RPC; concurrent direct inserts cannot bypass the cap.
revoke insert,update,delete on public.emergency_contacts from authenticated;

-- New exposed RPCs are invoker wrappers; helper implementations stay unexposed.
do $$
declare f record; args text; names text;
begin
 for f in select p.oid,p.proname,pg_get_function_arguments(p.oid) args,pg_get_function_identity_arguments(p.oid) identity_args,p.proargnames
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in(
 'submit_illegal_content_notice','moderation_reports','moderation_decisions','moderation_appeal','admin_moderate','managed_venues','venue_claim','venue_edit','venue_official_event','venue_stats','venue_sponsorship','venue_flash_alert','visible_flash_alerts','export_my_data','request_data_right','save_emergency_contacts') loop
  names:=coalesce(array_to_string(f.proargnames,','),'');
  execute format('create function public.%I(%s) returns %s language sql security invoker set search_path='''' as $fn$ select private.%I(%s) $fn$',f.proname,f.args,pg_get_function_result(f.oid),f.proname,names);
  execute format('revoke all on function public.%I(%s),private.%I(%s) from public,anon,authenticated',f.proname,f.identity_args,f.proname,f.identity_args);
  execute format('grant execute on function public.%I(%s),private.%I(%s) to authenticated',f.proname,f.identity_args,f.proname,f.identity_args);
 end loop;
end $$;
grant execute on function public.submit_illegal_content_notice(jsonb),private.submit_illegal_content_notice(jsonb) to anon;
revoke all on function private.require_account(),private.case_limit(text,int),private.require_venue_manager(uuid) from public,anon,authenticated;
