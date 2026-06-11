# Credit Guardian — Finish-the-Product Handoff & Debug Report (2026-06-06)

**Owner:** Fendi
**Author:** Claude (Cowork) — hands-on debug of the local repo `/Users/gocrazyglobal/fairway-fixer-18`
**Recommended agent to finish:** **Claude Code** (local, runs the vitest suite + tsc, iterates on type errors, produces a verified diff). Cursor works too; the human-gated deploy steps are the same either way.

---

## TL;DR — the tool is basically built, it was just never shipped

The W1–W4 work + max-strength letter generation **exists in this local folder** (`src/components/creditReport`, `billing`, `weeklyUpdate`, `lib/parser`, the edge functions, and `supabase/migrations/20260605174500_credit_guardian_optimization.sql`). The reason none of it shows up live — and the reason most of the bugs Fendi is hitting exist — is that it was **never deployed**:

1. The repo was **never pushed to git** (GitHub `fendifrost-dot/fairway-fixer-18` last commit is 2026-05-07; this local copy is far ahead and is the source of truth).
2. The **migration was never applied** to the prod DB, and critically…
3. The **Supabase generated types were never regenerated**, so the new code **does not typecheck and cannot build** (see Blocker #1). That's why the live `.lovable.app` is still running the OLD bundle.

So the live app Fendi tests = old code (focus bug, stub letters, unconstrained dates). The new code fixes most of it but can't ship until it builds.

---

## Debug findings

| # | Symptom (reported) | Root cause | Where | Status |
|---|---|---|---|---|
| 1 | App can't build / new features not live | `src/integrations/supabase/types.ts` is **missing** `credit_reports`, `tradelines`, `dispute_letters`, `weekly_update_renderings`, `payment_plans`, `payments` — all of which the new code queries. `tsc` fails with ~dozens of TS2769/TS2589 errors (esp. `BillingPanel.tsx`, `DraftLettersPanel.tsx`). | `src/integrations/supabase/types.ts` vs `supabase/migrations/20260605174500_*.sql` | **BLOCKER — must regenerate types after applying migration** |
| 2 | "Date starts at 0 and spins up from 0" | Native `<input type="date">` with **no `min`/`max`** — the year segment is unconstrained. | `EventForm.tsx:74`, `BillingPanel.tsx:226`, `UploadCreditReportDialog.tsx:166`, `BatchLoggingDialog.tsx:318` | **FIXED in this commit** (see below) |
| 3 | Paste field loses focus after every keystroke | Old deployed version re-mounted the textarea per render. The refactored `ChatGPTImport` holds its own local `input` state and is not remounted (lazy-loaded once inside the inbox tab). | `src/components/operator/ChatGPTImport.tsx` | **Resolved by deploying the new code** — verify post-deploy |
| 4 | "Draft letters" produces an empty stub, no body | Old version logged a `details: null` action with no letters table. New version has a real `dispute_letters` table + `generate-dispute-letter` edge function returning `body_md` + `strength_checklist` (statutes invoked). | `src/components/creditReport/DraftLettersPanel.tsx`, edge fn `generate-dispute-letter` | **Resolved by deploying + verify (Acceptance #3)** |
| 5 | Report import wipes/collapses tradelines | W1 fix (per-bureau scoped diff, composite identity key, no masked-acct dedup) is implemented in `lib/parser` + `creditReport` + the migration's `tradelines` table. | `src/lib/parser/*`, `src/components/creditReport/*` | **Resolved by deploying + run Acceptance #1/#2** |

### What I changed in this commit (date fix — low risk, isolated, typechecks clean)
- **New:** `src/lib/dateBounds.ts` — `todayISO()`, `pastDateBounds()` (min `2000-01-01`, max today), `futureDateBounds()` (min today), `dobBounds()` (max today, min today−120y).
- **Wired in:** `EventForm.tsx` + `BillingPanel.tsx` (due dates → `futureDateBounds()`); `UploadCreditReportDialog.tsx` + `BatchLoggingDialog.tsx` (report/event dates → `pastDateBounds()`).
- `tsc` confirms **no errors reference these files** — the only build errors are Blocker #1.

> Note on DOB: the **new code has no DOB field at all** (the identity-edit from the old live version wasn't re-implemented — no `dob` anywhere in `src`). When DOB editing is added back to the client identity form, use `dobBounds()` (and consider defaulting the picker view ~40 years back). Fendi's framing (≤120y, typically ≤65y) is the intended range.

---

## Blocker #1 — regenerate Supabase types (do this first)

The migration creates the tables; the TS types must be regenerated so the app compiles.

```bash
# After the migration is applied to the project DB (see deploy sequence):
npx supabase gen types typescript --project-id gflvvzkiuleeochqcdeb > src/integrations/supabase/types.ts
# then:
npx tsc --noEmit -p tsconfig.app.json   # expect 0 errors
npm run build
npm run test                            # vitest suite (src/test/*) — incl. importRouting, parser
```

If regenerating against prod isn't desired before apply, apply the migration to a **branch/preview DB** first, gen types from there, confirm the build, then promote.

---

## Deploy sequence (human-gated steps flagged 🔒)

1. 🔒 **Back up first.** Supabase → Database → confirm PITR/snapshot; note timestamp. The migration is additive (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, RLS) — no row mutation — but back up anyway. Also run the pre-flight column check in `docs/DEPLOY_REVIEW_2026-06-05.md` to catch the `IF NOT EXISTS`-won't-add-missing-columns case.
2. 🔒 **Apply the migration** (`20260605174500_credit_guardian_optimization.sql`) via the Supabase SQL editor (or branch first).
3. **Regenerate types** (Blocker #1) → `tsc` clean → `npm run build` → `npm run test` green.
4. **Commit & push to git.** This repo isn't in version control on `main` — there's no rollback safety net. Commit the W1–W4 work + the date fix so `fendifrost-dot/fairway-fixer-18` reflects reality.
5. 🔒 **Publish the frontend** in Lovable (Publish → Update). Edge functions are already deployed per the Lovable build log; the UI is what's stale.
6. **Run acceptance tests on the live app** (below) — start with #1 as a **no-commit preview** to confirm the destructive-import bug is gone before any write.

---

## Acceptance tests (Nicole Yancy fixture: `test-fixtures/nicole-mohela-partial-paste.txt`)

1. **W1 (no-commit dry-run):** paste the 7 MOHELA lines, scope = Partial update, bureau = TransUnion → preview shows **0 disappeared, 7 distinct** (not collapsed to 2). Do **not** commit on the first pass.
2. **W1C:** paste a single bureau reinvestigation result → exactly one `bureau_responses` row + one timeline outcome; no other tradelines mutated.
3. **W2:** after import, Draft letters → Furnisher §1681s-2 → a **persisted `dispute_letters` row** + timeline event with full `body_md` and a strength checklist listing the statutes.
4. **W3:** Generate Weekly Update → downloads a branded `.docx`, logs a timeline event, writes a `weekly_update_renderings` row. Diff against `Weekly_Update_Nicole_Yancy.docx` in the Compass folder (golden file).
5. **W4:** set up a $175 plan → balance badge + "payments due this week"/overdue widgets populate. (Google Calendar OAuth is Phase 2.)
6. **Date fix:** open each date field — the year no longer starts at 0; due-date fields reject past dates, report/event-date fields reject future dates.
7. **Focus fix:** type a full paragraph into "Paste ChatGPT Update" without re-clicking.

## Still Phase 2 (not blockers)
OCR fallback when a PDF has no text layer; dispute-letter `.docx` export to Storage (bodies are markdown today); Google Calendar OAuth + event sync; auto-push weekly update to Google Drive; visual-regression test against the weekly golden file.

---

## Recommended division of labor
- **Claude Code (local):** Blocker #1 (regen types, get `tsc`/`build`/`vitest` green), finalize any remaining type fixes, commit & push to git, produce a clean diff. This is iterative, test-driven, multi-file work it's well suited for.
- **Human (Fendi):** the 🔒 steps — backup confirmation, applying the migration, and Lovable Publish — plus resolving the **Lovable billing banner** ("revert to Free") and the **15 Security findings** before this is system-of-record for client credit data.
