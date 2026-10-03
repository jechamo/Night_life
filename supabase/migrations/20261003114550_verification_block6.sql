-- Block 6: minimal results only. No documents, selfies, descriptors or raw webhooks.
insert into public.app_settings (key, kind, value, allowed_values) values
  ('verification_provider', 'flag', 'veriff', array['veriff', 'yoti', 'simulator']);

alter table public.verification_status
  add column age_mode text check (age_mode in ('sandbox', 'live')),
  add column photo_mode text check (photo_mode in ('sandbox', 'live')),
  add column identity_mode text check (identity_mode in ('sandbox', 'live'));
-- Existing manual test seeds belong exclusively to the simulated environment.
update public.verification_status set age_mode = 'sandbox'
where age_verified and age_verification_method = 'manual';
alter table public.verification_status drop constraint verification_status_age_verification_method_check;
alter table public.verification_status add constraint verification_status_age_verification_method_check
  check (age_verification_method in ('facial_estimation', 'document', 'digital_id', 'manual'));
alter table public.consent_records drop constraint consent_records_consent_key_check;
alter table public.consent_records add constraint consent_records_consent_key_check
  check (consent_key in ('orientation', 'precise_location', 'marketing', 'analytics', 'photo_verification', 'identity_verification'));

create table public.verification_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  level text not null check (level in ('age', 'photo', 'identity')),
  mode text not null check (mode in ('sandbox', 'live')),
  provider text not null check (provider in ('veriff', 'yoti', 'simulator')),
  method text not null check (method in ('facial_estimation', 'document', 'digital_id')),
  threshold integer not null check (threshold between 18 and 30),
  provider_session_id uuid unique,
  state text not null default 'pending' check (state in ('pending', 'verified', 'failed', 'manual_review', 'inconclusive', 'reverification_required', 'expired')),
  reason text check (reason in ('requested', 'borderline', 'possible_minor_report', 'photo_changed')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  completed_at timestamptz
);
alter table public.verification_sessions enable row level security;
create unique index verification_sessions_active_idx on public.verification_sessions(user_id, level) where active;
create index verification_sessions_user_idx on public.verification_sessions(user_id, created_at desc);
create policy "verification_sessions: own or admin" on public.verification_sessions
  for select to authenticated using (user_id = (select auth.uid()) or (select private.is_admin()));
revoke all on public.verification_sessions from anon, authenticated;
grant select on public.verification_sessions to authenticated;
grant all on public.verification_sessions to service_role;

create table private.verification_notifications (
  event_id uuid primary key,
  session_id uuid not null references public.verification_sessions(id) on delete cascade,
  occurred_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table private.verification_notifications enable row level security;
revoke all on private.verification_notifications from public, anon, authenticated;

create or replace function private.is_age_verified(_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.verification_status v join public.profiles p on p.id = v.user_id
    where v.user_id = _user and v.age_verified and not v.reverification_required
      and not p.banned and not p.suspended and p.onboarded_at is not null
      and (v.age_mode = 'live' or (v.age_mode = 'sandbox'
        and private.flag_value('verification_mode') = 'sandbox'
        and exists(select 1 from public.user_roles r where r.user_id = _user and r.role in ('tester','admin'))))
  )
$$;

create function private.verification_snapshot()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid()); v_level text; v_session public.verification_sessions;
  v_status public.verification_status; v_result jsonb := '{}'::jsonb; v_item jsonb; v_ok boolean;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_status from public.verification_status where user_id = v_uid;
  foreach v_level in array array['age','photo','identity'] loop
    select * into v_session from public.verification_sessions where user_id = v_uid and level = v_level and active;
    v_ok := case v_level when 'age' then private.is_age_verified(v_uid)
      when 'photo' then coalesce(v_status.photo_verified, false) and (v_status.photo_mode = 'live' or (v_status.photo_mode = 'sandbox' and private.flag_value('verification_mode') = 'sandbox' and private.sees_test_data()))
      else coalesce(v_status.identity_verified, false) and (v_status.identity_mode = 'live' or (v_status.identity_mode = 'sandbox' and private.flag_value('verification_mode') = 'sandbox' and private.sees_test_data())) end;
    v_ok := v_ok and exists(select 1 from public.profiles where id=v_uid and not banned and not suspended and onboarded_at is not null);
    if v_ok then
      v_item := jsonb_build_object('state','verified','verifiedAt',coalesce(v_session.completed_at,v_status.verification_date,v_status.updated_at));
      if v_level = 'age' and v_status.age_verification_method <> 'manual' then
        v_item := v_item || jsonb_build_object('method',v_status.age_verification_method,'thresholdUsed',v_status.age_threshold_used);
      end if;
    elsif v_level = 'age' and coalesce(v_status.reverification_required,false) then
      v_item := jsonb_build_object('state','reverification_required','reason','possible_minor_report');
    elsif v_session.id is null or (v_session.mode = 'sandbox' and (private.flag_value('verification_mode') is distinct from 'sandbox' or not private.sees_test_data())) then
      v_item := jsonb_build_object('state','not_started');
    elsif v_session.state in ('pending','inconclusive') and v_session.expires_at > now() then
      v_item := jsonb_build_object('state','pending','providerSessionId',coalesce(v_session.provider_session_id,v_session.id));
    elsif v_session.state = 'manual_review' then
      v_item := jsonb_build_object('state','manual_review','reason',coalesce(v_session.reason,'requested'));
    elsif v_session.state = 'reverification_required' then
      v_item := jsonb_build_object('state','reverification_required','reason',coalesce(v_session.reason,'photo_changed'));
    else v_item := jsonb_build_object('state','failed','canRequestReview',true);
    end if;
    v_result := v_result || jsonb_build_object(v_level,v_item);
  end loop;
  return v_result;
