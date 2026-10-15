# Handoff — Credit Guardian: any enrolled agent can add a client

Written 2026-10-15. Repo `fendifrost-dot/fairway-fixer-18` (Credit Guardian).
Lovable project **Credit Guardian** `f7f8be84-44ea-47da-b039-0c5ea8b28e2c`,
workspace `A89kW78EdcdagG7TLXiw`.

## The core problem and what changed

New clients could only enter Credit Guardian two ways: the Add Client form (which was
broken for everyone) and the Capital-site payment flow. No agent Fendi talks to
(Claude, Cursor, Grok, the Control Center) could add a client on request, because
the MCP server had no create tool and its scope allow-list had no room for one.

| Root cause | Fix | Where |
|---|---|---|
| Two overloads of `create_client_and_matter` (5-arg and 11-arg with defaults) made every Add Client RPC ambiguous → "RPC call failed" | 5-arg overload dropped; canonical 11-arg definition recorded; exactly one overload asserted | `supabase/migrations/20261015120000_drop_legacy_create_client_overload.sql` |
| MCP had no create tool; `mcp_agents.scopes` CHECK had no create scope | `clients.create` scope + `create_client` tool; scope granted to every active agent holding the write set (claude, cursor, grok) | `20261015121000_mcp_clients_create_scope.sql`, `supabase/functions/_shared/guardianMcp.ts`, `guardianMcpSupabase.ts` |
| `matters` BEFORE INSERT trigger overwrote `owner_id` with `auth.uid()`, null for the service role → every tool-created matter would fail NOT NULL | trigger now `COALESCE(auth.uid(), NEW.owner_id)`; signed-in behavior unchanged | same migration |
| Control Center API could not create a client either | `create_client` action (channel `control_center` or `website_subscription`, owner from `CREDIT_GUARDIAN_DEFAULT_OWNER_ID`) | `supabase/functions/_shared/creditGuardianApi.ts` |
| No way to tell a website subscriber from a hand-added client, or whether a hand-added client paid | `clients.intake_channel` (staff, agent, control_center, website_subscription) and `clients.payment_standing` (subscriber, paid_in_full, partial, unpaid, unknown); exposed in MCP create/update/list, the API, the Add Client form, and the client list badges | `20261015123000_client_intake_channel_payment_standing.sql`, `src/pages/Clients.tsx`, `src/components/clients/AddClientDialog.tsx` |

Channel is stamped by the path that created the row and is not an input on
`create_client` (the MCP always writes `agent`). Payment standing is staff-maintained
and can be set at creation or changed later through `update_client`, the API, or the
app. It is not derived from `payment_plans`, which is empty.

## Status (verified from real output; nothing below is a claim)

| Thing | State |
|---|---|
| All three migrations on the live database | ✅ applied 2026-10-15 via the Lovable query tool and re-read afterwards: one `create_client_and_matter` overload (11 args, acl authenticated + service_role); scopes CHECK lists `clients.create`; `claude`, `cursor`, `grok` hold it; trigger uses `COALESCE(auth.uid(), NEW.owner_id)`; `clients.intake_channel` / `payment_standing` present with CHECKs, all 37 rows `staff` / `unknown` |
| Rolled-back live dry run of the insert path | ✅ with no `auth.uid()`, the matter kept the explicit staff owner; 0 dry-run rows remain |
| Local validation | ✅ `npx vitest run` 16 files / 203 tests pass; `npx tsc -p tsconfig.app.json --noEmit` clean; eslint clean on every changed file except three pre-existing `as any` casts in `AddClientDialog.tsx` that predate this work |
| Code merged to `main` | see PR #5 |
| Edge functions redeployed (`guardian-mcp`, `guardian-mcp-enroll`, `cross-project-api`, `control-center-api`) | ❌ until the step below is executed and verified |
| Frontend published | ❌ until executed |
| Deajah Newman | ❌ not created (secondary; 0 rows match `%newman%`) |

## Hard rules

* ❌ No `supabase` CLI (403 = false wall). ❌ No supabase.com dashboard.
* ❌ Do not edit a migration to make it run. All three are applied; a re-run is
  idempotent. An error on re-run means the live DB drifted; report it verbatim.
* ❌ Do not re-add the 5-argument `create_client_and_matter`. It was the bug.
* ✅ SQL → Lovable SQL editor or Lovable MCP `query_database`. Edge functions →
  Lovable → Edge Functions → redeploy. Frontend → Lovable → Publish.
  **Publish ≠ edge redeploy.** Say which one was pressed.

## Remaining steps

### 1 — Confirm Lovable has synced `main`

In Lovable, `supabase/functions/_shared/guardianMcp.ts` must contain
`name: "create_client"` and `SERVER_VERSION = "1.1.0"`, and
`creditGuardianApi.ts` must contain `action === "create_client"`. If not, Lovable
has not pulled `main`; redeploying now ships the old code.

### 2 — Redeploy four edge functions

`guardian-mcp`, `guardian-mcp-enroll` (same shared module), `cross-project-api`,
`control-center-api` (same shared module).

**Verify:** with any enrolled agent secret, MCP `tools/list` returns **12 tools**
including `create_client` (old server: 11, none). For the API, POST
`{"action":"nonsense"}` with the `x-api-key`; the 400 `hint` must list
`create_client` (old code does not).

### 3 — Publish the frontend

Client list shows a payment badge and a channel badge on every card; Add Client has a
"Payment standing" select in both tabs; Settings → Agent access lists "Create a
client and its first matter".

### 4 — Deajah Newman (secondary)

Either the Add Client form (works again) or MCP `create_client`. Known: legal name
`Deajah Newman`, birth year 1995 (full date from the reports), Dolton IL (street
address from the reports), name variations per bureau for `notes`, three scores
pulled 2026-10-15. Do not guess any of those. Set `payment_standing` to what Fendi
says; otherwise leave it `unknown`. Exactly one client row and one matter row should
exist afterwards:

```sql
select id, legal_name, owner_id, intake_channel, payment_standing, created_at
from public.clients where legal_name ilike '%newman%';
select id, client_id, owner_id, matter_type, primary_state from public.matters
where client_id in (select id from public.clients where legal_name ilike '%newman%');
```

## Noted, not fixed

* `public.debug_create_client_and_matter` (11 args) still grants EXECUTE to `anon`
  and `PUBLIC`. SECURITY INVOKER and RLS block anonymous inserts, so not an open
  door, but it should lose those grants or be dropped like its 5-arg sibling.
* `client_status` enum has a stray lowercase `active` label beside `Active`.
* A `__dbg_matters_payload` NOTICE trigger is still attached to `matters`.
