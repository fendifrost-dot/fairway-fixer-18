# Handoff for Cursor — finish Credit Guardian Add Client + MCP `create_client`

Paste this whole file into Cursor as the opening prompt. Written 2026-10-15.
Repo: `fendifrost-dot/fairway-fixer-18` (Credit Guardian). Lovable project id
`f7f8be84-44ea-47da-b039-0c5ea8b28e2c`, workspace `A89kW78EdcdagG7TLXiw`.

You are finishing work a cloud Claude Code session could not: it had no way to
merge to `main`, no Lovable buttons, and the MCP server it could reach was the
old deployed one. You have the user's git credentials, the Lovable UI, and you
are yourself an enrolled Credit Guardian MCP agent (`cursor`) that already holds
the new `clients.create` scope.

## Where things stand (verified from real output, not claims)

| Thing | State |
|---|---|
| Code | ✅ commit `a5dbc53` on branch `claude/nice-wright-yya4uw`, draft PR [#5](https://github.com/fendifrost-dot/fairway-fixer-18/pull/5), 1 commit ahead of `main` (`0ee74d8`), mergeable, no conflicts |
| Local validation | ✅ `npx vitest run` 202/202 in 16 files; `npx tsc -p tsconfig.app.json --noEmit` clean; eslint clean on changed files |
| Live DB: 5-arg `create_client_and_matter` overload | ✅ gone. Exactly one overload (11 args) remains; acl = authenticated + service_role |
| Live DB: `clients.create` scope | ✅ in the `mcp_agents_scopes_check` constraint; agents `claude`, `cursor`, `grok` all hold it |
| Live DB: `set_matters_owner_id()` trigger | ✅ now `COALESCE(auth.uid(), NEW.owner_id)`; dry run with no `auth.uid()` kept the staff owner and was rolled back |
| Edge functions `guardian-mcp`, `guardian-mcp-enroll` | ❌ **not redeployed** — live server still has 11 tools, no `create_client` |
| Frontend Publish | ❌ not done (only affects the Settings → Agent access label) |
| Deajah Newman client row | ❌ not created — 0 rows match `%newman%` |

Both migrations in this PR (`20261015120000_…`, `20261015121000_…`) are already
applied to the live database. Re-running them is harmless (they are idempotent and
assert their own end state) but unnecessary.

## Hard rules

* ❌ No `supabase` CLI — a 403 there is a false wall. ❌ No supabase.com dashboard.
* ❌ Do not edit either migration to make anything run. If one errors, the live DB
  differs from the repo; stop and report the error verbatim.
* ❌ Do not re-add the 5-argument `create_client_and_matter`. It was the bug.
* ❌ Do not invent Deajah's details. Anything not in the table below comes from
  Fendi or from her three report PDFs.
* ✅ SQL → Lovable SQL editor (or the Lovable MCP `query_database` tool on this
  project). Edge functions → Lovable → Edge Functions → redeploy. Frontend →
  Lovable → Publish. **Publish ≠ edge redeploy.** Name which button you pressed.

## Step 1 — Merge to `main`

```
git fetch origin
git checkout main && git pull --ff-only origin main
git merge --ff-only origin/claude/nice-wright-yya4uw
npx vitest run          # expect: Test Files 16 passed, Tests 202 passed
npx tsc -p tsconfig.app.json --noEmit   # expect: no output
git push origin main
```

If `--ff-only` refuses, `main` moved since `0ee74d8`. Do a normal merge, re-run
both checks, then push. Either way PR #5 closes as merged on its own.

### 1a — Verify

`git log --oneline -1 origin/main` shows `a5dbc53` (or your merge commit on top of it).

## Step 2 — Confirm Lovable picked up `main`

In the Lovable editor for Credit Guardian, open
`supabase/functions/_shared/guardianMcp.ts` and confirm it contains
`name: "create_client"` and `SERVER_VERSION = "1.1.0"`. If it still says `1.0.0`,
Lovable has not synced; wait or trigger the sync before redeploying, otherwise
you redeploy the old code.

## Step 3 — Redeploy the two edge functions

Lovable → Edge Functions → redeploy **`guardian-mcp`** and **`guardian-mcp-enroll`**.
(If Lovable chat is the only way: "Redeploy the guardian-mcp and guardian-mcp-enroll
edge functions. No code changes." Nothing else.)

### 3a — Verify (never optional)

From Cursor, using the Credit Guardian MCP connection, call `tools/list`.
Expected: **12 tools** including `create_client`. The old server returns **11**
without it. If you still see 11, the redeploy did not take or Lovable deployed
pre-sync code; go back to Step 2.

Anonymous probe (does not distinguish old from new, only deployed from not):

```
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://<project-ref>.supabase.co/functions/v1/guardian-mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
```

Expected `401`. `404` = not deployed.

## Step 4 — Lovable → Publish

Publishes the Settings → Agent access card with the new "Create a client and its
first matter" checkbox. Not required for the MCP tool.

## Step 5 — Create Deajah Newman

Use the MCP tool `create_client` (you hold the scope). Known so far:

| Field | Value |
|---|---|
| `legal_name` | `Deajah Newman` |
| `date_of_birth` | birth year 1995; **full YYYY-MM-DD must come from Fendi or the reports** |
| `current_address` | Dolton, IL — **full street address from Fendi or the reports** |
| `notes` | her name variations as each bureau prints them (Experian / Equifax / TransUnion) |
| `experian_score`, `equifax_score`, `transunion_score` | the three scores pulled 2026-10-15, from the reports |
| `matter_type` | `Credit` (default, can omit) |
| `intake_source` | `Cursor` |

Omit any field you cannot source. Do not guess a DOB or an address. Expected
result: a `client` object with an `id` and a `matter_id`, no `ssn_last4` echoed.

If a Chrome-side Claude agent still has the Add Client form open with her details
staged, it is fine for that agent to click Create Client instead. **Do not do both.**

### 5a — Verify

```sql
select id, legal_name, owner_id, date_of_birth, experian_score, equifax_score,
       transunion_score, created_at
from public.clients where legal_name ilike '%newman%';

select id, client_id, owner_id, matter_type, primary_state, intake_source
from public.matters
where client_id in (select id from public.clients where legal_name ilike '%newman%');

select tool, client_id, success, error, created_at
from public.mcp_audit_log where tool = 'create_client'
order by created_at desc limit 5;
```

Expected: exactly **1** client row and **1** matter row, both with a non-null
`owner_id` (`4b5e536e-3907-471a-ba68-8a4e4c503e98`, the staff member who enrolled
the agents). The audit row shows `success = true` and the new `client_id`. Two
client rows means both paths ran; remove the duplicate through the app's Delete
Client flow, not SQL.

## Not in this handoff

Running her three reports through the analyzer and checking the results against
the PDFs is the next job and is not covered here.

## Report back

* Step 1: the `origin/main` SHA.
* Step 3: which functions you redeployed and the `tools/list` count (expect 12).
* Step 4: Publish pressed yes/no.
* Step 5a: all three result sets pasted verbatim.
* Any error, verbatim. "Done" without output is not done.
