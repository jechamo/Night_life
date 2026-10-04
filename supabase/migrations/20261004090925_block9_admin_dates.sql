create or replace function private.admin_case_list(p_section text) returns jsonb
language plpgsql security definer set search_path='' as $$
declare tab text; result jsonb;
begin
 perform private.require_admin(); perform private.require_registered();
 tab:=case p_section when 'reports' then 'reports' when 'appeals' then 'appeals' when 'bans' then 'bans'
 when 'claims' then 'venue_claims' when 'events' then 'events' when 'sponsorships' then 'sponsorships'
 when 'subscriptions' then 'subscriptions' when 'entitlements' then 'entitlements' when 'promoCodes' then 'promo_codes'
 when 'paymentEvents' then 'payment_events' when 'dataRequests' then 'data_requests' when 'legalDocs' then 'legal_documents'
 when 'escalations' then 'safety_escalations' end;
 if tab is null then raise exception 'invalid section' using errcode='22023'; end if;
 execute format('select coalesce(jsonb_agg(jsonb_build_object(
 ''id'',coalesce(r->>''id'',r->>''code''),
 ''title'',coalesce(r->>''title'',r->>''plan_code'',r->>''key'',r->>''code'',r->>''reason'',r->>''type'',r->>''kind'',r->>''report_id'',r->>''venue_id'',''''),
 ''subtitle'',concat_ws('' · '',r->>''user_id'',r->>''target_user_id'',r->>''comment'',r->>''text'',r->>''explanation'',r->>''evidence''),
 ''status'',case when %L=''bans'' then case when r->>''until'' is null or (r->>''until'')::timestamptz>now() then ''active'' else ''lifted'' end else coalesce(r->>''status'',''logged'') end,
 ''createdAt'',coalesce(r->>''created_at'',r->>''started_at'',r->>''issued_at'',r->>''processed_at''),
 ''facts'',array_remove(array[r->>''mode'',r->>''tier'',r->>''invoice_ref'',r->>''provider_event_id'',r->>''notice_reference'',r->>''due_at'',r->>''language'',r->>''version''],null)
 ) order by coalesce(r->>''created_at'',r->>''started_at'') desc),''[]'') from
 (select to_jsonb(t) r from public.%I t limit 200) q',p_section,tab) into result;
 -- Exact DSA locator and contact are confined to the authenticated MFA case reviewer.
 if p_section='reports' then
  select coalesce(jsonb_agg(x||jsonb_build_object('subtitle',concat_ws(' · ',x->>'subtitle',n.url,n.email))),'[]') into result
  from jsonb_array_elements(result) x left join public.illegal_content_notices n on n.report_id=(x->>'id')::uuid;
 end if;
 return result;
end $$;
