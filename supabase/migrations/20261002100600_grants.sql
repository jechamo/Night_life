-- Block 5 · Deny by default at the privilege level too (defence in depth on top of RLS).
-- Clients read through RLS; every write goes through the SECURITY DEFINER functions.

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
grant select on all tables in schema public to authenticated;
grant select on public.app_settings, public.legal_documents, public.plans to anon;
-- SOS contacts are the only table the owner writes directly (RLS: own rows, max 3).
grant insert, update, delete on public.emergency_contacts to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.feature_enabled(text) to anon, authenticated;
grant execute on function public.check_signup(text, text) to anon, authenticated;
grant execute on function
  public.has_entitlement(text),
  public.complete_onboarding(jsonb),
  public.sign_documents(text[]),
  public.save_consents(jsonb, text),
  public.update_my_profile(jsonb),
  public.search_public_profiles(integer),
  public.admin_set_flag(text, text),
  public.admin_set_setting(text, integer),
  public.admin_list_users(text, integer),
  public.admin_set_role(uuid, public.app_role, boolean),
  public.admin_dashboard(),
  public.purge_test_data()
to authenticated;

-- Helpers in `private` (not exposed by the API) used inside RLS policies.
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.has_role(public.app_role),
  private.is_admin(),
  private.sees_test_data(),
  private.manages_venue(uuid),
  private.in_match(uuid)
to anon, authenticated;

-- New objects start closed: they must be granted explicitly in their migration.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema private revoke execute on functions from public, anon, authenticated;
