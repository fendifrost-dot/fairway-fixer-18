# Handoff — Credit Guardian: Add Client fix + MCP `create_client`

Written 2026-10-15 for the next agent. Assume repo access and possibly browser tools,
but no memory of the session that produced this.

## What happened

1. **Add Client was broken for everyone.** The live database had two overloads of
   `public.create_client_and_matter`: the original 5-argument one (migration
   `20260127045458`) and an 11-argument one (dob, address, ssn_last4, phone, email,
   alternate_addresses) that had been created directly in Lovable Cloud and never
   recorded in this repo. Every optional argument on the 11-argument version has a
   DEFAULT, so a call with the 5 base arguments matched both and PostgREST refused
   with "Could not choose the best candidate function" (shown in the UI as
   "RPC call failed").
2. A Chrome-side agent dropped the 5-argument overload by hand on 2026-10-15. This
   session made that reproducible (migration `20261015120000`) and recorded the
   canonical 11-argument definition so a rebuilt database cannot reintroduce the
   ambiguity.
3. **No tool could create a client.** The Credit Guardian MCP server (`guardian-mcp`)
   had no create tool and its scopes allow-list had no room for one. This session
   added the `clients.create` scope and a `create_client` tool, and granted the scope
   to the three enrolled agents (claude, cursor, grok).
4. A `BEFORE INSERT` trigger on `matters` overwrote `owner_id` with `auth.uid()`
   unconditionally. The MCP runs as the service role, where `auth.uid()` is null, so
   the first matter the tool inserted would have failed `NOT NULL`. The trigger now
   keeps an explicit `owner_id` when there is no signed-in user. Signed-in behavior
   is unchanged.

## Status going in

| Thing | State |
|---|---|
| Code on branch `claude/nice-wright-yya4uw` | ✅ committed, PR open against `main` |
| Code on `main` | ❌ not merged — merge the PR first |
| Migration `20261015120000_drop_legacy_create_client_overload.sql` on live DB | ✅ applied 2026-10-15 via Lovable (query tool), verified: exactly one `create_client_and_matter`, 11 args, acl `authenticated` + `service_role` |
| Migration `20261015121000_mcp_clients_create_scope.sql` on live DB | ✅ applied 2026-10-15, verified: constraint lists `clients.create`; agents `claude`, `cursor`, `grok` each hold it; `set_matters_owner_id()` uses `COALESCE(auth.uid(), NEW.owner_id)` |
| Edge function `guardian-mcp` redeployed | ❌ **not done** — the deployed server still has 11 tools and no `create_client` |
| Frontend published (Settings → Agent access shows the new scope label) | ❌ not done |
| Deajah Newman client row | ❌ not created — `clients` has 0 rows matching `%newman%` as of 2026-10-15 |
| Validated locally | ✅ `npx vitest run` 202/202 (16 files, incl. new `src/test/guardianMcpCreateClient.test.ts`), `npx tsc -p tsconfig.app.json --noEmit` clean, eslint clean on changed files |
| Live dry run of the insert path | ✅ client + matter inserted as the no-`auth.uid()` role kept `owner_id = 4b5e536e-…` and was rolled back; 0 dry-run rows remain |

## Hard rules

* ❌ No `supabase` CLI — a 403 there is a **false wall**, not a blocker.
* ❌ No supabase.com dashboard for migrations.
* ❌ Don't ask Fendi to paste SQL — you have the SQL, you run it (Lovable SQL editor
  or the Lovable MCP `query_database` tool on this project).
* ✅ Functions → **Lovable → Edge Functions → redeploy**. Frontend → **Lovable → Publish**.
* **Publish ≠ edge redeploy.** Separate buttons. Name which one you pressed.
* ❌ Do **not** edit either migration to make it run. Both are already applied; if one
  errors on re-run, the live database differs from the repo and that is the finding.
* ❌ Do not re-add the 5-argument overload "for compatibility". It is the bug.

## Coordinates

| | |
|---|---|
| Lovable project | **Credit Guardian** — `f7f8be84-44ea-47da-b039-0c5ea8b28e2c` (workspace `A89kW78EdcdagG7TLXiw`) |
| Repo | `github.com/fendifrost-dot/fairway-fixer-18` |
| Function to redeploy | `guardian-mcp` (the only one whose code changed; `guardian-mcp-enroll` imports the same shared file and should be redeployed too so the `write` alias includes `clients.create`) |
| Files changed | `supabase/functions/_shared/guardianMcp.ts`, `supabase/functions/_shared/guardianMcpSupabase.ts`, `src/components/settings/AgentAccessCard.tsx`, `src/integrations/supabase/types.ts`, the two migrations above, `src/test/guardianMcpCreateClient.test.ts` |

---

## Step 1 — Merge the PR to `main`

Lovable syncs from `main`. Nothing below can be redeployed until the branch is merged.

## Step 2 — Lovable → Edge Functions → redeploy `guardian-mcp` and `guardian-mcp-enroll`

### Step 2a — Verify it landed (never optional)

From any client that holds the `claude` agent secret (the Credit Guardian MCP in
Claude), call `tools/list`. Expected: **12 tools**, including `create_client`. The
deployed server before this change returns **11** and no `create_client`.

Or, with no secret at all:

```
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  https://<project-ref>.supabase.co/functions/v1/guardian-mcp \
  -H 'content-type: application/json' \
  -d '{"jsonrpc":"2.0","id":1,"method":"ping"}'
```

Expected `401` (deployed, refusing anonymous calls). `404` means not deployed. This
check does not distinguish old from new code; only `tools/list` does.

## Step 3 — Lovable → Publish (frontend)

Only affects the Settings → Agent access card (new "Create a client and its first
matter" checkbox) and the generated DB types. Not required for the MCP tool to work.

## Step 4 — Create Deajah Newman

Either path works now that the overload is gone:

* **Add Client form** in the app (the original blocker is fixed; the Chrome-side
  agent had her details staged), or
* after Step 2, the MCP tool `create_client` with `legal_name: "Deajah Newman"`,
  `date_of_birth` (YYYY-MM-DD), `current_address`, `notes` (name variations per
  bureau), and `experian_score` / `equifax_score` / `transunion_score`.

### Step 4a — Verify

```sql
select id, legal_name, owner_id, experian_score, equifax_score, transunion_score, created_at
from public.clients where legal_name ilike '%newman%';
select id, client_id, owner_id, matter_type, primary_state from public.matters
where client_id in (select id from public.clients where legal_name ilike '%newman%');
```

Expected: exactly **1** client row and **1** matter row, both with a non-null
`owner_id`. Two client rows means both paths were run; delete the duplicate through
the app's Delete Client flow, not SQL.

## What to report back

* Which Lovable buttons were pressed (redeploy of which functions; Publish yes/no).
* The `tools/list` count after redeploy (expect 12).
* The two Step 4a result sets, pasted verbatim.
* Anything that errored, verbatim. Do not summarize an error as "done".

## Noted, not fixed (out of scope)

* `public.debug_create_client_and_matter` (11 args) still grants EXECUTE to `anon`
  and `PUBLIC`. It is SECURITY INVOKER and RLS blocks anonymous inserts, so it is not
  an open door, but it should lose those grants or be dropped like its 5-arg sibling
  was in `20260627151908`.
* The `client_status` enum has a stray lowercase `active` label alongside `Active`.
* A `__dbg_matters_payload` NOTICE trigger is still attached to `matters`.
