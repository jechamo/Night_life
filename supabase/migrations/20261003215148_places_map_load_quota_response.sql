-- A used-up hourly map allowance is a normal refusal, not a server error.
create or replace function private.reserve_map_load()
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_token text;
begin
  perform private.require_registered();
  begin
    perform private.place_limit('map_load', 30);
  exception
    when sqlstate '54000' then
      return jsonb_build_object('granted', false, 'reason', 'quota');
  end;
  select public_token into v_token from private.provider_access
  where capability = 'mapbox' and mode = 'free_quota';
  if coalesce(v_token, '') = '' then
    return jsonb_build_object('granted', false, 'reason', 'no_token');
  end if;
  if not private.provider_consume('mapbox', 'free_quota', 1) then
    return jsonb_build_object('granted', false, 'reason', 'quota');
  end if;
  return jsonb_build_object('granted', true, 'token', v_token);
end $$;
