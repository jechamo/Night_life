-- Block 6 · audit fixes: provider decision window, state mapping without proof, identity only
-- under its own explicit consent, photo simulation while Veriff is active, document
-- re-verification after a possible-minor report and human review of negative decisions.

alter table public.verification_sessions drop constraint verification_sessions_reason_check;
alter table public.verification_sessions add constraint verification_sessions_reason_check
  check (reason in ('requested', 'borderline', 'possible_minor_report', 'photo_changed', 'reviewed'));

create or replace function private.verification_snapshot()
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
    else
      -- A decision already reviewed by a person cannot be sent back to the queue.
      v_item := jsonb_build_object('state','failed','canRequestReview',
        v_session.state in ('failed','inconclusive','expired','pending') and v_session.reason is distinct from 'reviewed');
    end if;
    v_result := v_result || jsonb_build_object(v_level,v_item);
  end loop;
  return v_result;
end $$;

create or replace function private.begin_verification(p_level text, p_method text default 'facial_estimation', p_consent boolean default false)
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
  -- Veriff test has no face match against profile photos: photo stays on the persisted simulator.
  if v_provider = 'veriff' and p_level = 'photo' then v_provider := 'simulator'; end if;
  if v_provider = 'simulator' then
    if v_mode is distinct from 'sandbox' or not private.sees_test_data() or not public.feature_enabled('test_tools_enabled') then raise exception 'forbidden' using errcode = '42501'; end if;
    if p_level <> 'age' and p_consent is distinct from true then raise exception 'unavailable' using errcode = '42501'; end if;
  elsif v_provider = 'veriff' then
    if not private.sees_test_data() or not public.feature_enabled('test_tools_enabled') then raise exception 'forbidden' using errcode = '42501'; end if;
    v_mode := 'sandbox';
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
  insert into public.verification_sessions(user_id,level,mode,provider,method,threshold,expires_at)
    values(v_uid,p_level,v_mode,v_provider,p_method,v_threshold,
      now() + case when v_provider = 'simulator' then interval '15 minutes' else interval '24 hours' end)
    returning id into v_id;
  if p_level <> 'age' then
    insert into public.consent_records(user_id,kind,consent_key,granted,method,document_version)
      values(v_uid,'consent',p_level || '_verification',true,'signature','verification-1');
  end if;
  return jsonb_build_object('id',v_id,'mode',v_mode,'method',p_method,'threshold',v_threshold,'provider',v_provider);
end $$;

