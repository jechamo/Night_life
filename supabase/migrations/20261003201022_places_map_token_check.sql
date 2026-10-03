-- Postgres regex repetition counts stop at 255: validate the public Mapbox token with an
-- unbounded pattern plus an explicit length check instead of {20,290}.
alter table private.provider_access drop constraint if exists provider_access_public_token_check;
alter table private.provider_access add constraint provider_access_public_token_check
  check (public_token = '' or (public_token ~ '^pk\.[A-Za-z0-9_.-]+$'
    and char_length(public_token) between 23 and 300));

create or replace function private.admin_set_map_token(p_token text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text := btrim(coalesce(p_token, ''));
begin
  perform private.require_registered();
  if not private.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  if v_token <> '' and (v_token !~ '^pk\.[A-Za-z0-9_.-]+$' or char_length(v_token) not between 23 and 300) then
    raise exception 'invalid token' using errcode = '22023';
  end if;
  update private.provider_access set public_token = v_token
  where capability = 'mapbox' and mode = 'free_quota';
  perform private.audit('provider.map_token', case when v_token = '' then 'cleared' else 'set' end);
  return private.admin_provider_access();
end $$;
revoke all on function private.admin_set_map_token(text) from public, anon, authenticated;
grant execute on function private.admin_set_map_token(text) to authenticated;
