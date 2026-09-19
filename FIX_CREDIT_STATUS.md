# FIX_CREDIT_STATUS — Credit Guardian edge-function lockdown

**Branch:** `fix/hard-launch-edge-auth` (from `main` @ `be56e45`)
**Lane:** C · Continuum hard-launch audit · Grok-initiated
**Date:** 2026-09-18 · **Launch target:** Mon 2026-09-21 America/Chicago
**Source findings:** `~/Desktop/CONTINUUM_HARD_LAUNCH_AUDIT/CREDIT_FINDINGS.md`

Verification: `npm run build` ✅ · `npm test` → 192/192 ✅ · `deno check` on edited
functions ✅ (the 3 remaining `deno check` errors — creditGuardianApi `import_timeline_events`
row typing, weekly-update image `type:"png"` — **pre-exist on `main`**; this PR adds none).

---

## What shipped in this PR

### B1 — `cross-project-api` / `control-center-api` hardening 🔴→🟢 (partial, coordinated)
`supabase/functions/_shared/creditGuardianApi.ts`
- **Timing-safe key comparison** — replaced `apiKey !== expectedKey` with a constant-time
  `timingSafeEqual()` (folds length diff into the accumulator, no early exit). Missing/invalid
  key still returns **401**.
- **CORS tightened** — removed `Access-Control-Allow-Origin: *`. Now reflects an Origin only
  if it is in the `CREDIT_GUARDIAN_ALLOWED_ORIGINS` allow-list (comma-separated env). Unknown
  browser origins get no ACAO header; server-to-server callers (no Origin) are unaffected, so
  the OS bridge keeps working. Adds `Vary: Origin`.
- **`get_clients` bounded** — added `.limit()` (default 200, max 500) to cap bulk PII pulls.
- **`verify_jwt` left `false` ON PURPOSE** — these are the Continuum OS ↔ Guardian bridge
  endpoints. Flipping JWT verify would break the OS side and MUST be coordinated with Lane A
  (see "For Fendi / cross-lane"). Config comment added in `config.toml`.

> Not done here (needs Lane A coordination): per-`client_id` ownership authorization on each
> action, and moving from a static shared key to signed short-lived tokens. Left as follow-ups.

### B2 — `project-stats` now staff/admin-only 🔴→🟢
`supabase/functions/project-stats/index.ts` + `config.toml`
- **`verify_jwt = true`** in config (platform rejects unauthenticated calls) **AND** in-code
  authz: resolves the caller via the forwarded JWT (`auth.getUser()`), then requires an
  `admin` or `staff` row in `user_roles` (checked with the service role). Returns **401** (no/
  invalid token), **403** (authenticated but not staff/admin). No more public row-count dump.
- CORS tightened to the same origin allow-list.

### B3 — Storage buckets created, private, owner/admin-scoped 🔴→🟢
`supabase/migrations/20260918000000_hard_launch_storage_buckets.sql`
- Creates `client-letters`, `source-reports`, `client-deliverables` as **private**
  (`public = false`, idempotent — forces false even if they already exist).
- Adds `storage.objects` RLS (SELECT/INSERT/UPDATE/DELETE) for the `authenticated` role,
  scoped via `public.can_access_client(<client_id>)` where the client id is the **leading
  path segment** (`<client_id>/<file>`). Anon/public get nothing. Admins pass via `is_admin()`
  inside `can_access_client`.
- Helper `public.storage_object_client_id(name)` parses the first path segment as a uuid and
  **fails closed** (returns NULL → access denied) on malformed paths.
- Normalized the one existing uploader (`generate-weekly-update`) from
  `client-deliverables/<clientId>/<file>` → `<clientId>/<file>` so the RLS convention holds.
  (Edge functions upload/sign under the service role, so this doesn't change server behavior.)

> **Apply step (Lovable):** run the new migration via Lovable's SQL/migration apply so the
> buckets + policies exist in project `gflvvzkiuleeochqcdeb`. Then confirm in the Supabase
> dashboard that all three buckets show **Private**.

### H1 — Public self-signup gated 🟠→🟢 (UI)
`src/pages/Auth.tsx` + `.env.example`
- Sign-Up tab/form now render only when `VITE_ALLOW_PUBLIC_SIGNUP === "true"` (default
  **false** = invite-only). Sign-in, forgot-password unchanged. Console defaults to a single
  sign-in card in production.
- **Not rotated:** `CREDIT_GUARDIAN_KEY` — left for Fendi (code-red), see below.

### M1 — Debug scaffolding removed from client-create path 🟡→🟢
`src/components/clients/AddClientDialog.tsx`
- Happy path now calls the **production** `create_client_and_matter` RPC (SECURITY INVOKER,
  RLS-enforced) instead of `debug_create_client_and_matter`.
- Removed the **"Run RLS Test (debug)"** button, the `runRlsTest()` `test_matters_insert_rls`
  call, and all `console.log` debug output.
- Raw `whoami` JSON + technical error panels are now **`import.meta.env.DEV`-only**. Production
  still shows the plain "Not authenticated" gate and friendly failure messages.

### M3 — CORS review 🟡 (partial)
Tightened the high-risk service-role / diagnostic functions (`creditGuardianApi`,
`project-stats`, `run-probe`) to the origin allow-list. The remaining JWT-gated functions
still send `*`; lower risk (require a valid JWT) — recommended follow-up, not launch-blocking.

### M4 — `run-probe` locked 🟡→🟢
`supabase/functions/run-probe/index.ts`
- Returns **404** unless `ENABLE_DEBUG_PROBES === "true"` (disabled for prod). Diagnostic
  RLS/claims dump no longer reachable at launch. CORS tightened; removed the dead duplicate
  `SUPABASE_ANON_KEY` fallback.

### M5 — `.env` hygiene 🟡→🟢
Already untracked on `main` (commit `be56e45`); `.gitignore` covers `.env` / `.env.*` with
`!.env.example`. No action needed. Added `VITE_ALLOW_PUBLIC_SIGNUP` to `.env.example`.

---

## ⚠️ For Fendi / cross-lane (NOT done in this PR — by request)

1. **Do NOT-done: rotate `CREDIT_GUARDIAN_KEY`** — left intentionally (code-red). Rotate in
   Lovable secrets before launch and update Lane A (Continuum OS) in lockstep.
2. **Set edge secrets in Lovable:**
   - `CREDIT_GUARDIAN_ALLOWED_ORIGINS` = comma-separated Continuum OS origin(s) + any browser
     origin that legitimately calls `project-stats`. If empty, browsers get no CORS access
     (server-to-server still works).
   - Leave `ENABLE_DEBUG_PROBES` **unset** in prod (keeps `run-probe` disabled).
   - `VITE_ALLOW_PUBLIC_SIGNUP` unset/"false" in prod.
3. **Supabase Auth settings (dashboard — not code):** disable "Allow new users to sign up"
   (H1 defense at the API layer), and confirm email-verification enforcement (L3).
4. **B1 auth escalation** (per-client authz / signed tokens / JWT verify) needs Lane A
   coordination — deferred to avoid breaking the OS bridge before Monday.
5. **Redeploy all edited edge functions via Lovable MCP** after merge, and **apply the new
   storage migration**. Then verify the three buckets are **Private** in the dashboard (B3).
6. **Do NOT disable Auth email settings remotely** — noted for Fendi.
