-- Performance advisor: cover the sender_id foreign key of private.likes_seen.
-- Additive only; no data change.
create index if not exists likes_seen_sender_idx on private.likes_seen(sender_id);