end $$;
create function public.verification_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$ select private.verification_snapshot() $$;

create function private.begin_verification(p_level text, p_method text default 'facial_estimation', p_consent boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_mode text; v_provider text; v_id uuid; v_profile public.profiles; v_threshold integer;
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  select * into v_profile from public.profiles where id = v_uid for update;
  if v_profile.id is null or v_profile.banned or v_profile.onboarded_at is null then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_level not in ('age','photo','identity') or p_level is null or p_method not in ('facial_estimation','document','digital_id') or p_method is null then raise exception 'bad request' using errcode = '22023'; end if;
  v_mode := private.flag_value('verification_mode');
  v_provider := private.flag_value('verification_provider');
  if v_mode not in ('sandbox','live') or v_mode is null or v_provider not in ('veriff','yoti','simulator') then raise exception 'unavailable' using errcode = '42501'; end if;
  if v_provider = 'simulator' then
    if v_mode is distinct from 'sandbox' or not private.sees_test_data() or not public.feature_enabled('test_tools_enabled') then raise exception 'forbidden' using errcode = '42501'; end if;
    if p_level <> 'age' and p_consent is distinct from true then raise exception 'unavailable' using errcode = '42501'; end if;
  elsif v_provider = 'veriff' then
    if not private.sees_test_data() or not public.feature_enabled('test_tools_enabled') then raise exception 'forbidden' using errcode = '42501'; end if;
    v_mode := 'sandbox';
    if p_level = 'photo' then raise exception 'unavailable' using errcode = '42501'; end if;
    if p_level <> 'age' and p_consent is distinct from true then raise exception 'unavailable' using errcode = '42501'; end if;
    p_method := 'document';
  else
    if p_level <> 'age' then raise exception 'unavailable' using errcode = '42501'; end if;
    if v_mode = 'sandbox' and (not private.sees_test_data() or not public.feature_enabled('test_tools_enabled')) then raise exception 'forbidden' using errcode = '42501'; end if;
  end if;
  if v_profile.suspended and (p_level <> 'age' or not exists(select 1 from public.verification_status where user_id = v_uid and reverification_required)) then raise exception 'forbidden' using errcode = '42501'; end if;
  if exists(select 1 from public.verification_status where user_id = v_uid and reverification_required) then p_method := 'document'; end if;
  if (select count(*) from public.verification_sessions where user_id = v_uid and created_at > now() - interval '1 hour') >= 5 then raise exception 'rate limited' using errcode = '54000'; end if;
  v_threshold := case when p_method = 'facial_estimation' then private.setting_int('age_threshold',21) else 18 end;
  update public.verification_sessions set active = false where user_id = v_uid and level = p_level and active;
  insert into public.verification_sessions(user_id,level,mode,provider,method,threshold) values(v_uid,p_level,v_mode,v_provider,p_method,v_threshold) returning id into v_id;
  if p_level <> 'age' then
    insert into public.consent_records(user_id,kind,consent_key,granted,method,document_version)
      values(v_uid,'consent',p_level || '_verification',true,'signature','verification-1');
  end if;
  return jsonb_build_object('id',v_id,'mode',v_mode,'method',p_method,'threshold',v_threshold,'provider',v_provider);
end $$;
create function public.begin_verification(p_level text, p_method text default 'facial_estimation', p_consent boolean default false) returns jsonb
language sql security invoker set search_path = '' as $$ select private.begin_verification(p_level,p_method,p_consent) $$;

create function private.attach_verification_provider(p_session uuid, p_provider uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if coalesce((select auth.jwt()->>'role'),'') <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.verification_sessions set provider_session_id = p_provider
    where id = p_session and active and state = 'pending' and expires_at > now() and provider_session_id is null;
  if not found then raise exception 'invalid session' using errcode = '22023'; end if;
end $$;
create function public.attach_verification_provider(p_session uuid,p_provider uuid) returns void
language sql security invoker set search_path = '' as $$ select private.attach_verification_provider(p_session,p_provider) $$;

create function private.simulate_verification_result(p_level text,p_outcome text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid()); v_session public.verification_sessions; v_state text;
begin
  if v_uid is null or not private.sees_test_data() or not public.feature_enabled('test_tools_enabled') or private.flag_value('verification_mode') is distinct from 'sandbox' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_outcome is null or p_outcome not in ('approved','denied','inconclusive','borderline') then raise exception 'bad request' using errcode = '22023'; end if;
  select * into v_session from public.verification_sessions where user_id = v_uid and level = p_level and active and mode = 'sandbox' and provider = 'simulator' for update;
  if v_session.id is null or v_session.expires_at <= now() or v_session.state not in ('pending','inconclusive') then raise exception 'invalid session' using errcode = '22023'; end if;
  v_state := case p_outcome when 'approved' then 'verified' when 'inconclusive' then 'inconclusive' else 'manual_review' end;
  update public.verification_sessions set state = v_state, method = case when v_session.state = 'inconclusive' then 'document' else method end,
    reason = case when p_outcome = 'borderline' then 'borderline' when v_state = 'manual_review' then 'requested' else null end,
    completed_at = case when v_state = 'inconclusive' then null else now() end where id = v_session.id;
  insert into public.verification_status(user_id) values(v_uid) on conflict do nothing;
  if p_level = 'age' then
    update public.verification_status set age_verified = v_state = 'verified', age_mode = 'sandbox',
      age_verification_method = case when v_session.state = 'inconclusive' then 'document' else v_session.method end,
      age_threshold_used = case when v_session.state = 'inconclusive' then 18 else v_session.threshold end,
      verification_provider = 'internal_simulator', provider_session_id = v_session.id::text, verification_date = now()
      where user_id = v_uid;
  elsif p_level = 'photo' then update public.verification_status set photo_verified = v_state = 'verified', photo_mode = 'sandbox' where user_id = v_uid;
  elsif p_level = 'identity' then update public.verification_status set identity_verified = v_state = 'verified', identity_mode = 'sandbox' where user_id = v_uid;
  else raise exception 'bad request' using errcode = '22023'; end if;
  insert into public.admin_audit_log(actor_id,action,detail) values(v_uid,'verification.simulate',p_level || ':' || p_outcome);
  return private.verification_snapshot();
end $$;
create function public.simulate_verification_result(p_level text,p_outcome text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.simulate_verification_result(p_level,p_outcome) $$;

create function private.request_verification_review(p_level text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.verification_sessions set state = 'manual_review',reason = 'requested'
    where user_id = v_uid and level = p_level and active and (state in ('failed','inconclusive','expired') or (state = 'pending' and expires_at <= now()));
  if not found then raise exception 'review unavailable' using errcode = '22023'; end if;
  insert into public.gdpr_audit_log(actor_id,subject_id,action) values(v_uid,v_uid,'verification.review_requested');
  return private.verification_snapshot();
end $$;
create function public.request_verification_review(p_level text) returns jsonb
language sql security invoker set search_path = '' as $$ select private.request_verification_review(p_level) $$;

create function private.complete_provider_verification(
  p_provider text, p_event uuid, p_provider_session uuid, p_reference uuid,
  p_outcome text, p_over_threshold boolean, p_identity_ok boolean, p_occurred timestamptz,
  p_method text default null, p_threshold integer default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare v_session public.verification_sessions; v_expected integer; v_state text; v_method text; v_threshold integer;
begin
  if coalesce((select auth.jwt()->>'role'),'') <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_provider not in ('veriff','yoti') or p_outcome not in ('verified','failed','manual_review','inconclusive','expired') then return false; end if;
  select * into v_session from public.verification_sessions
    where id = p_reference and provider_session_id = p_provider_session and provider = p_provider for update;
  if v_session.id is null or not v_session.active or p_occurred < v_session.created_at - interval '5 minutes' or p_occurred > v_session.expires_at + interval '5 minutes' then return false; end if;
  if p_provider = 'yoti' and (v_session.mode <> 'live' or v_session.level <> 'age') then return false; end if;
  if p_provider = 'veriff' and v_session.mode <> 'sandbox' then return false; end if;
  if exists(select 1 from private.verification_notifications where event_id = p_event) then return true; end if;
  if v_session.state = 'verified' then return true; end if;
  v_method := coalesce(p_method, v_session.method);
  if v_method not in ('facial_estimation','document','digital_id') then return false; end if;
  if v_session.method = 'document' and v_method <> 'document' then return false; end if;
  v_expected := case when v_method = 'facial_estimation' then v_session.threshold else 18 end;
  v_threshold := coalesce(p_threshold, v_expected);
  if v_threshold is distinct from v_expected then return false; end if;
  if exists(select 1 from public.profiles where id = v_session.user_id and banned) then return false; end if;
  v_state := case
    when p_outcome = 'verified' and ((v_session.level = 'identity' and p_identity_ok) or (v_session.level <> 'identity' and p_over_threshold)) then 'verified'
    else p_outcome
  end;
  insert into private.verification_notifications(event_id,session_id,occurred_at) values(p_event,v_session.id,p_occurred);
  update public.verification_sessions set state = v_state, method = v_method, threshold = v_threshold, completed_at = p_occurred,
    reason = case when v_state = 'manual_review' then 'requested' else null end where id = v_session.id;
  insert into public.verification_status(user_id) values(v_session.user_id) on conflict do nothing;
  update public.verification_status set
    age_verified = case when p_over_threshold and p_outcome = 'verified' then true else age_verified end,
    age_mode = case when p_over_threshold and p_outcome = 'verified' then v_session.mode else age_mode end,
    age_verification_method = case when p_over_threshold and p_outcome = 'verified' then v_method else age_verification_method end,
    age_threshold_used = case when p_over_threshold and p_outcome = 'verified' then v_threshold else age_threshold_used end,
    identity_verified = case when p_identity_ok and p_outcome = 'verified' then true else identity_verified end,
    identity_mode = case when p_identity_ok and p_outcome = 'verified' then v_session.mode else identity_mode end,
    verification_date = p_occurred,
    verification_provider = p_provider,
    provider_session_id = p_provider_session::text
    where user_id = v_session.user_id;
  return true;
end $$;
create function public.complete_provider_verification(
  p_provider text, p_event uuid, p_provider_session uuid, p_reference uuid,
  p_outcome text, p_over_threshold boolean, p_identity_ok boolean, p_occurred timestamptz,
  p_method text default null, p_threshold integer default null
) returns boolean
language sql security invoker set search_path = '' as $$
  select private.complete_provider_verification(p_provider,p_event,p_provider_session,p_reference,p_outcome,p_over_threshold,p_identity_ok,p_occurred,p_method,p_threshold)
$$;

-- Photo verification is tied to the main profile photo, even for privileged updates.
create function private.invalidate_main_photo() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.photos[1] is distinct from new.photos[1] then
    update public.verification_status set photo_verified = false where user_id = new.id;
    update public.verification_sessions set state = 'reverification_required',reason = 'photo_changed'
      where user_id = new.id and level = 'photo' and active;
  end if;
  return new;
end $$;
create trigger profiles_invalidate_photo after update of photos on public.profiles
for each row execute function private.invalidate_main_photo();

-- Persist bans by keyed hashes; never copy a phone or raw device identifier.
create function private.persist_ban_hashes() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_phone text;
begin
  if new.banned and not old.banned then
    select phone into v_phone from auth.users where id = new.id;
    if nullif(v_phone,'') is not null then
      insert into public.ban_identifiers(kind,hmac,reason) values('phone',private.hmac_hex(private.normalize_phone(v_phone)),'account_ban') on conflict(kind,hmac) do update set expires_at = null;
    end if;
    insert into public.ban_identifiers(kind,hmac,reason)
      select 'device',device_hmac,'account_ban' from public.user_devices where user_id = new.id
      on conflict(kind,hmac) do update set expires_at = null;
  end if;
  return new;
end $$;
create trigger profiles_ban_hashes after update of banned on public.profiles for each row execute function private.persist_ban_hashes();

create function private.possible_minor_reverification() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.reason = 'possible_minor' and new.target_user_id is not null then
    update public.profiles set suspended = true where id = new.target_user_id;
    update public.verification_status set age_verified = false,reverification_required = true where user_id = new.target_user_id;
    update public.verification_sessions set active = false where user_id = new.target_user_id and level = 'age' and active;
  end if;
  return new;
end $$;
create trigger reports_possible_minor after insert on public.reports for each row execute function private.possible_minor_reverification();

-- Remove the tester bypass: a role grants test-data visibility, never age verification.
create or replace function private.search_public_profiles(p_limit integer default 20)
returns table(id uuid,name text,age integer,gender public.gender,bio text,traffic_light public.traffic_light,is_test boolean)
language sql stable security definer set search_path = '' as $$
  select p.id,p.name,private.age_years(p.birthdate),p.gender,p.bio,p.traffic_light,p.is_test
  from public.profiles p where private.is_age_verified((select auth.uid())) and p.id <> (select auth.uid())
    and p.onboarded_at is not null and not p.banned and not p.suspended and p.traffic_light <> 'red'
    and (not p.is_test or private.sees_test_data())
    and not exists(select 1 from public.blocks b where (b.blocker_id = (select auth.uid()) and b.blocked_id = p.id) or (b.blocker_id = p.id and b.blocked_id = (select auth.uid())))
  order by p.last_active_at desc limit least(greatest(p_limit,1),50)
$$;
drop policy "likes: own sent" on public.likes;
create policy "likes: verified owner" on public.likes for select to authenticated using(from_user = (select auth.uid()) and private.is_age_verified((select auth.uid())));
drop policy "matches: participants" on public.matches;
create policy "matches: verified participants" on public.matches for select to authenticated using((select auth.uid()) in (user_a,user_b) and private.is_age_verified((select auth.uid())));
drop policy "messages: participants" on public.messages;
create policy "messages: verified participants" on public.messages for select to authenticated using(private.in_match(match_id) and private.is_age_verified((select auth.uid())));

revoke execute on function private.verification_snapshot(),private.begin_verification(text,text,boolean),private.simulate_verification_result(text,text),private.request_verification_review(text),private.attach_verification_provider(uuid,uuid),private.complete_provider_verification(text,uuid,uuid,uuid,text,boolean,boolean,timestamptz,text,integer),private.invalidate_main_photo(),private.persist_ban_hashes(),private.possible_minor_reverification() from public,anon,authenticated;
revoke execute on function public.verification_snapshot(),public.begin_verification(text,text,boolean),public.simulate_verification_result(text,text),public.request_verification_review(text),public.attach_verification_provider(uuid,uuid),public.complete_provider_verification(text,uuid,uuid,uuid,text,boolean,boolean,timestamptz,text,integer) from public,anon,authenticated;
grant execute on function private.verification_snapshot(),public.verification_snapshot(),private.begin_verification(text,text,boolean),public.begin_verification(text,text,boolean),private.simulate_verification_result(text,text),public.simulate_verification_result(text,text),private.request_verification_review(text),public.request_verification_review(text),private.is_age_verified(uuid) to authenticated;
grant execute on function private.attach_verification_provider(uuid,uuid),public.attach_verification_provider(uuid,uuid),private.complete_provider_verification(text,uuid,uuid,uuid,text,boolean,boolean,timestamptz,text,integer),public.complete_provider_verification(text,uuid,uuid,uuid,text,boolean,boolean,timestamptz,text,integer) to service_role;
