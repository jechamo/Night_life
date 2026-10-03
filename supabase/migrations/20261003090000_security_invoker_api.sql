-- Block 5 · Security Advisors (lints 0028/0029): no SECURITY DEFINER functions in the
-- exposed `public` schema. Flags/entitlements become SECURITY INVOKER (RLS already lets
-- the caller read them). The privileged RPCs move to `private` (not exposed by the API)
-- and `public` keeps thin SECURITY INVOKER wrappers with the same signature. Every
-- implementation still checks the session, role, MFA and flags itself.

alter function public.feature_enabled(text) security invoker;
alter function public.has_entitlement(text) security invoker;

alter function public.check_signup(text, text) set schema private;
alter function public.complete_onboarding(jsonb) set schema private;
alter function public.sign_documents(text[]) set schema private;
alter function public.save_consents(jsonb, text) set schema private;
alter function public.update_my_profile(jsonb) set schema private;
alter function public.search_public_profiles(integer) set schema private;
alter function public.admin_set_flag(text, text) set schema private;
alter function public.admin_set_setting(text, integer) set schema private;
alter function public.admin_list_users(text, integer) set schema private;
alter function public.admin_set_role(uuid, public.app_role, boolean) set schema private;
alter function public.admin_dashboard() set schema private;
alter function public.purge_test_data() set schema private;

create function public.check_signup(p_phone text, p_device_id text default null)
returns text language sql volatile security invoker set search_path = ''
as $$ select private.check_signup(p_phone, p_device_id) $$;

create function public.complete_onboarding(p jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.complete_onboarding(p) $$;

create function public.sign_documents(p_slugs text[])
returns void language sql security invoker set search_path = ''
as $$ select private.sign_documents(p_slugs) $$;

create function public.save_consents(p_choices jsonb, p_city text default null)
returns void language sql security invoker set search_path = ''
as $$ select private.save_consents(p_choices, p_city) $$;

create function public.update_my_profile(p jsonb)
returns void language sql security invoker set search_path = ''
as $$ select private.update_my_profile(p) $$;

create function public.search_public_profiles(p_limit integer default 20)
returns table (
  id uuid, name text, age integer, gender public.gender, bio text,
  traffic_light public.traffic_light, is_test boolean
)
language sql stable security invoker set search_path = ''
as $$ select * from private.search_public_profiles(p_limit) $$;

create function public.admin_set_flag(p_key text, p_value text)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_set_flag(p_key, p_value) $$;

create function public.admin_set_setting(p_key text, p_value integer)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_set_setting(p_key, p_value) $$;

create function public.admin_list_users(p_query text default '', p_limit integer default 50)
returns table (
  id uuid, name text, phone_hint text, roles text[], is_test boolean, created_at timestamptz
)
language sql security invoker set search_path = ''
as $$ select * from private.admin_list_users(p_query, p_limit) $$;

create function public.admin_set_role(p_user uuid, p_role public.app_role, p_granted boolean)
returns void language sql security invoker set search_path = ''
as $$ select private.admin_set_role(p_user, p_role, p_granted) $$;

create function public.admin_dashboard()
returns jsonb language sql stable security invoker set search_path = ''
as $$ select private.admin_dashboard() $$;

create function public.purge_test_data()
returns integer language sql security invoker set search_path = ''
as $$ select private.purge_test_data() $$;

-- Same exposure as before: anon only for the pre-sign-up check and flags.
grant execute on function public.check_signup(text, text) to anon, authenticated;
grant execute on function private.check_signup(text, text) to anon, authenticated;
grant execute on function
  public.complete_onboarding(jsonb), public.sign_documents(text[]),
  public.save_consents(jsonb, text), public.update_my_profile(jsonb),
  public.search_public_profiles(integer), public.admin_set_flag(text, text),
  public.admin_set_setting(text, integer), public.admin_list_users(text, integer),
  public.admin_set_role(uuid, public.app_role, boolean), public.admin_dashboard(),
  public.purge_test_data(),
  private.complete_onboarding(jsonb), private.sign_documents(text[]),
  private.save_consents(jsonb, text), private.update_my_profile(jsonb),
  private.search_public_profiles(integer), private.admin_set_flag(text, text),
  private.admin_set_setting(text, integer), private.admin_list_users(text, integer),
  private.admin_set_role(uuid, public.app_role, boolean), private.admin_dashboard(),
  private.purge_test_data()
to authenticated;
