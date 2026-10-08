-- Roadmap 2026-10 R1: returning users may sign in with an email code (off by default).
-- Additive: a new flag row only; nothing else changes until an admin turns it on.
insert into public.app_settings (key, kind, value, allowed_values)
values ('email_login_enabled', 'flag', 'off', array['on', 'off'])
on conflict (key) do nothing;
