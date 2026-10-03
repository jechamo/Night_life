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
