-- Align the live (Lovable-managed) schema with the rich data model the credit
-- ingest / dispute pipeline was written against.
--
-- Background: 20260605174500_credit_guardian_optimization.sql defined this rich
-- schema with CREATE TABLE IF NOT EXISTS, so on the already-existing live tables
-- it was a no-op and the columns were never created. ingest-credit-report,
-- generate-dispute-letter, and analyze-credit-report therefore reference columns
-- that don't exist live (date_opened, account_mask, furnisher_raw, per-bureau
-- balances / payment grids, credit_reports.parse_summary, ...). analyzerContext
-- was separately patched to the simple live columns and is unaffected by this.
--
-- This migration is fully idempotent (ADD COLUMN IF NOT EXISTS / CREATE INDEX IF
-- NOT EXISTS / guarded constraint adds) so it is safe to run on a DB that already
-- had some of these columns hand-added. It does NOT drop the existing live
-- columns (display_name / account_last4 / opened_date / balance / status) — it
-- backfills the new columns from them so both the simple and rich readers work.

-- ---------------------------------------------------------------------------
-- credit_reports: snapshot provenance fields written by ingest-credit-report
-- ---------------------------------------------------------------------------
ALTER TABLE public.credit_reports
  ADD COLUMN IF NOT EXISTS import_scope TEXT NOT NULL DEFAULT 'full_snapshot',
  ADD COLUMN IF NOT EXISTS source_type  TEXT NOT NULL DEFAULT 'paste',
  ADD COLUMN IF NOT EXISTS raw_text     TEXT,
  ADD COLUMN IF NOT EXISTS parse_summary JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ---------------------------------------------------------------------------
-- tradelines: rich identity / furnisher fields (coexist with display_name,
-- account_last4, opened_date, balance, status that Lovable already manages).
-- ---------------------------------------------------------------------------
ALTER TABLE public.tradelines
  ADD COLUMN IF NOT EXISTS furnisher_raw        TEXT,
  ADD COLUMN IF NOT EXISTS furnisher_normalized TEXT,
  ADD COLUMN IF NOT EXISTS account_mask         TEXT,
  ADD COLUMN IF NOT EXISTS date_opened          DATE,
  ADD COLUMN IF NOT EXISTS loan_type            TEXT,
  ADD COLUMN IF NOT EXISTS identity_key         TEXT;

-- Backfill the new columns from the existing simple columns so already-imported
-- tradelines remain readable through the rich code paths.
UPDATE public.tradelines
   SET date_opened = opened_date
 WHERE date_opened IS NULL AND opened_date IS NOT NULL;

UPDATE public.tradelines
   SET account_mask = account_last4
 WHERE account_mask IS NULL AND account_last4 IS NOT NULL;

UPDATE public.tradelines
   SET furnisher_raw = display_name
 WHERE furnisher_raw IS NULL AND display_name IS NOT NULL;

UPDATE public.tradelines
   SET furnisher_normalized = lower(furnisher_raw)
 WHERE furnisher_normalized IS NULL AND furnisher_raw IS NOT NULL;

-- ingest upserts onConflict (client_id, identity_key). Existing rows have a NULL
-- identity_key (NULLs are distinct, so this never collides with them); new
-- imports populate it.
CREATE UNIQUE INDEX IF NOT EXISTS tradelines_client_identity_key_uidx
  ON public.tradelines (client_id, identity_key);

-- ---------------------------------------------------------------------------
-- tradeline_bureau_states: per-bureau financial + payment-grid detail. Lovable's
-- live table only had present / status_on_bureau / operator flags.
-- ---------------------------------------------------------------------------
ALTER TABLE public.tradeline_bureau_states
  ADD COLUMN IF NOT EXISTS credit_report_id      UUID,
  ADD COLUMN IF NOT EXISTS absent_in_latest      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_reported         DATE,
  ADD COLUMN IF NOT EXISTS balance               NUMERIC,
  ADD COLUMN IF NOT EXISTS high_balance          NUMERIC,
  ADD COLUMN IF NOT EXISTS past_due              NUMERIC,
  ADD COLUMN IF NOT EXISTS monthly_payment       NUMERIC,
  ADD COLUMN IF NOT EXISTS pay_status            TEXT,
  ADD COLUMN IF NOT EXISTS account_status        TEXT,
  ADD COLUMN IF NOT EXISTS remarks               JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS two_year_payment_grid JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dispute_flags         JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS parse_confidence      NUMERIC;

-- FK for credit_report_id (guarded so re-running is a no-op).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tbs_credit_report_id_fkey'
  ) THEN
    ALTER TABLE public.tradeline_bureau_states
      ADD CONSTRAINT tbs_credit_report_id_fkey
      FOREIGN KEY (credit_report_id) REFERENCES public.credit_reports(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ingest upserts onConflict (tradeline_id, bureau).
CREATE UNIQUE INDEX IF NOT EXISTS tbs_tradeline_bureau_uidx
  ON public.tradeline_bureau_states (tradeline_id, bureau);
