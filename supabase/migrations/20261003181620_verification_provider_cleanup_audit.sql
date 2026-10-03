-- Record provider deletion outcomes without retaining provider responses or personal data.
create function private.record_verification_cleanup(p_session uuid,p_http_status integer)
returns void language plpgsql security definer set search_path='' as $$
begin
  if coalesce((select auth.jwt()->>'role'),'') <> 'service_role' then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if p_http_status is null or p_http_status < 0 or p_http_status > 599 or not exists(
    select 1 from public.verification_sessions
    where id=p_session and provider='veriff' and state in ('verified','expired')
  ) then raise exception 'bad request' using errcode='22023'; end if;
  perform private.audit('verification.provider_cleanup',
    p_session::text || ':http=' || p_http_status::text ||
    case when p_http_status between 200 and 299 then ':accepted' else ':pending' end);
end $$;
create function public.record_verification_cleanup(p_session uuid,p_http_status integer)
returns void language sql security invoker set search_path='' as $$
 select private.record_verification_cleanup(p_session,p_http_status)
$$;
revoke all on function private.record_verification_cleanup(uuid,integer),
 public.record_verification_cleanup(uuid,integer) from public,anon,authenticated;
grant execute on function private.record_verification_cleanup(uuid,integer),
 public.record_verification_cleanup(uuid,integer) to service_role;