create or replace function private.request_verification_review(p_level text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := (select auth.uid());
begin
  if v_uid is null then raise exception 'not authenticated' using errcode = '28000'; end if;
  update public.verification_sessions set state = 'manual_review',reason = 'requested'
    where user_id = v_uid and level = p_level and active and reason is distinct from 'reviewed'
      and (state in ('failed','inconclusive','expired') or (state = 'pending' and expires_at <= now()));
  if not found then raise exception 'review unavailable' using errcode = '22023'; end if;
  insert into public.gdpr_audit_log(actor_id,subject_id,action) values(v_uid,v_uid,'verification.review_requested');
  return private.verification_snapshot();
end $$;

create or replace function private.complete_provider_verification(
  p_provider text, p_event uuid, p_provider_session uuid, p_reference uuid,
  p_outcome text, p_over_threshold boolean, p_identity_ok boolean, p_occurred timestamptz,
  p_method text default null, p_threshold integer default null
)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  v_session public.verification_sessions; v_expected integer; v_state text; v_method text;
  v_threshold integer; v_proof boolean; v_age boolean; v_identity boolean;
begin
  if coalesce((select auth.jwt()->>'role'),'') <> 'service_role' then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_provider not in ('veriff','yoti') or p_outcome not in ('verified','failed','manual_review','inconclusive','expired')
    or p_provider is null or p_outcome is null or p_event is null or p_occurred is null then return false; end if;
  select * into v_session from public.verification_sessions
    where id = p_reference and provider_session_id = p_provider_session and provider = p_provider for update;
  -- Provider reviews can decide after the redirect window, never before the session existed.
  if v_session.id is null or not v_session.active or v_session.level = 'photo'
    or p_occurred < v_session.created_at - interval '5 minutes'
    or p_occurred > v_session.created_at + interval '7 days'
    or p_occurred > now() + interval '5 minutes' then return false; end if;
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
  v_proof := case when v_session.level = 'identity' then coalesce(p_identity_ok,false) else coalesce(p_over_threshold,false) end;
  -- An approval without its proof (missing date of birth, identity not confirmed) goes to a person.
  v_state := case when p_outcome = 'verified' and v_proof then 'verified'
    when p_outcome = 'verified' then 'manual_review' else p_outcome end;
  v_age := v_state = 'verified' and coalesce(p_over_threshold,false);
  v_identity := v_state = 'verified' and v_session.level = 'identity' and coalesce(p_identity_ok,false);
  insert into private.verification_notifications(event_id,session_id,occurred_at) values(p_event,v_session.id,p_occurred);
  update public.verification_sessions set state = v_state, method = v_method, threshold = v_threshold, completed_at = p_occurred,
    reason = case when v_state <> 'manual_review' then null when p_outcome = 'verified' then 'borderline' else 'requested' end
    where id = v_session.id;
  insert into public.verification_status(user_id) values(v_session.user_id) on conflict do nothing;
  update public.verification_status set
    age_verified = case when v_age then true else age_verified end,
    age_mode = case when v_age then v_session.mode else age_mode end,
    age_verification_method = case when v_age then v_method else age_verification_method end,
    age_threshold_used = case when v_age then v_threshold else age_threshold_used end,
    reverification_required = case when v_age and v_method = 'document' then false else reverification_required end,
    identity_verified = case when v_identity then true else identity_verified end,
    identity_mode = case when v_identity then v_session.mode else identity_mode end,
    verification_date = case when v_age or v_identity then p_occurred else verification_date end,
    verification_provider = case when v_age or v_identity then p_provider else verification_provider end,
    provider_session_id = case when v_age or v_identity then p_provider_session::text else provider_session_id end
    where user_id = v_session.user_id;
  return true;
end $$;

-- Human review (PRD 6.2): the reviewer decides in the provider console; only the result lands here.
create function private.admin_verification_reviews()
returns table(id uuid, level text, provider text, mode text, method text, reason text, created_at timestamptz, user_name text, is_test boolean)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform private.require_admin();
  return query
    select s.id, s.level, s.provider, s.mode, s.method, s.reason, s.created_at, p.name, p.is_test
    from public.verification_sessions s join public.profiles p on p.id = s.user_id
    where s.active and s.state = 'manual_review'
    order by s.created_at limit 200;
end $$;
create function public.admin_verification_reviews()
returns table(id uuid, level text, provider text, mode text, method text, reason text, created_at timestamptz, user_name text, is_test boolean)
language sql stable security invoker set search_path = '' as $$ select * from private.admin_verification_reviews() $$;

create function private.admin_resolve_verification(p_session uuid, p_approve boolean, p_note text default '')
returns void language plpgsql security definer set search_path = '' as $$
declare v_session public.verification_sessions;
begin
  perform private.require_admin();
  if p_session is null or p_approve is null then raise exception 'bad request' using errcode = '22023'; end if;
  select * into v_session from public.verification_sessions where id = p_session and active and state = 'manual_review' for update;
  if v_session.id is null then raise exception 'invalid session' using errcode = '22023'; end if;
  if v_session.user_id = (select auth.uid()) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_approve and exists(select 1 from public.profiles where id = v_session.user_id and banned) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.verification_sessions set state = case when p_approve then 'verified' else 'failed' end,
    reason = case when p_approve then null else 'reviewed' end, completed_at = now() where id = v_session.id;
  if p_approve then
    insert into public.verification_status(user_id) values(v_session.user_id) on conflict do nothing;
    -- A possible-minor report keeps requiring a document result; a person cannot clear it here.
    update public.verification_status set
      age_verified = case when v_session.level = 'age' then true else age_verified end,
      age_mode = case when v_session.level = 'age' then v_session.mode else age_mode end,
      age_verification_method = case when v_session.level = 'age' then 'manual' else age_verification_method end,
      age_threshold_used = case when v_session.level = 'age' then 18 else age_threshold_used end,
      photo_verified = case when v_session.level = 'photo' then true else photo_verified end,
      photo_mode = case when v_session.level = 'photo' then v_session.mode else photo_mode end,
      identity_verified = case when v_session.level = 'identity' then true else identity_verified end,
      identity_mode = case when v_session.level = 'identity' then v_session.mode else identity_mode end,
      verification_provider = 'human_review', verification_date = now()
      where user_id = v_session.user_id;
  end if;
  perform private.audit('verification.review.' || case when p_approve then 'approve' else 'reject' end,
    v_session.level || ':' || v_session.id::text || case when nullif(btrim(p_note),'') is null then '' else ' · ' || left(btrim(p_note),200) end);
end $$;
create function public.admin_resolve_verification(p_session uuid, p_approve boolean, p_note text default '')
returns void language sql security invoker set search_path = '' as $$ select private.admin_resolve_verification(p_session,p_approve,p_note) $$;

revoke execute on function private.admin_verification_reviews(), public.admin_verification_reviews(),
  private.admin_resolve_verification(uuid,boolean,text), public.admin_resolve_verification(uuid,boolean,text)
  from public, anon;
grant execute on function private.admin_verification_reviews(), public.admin_verification_reviews(),
  private.admin_resolve_verification(uuid,boolean,text), public.admin_resolve_verification(uuid,boolean,text)
  to authenticated;
