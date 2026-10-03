-- Block 6 · cascade deletes of sessions (account deletion, purge) must not scan every notification.
create index verification_notifications_session_idx on private.verification_notifications(session_id);
