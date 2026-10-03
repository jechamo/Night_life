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
