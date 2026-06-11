# Deploy review — Credit Guardian W1–W4 (2026-06-05)

## Migration file

**Path:** `supabase/migrations/20260605174500_credit_guardian_optimization.sql`

## What the migration actually does (risk classification)

### Low risk — additive only, no data mutation

| Statement | Effect |
|-----------|--------|
| `CREATE TYPE ... EXCEPTION WHEN duplicate_object` | Enums; skipped if already exist |
| `ALTER TABLE clients ADD COLUMN IF NOT EXISTS ...` | 3 nullable columns only |
| `CREATE TABLE IF NOT EXISTS ...` | New empty tables; **skipped entirely if table name already exists** |
| `ALTER TABLE timeline_events ADD COLUMN IF NOT EXISTS ...` | 3 nullable FK columns |
| RLS policies | Access control only |

### What this migration does NOT do

- No `DROP TABLE` / `DROP COLUMN`
- No `UPDATE` / `DELETE` on existing rows
- No backfill or identity-key rewrite of live tradelines
- No merge/dedup of existing tradeline rows

**Important:** Tradeline collapse risk lives in **application code** (`ingest-credit-report` edge function + import UI), triggered only when an operator **commits** an import — not when the migration runs.

## Prod schema collision warning

Lovable batches 2–3 may have already created `tradelines`, `credit_reports`, `dispute_letters`, etc. on prod (`gflvvzkiuleeochqcdeb`).

Because this migration uses `CREATE TABLE IF NOT EXISTS`:

- If prod tables **already exist** with a **different column set**, this migration will **not** alter them — missing columns would cause runtime errors instead of silent reshape.
- Before applying, compare prod `\d tradelines` (Supabase SQL editor) against the migration definition.

**Recommended pre-flight query on prod:**

```sql
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'tradelines', 'tradeline_bureau_states', 'credit_reports',
    'dispute_letters', 'dispute_rounds', 'bureau_responses',
    'weekly_update_renderings', 'payment_plans', 'payments', 'furnishers'
  )
ORDER BY table_name, ordinal_position;
```

If `identity_key` is missing on prod `tradelines`, a **follow-up additive migration** (not this file) is needed — do not assume this file adds columns to existing tables.

## Safe deploy sequence

1. **Backup** — Supabase Dashboard → Project Settings → Database → confirm PITR/backups enabled; note restore point timestamp.
2. **Schema diff** — Run pre-flight query above; compare to migration.
3. **Apply migration** — Only after backup confirmed (Lovable database sync or `supabase db push`).
4. **Publish frontend** — Lovable Publish → Update (edge functions alone are not enough).
5. **Acceptance test #1 (dry-run, no commit)** — Nicole MOHELA partial paste (see `test-fixtures/nicole-mohela-partial-paste.txt`):
   - Scope: **Partial update**
   - Bureau: **TransUnion**
   - Click **Preview diff**
   - Expected: **+0 added, 7 updated, 0 disappeared** (or 7 added if Nicole has no prior snapshot); **7 distinct** tradelines in preview, not 2.
6. **Stop** — Do not click Commit until preview passes.

## Acceptance test fixture

`test-fixtures/nicole-mohela-partial-paste.txt` — 7 MOHELA tradelines, two shared masks, distinct `date_opened` + balance.

## Edge functions (already redeployed per Lovable chat)

- `ingest-credit-report`
- `generate-dispute-letter`
- `generate-weekly-update`

Frontend still requires **Publish → Update**.

## Open items before system-of-record

- Lovable payment banner (account revert to Free)
- Security panel 15 issues
- Storage buckets: `client-deliverables`, `source-reports`, `client-letters`
