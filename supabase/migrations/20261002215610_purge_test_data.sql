-- Block 5 · Purge of test data (PRD 6.14). Deletes ONLY rows flagged `is_test` and the
-- throw-away Auth users behind test profiles; real accounts are never touched.

-- ── Test data purge (role tester/admin AND test_tools_enabled, PRD 6.14) ───────
create function public.purge_test_data()
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_count integer;
begin
  if not (private.has_role('tester') or private.is_admin())
     or not public.feature_enabled('test_tools_enabled') then
    raise exception 'test tools disabled' using errcode = '42501';
  end if;
  delete from public.attendance where is_test;
  delete from public.lost_and_found where is_test;
  delete from public.events where is_test;
  delete from public.venues where is_test;
  -- Test people are throw-away Auth users: deleting them cascades to every row.
  with gone as (
    delete from auth.users u
    using public.profiles p
    where p.id = u.id and p.is_test
    returning u.id
  )
  select count(*) into v_count from gone;
  perform private.audit('test_data.purge', format('%s test users', v_count));
  return v_count;
end
$$;
