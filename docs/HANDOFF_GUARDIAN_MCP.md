# Handoff — Guardian MCP (phase 1)

Code is in the draft PR. It is not live until the migration runs and the two edge functions are redeployed. This note does not mark either step verified.

## What this is

Staff enroll an agent (cursor, claude, grok, or another lowercase name) in Credit Guardian → Settings → Agent access. The secret is shown once and stored as a SHA-256 hash in `mcp_agents`. Connectors call:

`https://gflvvzkiuleeochqcdeb.supabase.co/functions/v1/guardian-mcp`

```json
{
  "mcpServers": {
    "credit-guardian": {
      "url": "https://gflvvzkiuleeochqcdeb.supabase.co/functions/v1/guardian-mcp",
      "headers": {
        "Authorization": "Bearer cgma_...",
        "apikey": "<the Guardian publishable key already used by the app>"
      }
    }
  }
}
```

The `apikey` header is the public publishable key (`VITE_SUPABASE_PUBLISHABLE_KEY`). It is not the agent secret and it is not `CREDIT_GUARDIAN_KEY`.

## Do not rotate the live key from this PR

`CREDIT_GUARDIAN_KEY` stays the Control Center / Telegram server-to-server secret. The MCP handler rejects that string even if someone pastes it as a Bearer token. Do not copy an agent secret into Control Center, and do not paste `CREDIT_GUARDIAN_KEY` into a Cursor, Claude, or Grok connector.

When you are ready for the keys to be different strings, rotate `CREDIT_GUARDIAN_KEY` in Lovable Cloud and update only the Control Center / Telegram side to the new value. Leave the MCP agent secrets as the `cgma_…` values from Settings. Do not reuse the old key as an MCP secret.

## What Fendi still has to do

1. Review the draft PR. Do not treat a merge as “live.”
2. In the Lovable SQL editor for Credit Guardian (`f7f8be84-44ea-47da-b039-0c5ea8b28e2c`), run `supabase/migrations/20261006180000_guardian_mcp_agents.sql` as written. If it errors, stop. Do not edit the migration to make it run — that means the live database is different, and that difference is the finding.
3. After the SQL, this query should return exactly these two names:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('mcp_agents', 'mcp_audit_log')
ORDER BY table_name;
```

Expected rows: `mcp_agents`, `mcp_audit_log`.

This query should return no rows (anon and authenticated have no grants):

```sql
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('mcp_agents', 'mcp_audit_log')
  AND grantee IN ('anon', 'authenticated');
```

4. Merge, then Lovable **Edge Functions → redeploy** `guardian-mcp` and `guardian-mcp-enroll`. Publish is a separate step and is what puts the Settings card on the live site. Publish does not redeploy edge functions.
5. Sign in as staff. Settings → Agent access → enroll one agent → copy the secret. It will not be shown again.
6. Confirm the checks below. Supabase Auth sign-up stays as it is; turning it off is phase 2, not this PR.

## Checks

A call with no secret (expect HTTP 401, body contains `missing secret`):

```bash
curl -sS -o /tmp/mcp-none.json -w "%{http_code}" \
  -X POST "https://gflvvzkiuleeochqcdeb.supabase.co/functions/v1/guardian-mcp" \
  -H "apikey: $GUARDIAN_PUBLISHABLE_KEY" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

Expected status: `401`. A `404` means the function is not deployed.

A customer-shaped JWT (expect HTTP 401, body contains `session tokens are not accepted`):

```bash
curl -sS -o /tmp/mcp-jwt.json -w "%{http_code}" \
  -X POST "https://gflvvzkiuleeochqcdeb.supabase.co/functions/v1/guardian-mcp" \
  -H "apikey: $GUARDIAN_PUBLISHABLE_KEY" \
  -H "authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiY2xpZW50In0.signature" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

An enrolled agent lists a client and adds a timeline note (expect HTTP 200, and a new row in Settings → Recent calls with tool `add_timeline_event`, that client id, and success):

```bash
curl -sS -X POST "https://gflvvzkiuleeochqcdeb.supabase.co/functions/v1/guardian-mcp" \
  -H "apikey: $GUARDIAN_PUBLISHABLE_KEY" \
  -H "authorization: Bearer $AGENT_SECRET" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"list_clients","arguments":{"limit":1}}}'

curl -sS -X POST "https://gflvvzkiuleeochqcdeb.supabase.co/functions/v1/guardian-mcp" \
  -H "apikey: $GUARDIAN_PUBLISHABLE_KEY" \
  -H "authorization: Bearer $AGENT_SECRET" \
  -H "content-type: application/json" \
  -H "accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"add_timeline_event","arguments":{"client_id":"CLIENT_UUID","raw_line":"MCP phase 1 note"}}}'
```

Use a real client id from the list call. `raw_line` is required. The note is a real ledger row; revoke the test agent when you are done if you do not want that connector left on.

## What was not run here

No production secret was available. The live 401 / list / timeline / audit checks above were not executed against `gflvvzkiuleeochqcdeb`. The migration was not applied. `CREDIT_GUARDIAN_KEY` was not rotated. Local tests cover the same decisions with an in-memory store: missing secret, session JWT, the Control Center key, an enrolled list, a timeline note whose audit row is inserted first, and a refused write when the audit insert fails.
