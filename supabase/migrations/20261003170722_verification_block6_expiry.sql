-- Block 6 · pending window per provider: Yoti sessions live 15 minutes (ttl 900), a Veriff
-- session link stays usable for a day. Decisions are accepted up to 7 days either way.
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
      now() + case when v_provider = 'veriff' then interval '24 hours' else interval '15 minutes' end)
    returning id into v_id;
  if p_level <> 'age' then
    insert into public.consent_records(user_id,kind,consent_key,granted,method,document_version)
      values(v_uid,'consent',p_level || '_verification',true,'signature','verification-1');
  end if;
  return jsonb_build_object('id',v_id,'mode',v_mode,'method',p_method,'threshold',v_threshold,'provider',v_provider);
end $$;
