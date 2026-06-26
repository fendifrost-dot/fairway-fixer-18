-- Drop the legacy tradelines uniqueness that predates the identity-key model.
--
-- uniq_tradelines_client_name_last4 enforced one tradeline per
-- (client_id, name, account_last4). The ingest pipeline now keys tradelines by
-- (client_id, identity_key) — a composite of furnisher + mask + date_opened +
-- balance — which legitimately allows multiple rows that share a name/last4 but
-- differ on date/balance (e.g. several student loans under one servicer). The
-- legacy constraint collides those on insert (Postgres 23505).
--
-- The correct uniqueness, tradelines_client_identity_key_uidx (client_id,
-- identity_key), was added in 20260625183000_align_live_schema_to_credit_ingest.sql.

ALTER TABLE public.tradelines DROP CONSTRAINT IF EXISTS uniq_tradelines_client_name_last4;
