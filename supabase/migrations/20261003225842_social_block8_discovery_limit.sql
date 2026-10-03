-- Apply the discovery quota to the legacy endpoint too; no unmetered alternate API.
create or replace function private.search_public_profiles(p_limit integer default 20)
returns table(id uuid,name text,age integer,gender public.gender,bio text,traffic_light public.traffic_light,is_test boolean)
language plpgsql security definer set search_path='' as $$
begin
 perform private.require_registered();
 perform private.social_limit('profiles',120);
 return query select p.id,p.name,private.age_years(p.birthdate),p.gender,p.bio,p.traffic_light,p.is_test
 from public.profiles p where private.social_pair((select auth.uid()),p.id)
 order by p.last_active_at desc,p.id limit least(greatest(p_limit,1),50);
end $$;
create or replace function public.search_public_profiles(p_limit integer default 20)
returns table(id uuid,name text,age integer,gender public.gender,bio text,traffic_light public.traffic_light,is_test boolean)
language sql security invoker set search_path='' as $$ select * from private.search_public_profiles(p_limit) $$;
revoke all on function private.search_public_profiles(integer),public.search_public_profiles(integer) from public,anon,authenticated;
grant execute on function private.search_public_profiles(integer),public.search_public_profiles(integer) to authenticated;
