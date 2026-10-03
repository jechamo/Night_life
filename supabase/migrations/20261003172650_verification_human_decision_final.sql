-- Preserve final human decisions while still acknowledging duplicate webhook events.
CREATE OR REPLACE FUNCTION private.complete_provider_verification(p_provider text, p_event uuid, p_provider_session uuid, p_reference uuid, p_outcome text, p_over_threshold boolean, p_identity_ok boolean, p_occurred timestamp with time zone, p_method text DEFAULT NULL::text, p_threshold integer DEFAULT NULL::integer)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- A later provider decision cannot reverse a final human rejection.
  if v_session.reason = 'reviewed' then return false; end if;
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
end $function$
;
