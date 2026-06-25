# Handoff — CreditFlow / Credit Guardian Analyzer: `analyze-bureau-response` Edge Function failing

**For:** Claude Code (working in the CreditFlow repo + Supabase project)
**App:** CreditFlow · "Credit File Operator Console" (Lovable) — https://fairway-fixer-18.lovable.app/
**Supabase project ref:** `gflvvzkiuleeochqcdeb`
**Broken feature:** Client detail → **Import & letters** tab → **Response Analyzer** → **"Generate draft letter"** button. It produces no draft; the backend call fails.

---

## What works vs. what's broken
- ✅ **File upload + text extraction works.** Uploading a bureau PDF populates the "Bureau response text" box with correctly extracted text. Source dropdown (Experian/TransUnion/Equifax) works.
- ❌ **"Generate draft letter" fails.** It calls the Edge Function below, which never returns a draft.

## The failing call
```
https://gflvvzkiuleeochqcdeb.supabase.co/functions/v1/analyze-bureau-response
```

## Observed progression (live network captures from the browser)
1. **Initial state:** `OPTIONS .../analyze-bureau-response → 404`. UI toast: *"Failed to send a request to the Edge Function."* → Function was **not deployed**.
2. **After first deploy:** `POST .../analyze-bureau-response → 503 Service Unavailable`. Function was reachable but **crashing/timing out at runtime**. (Owner believes this was a **timeout**, not a missing API key.)
3. **After the "timeout fix" changes:** back to `OPTIONS .../analyze-bureau-response → 404`, consistently across multiple attempts. The **CORS preflight now 404s, which blocks the POST from ever firing** — the latest changes knocked the function offline rather than fixing it.

**Net:** the function is currently **unreachable** (OPTIONS → 404). It regressed from the "deployed-but-503" state.

---

## Most likely causes — investigate in this order
1. **Deploy failed / function not live.** A 404 on *every* method (including OPTIONS) at a function slug means there's no live function there. Confirm `analyze-bureau-response` is actually deployed and healthy:
   - `supabase functions list` (is it present?)
   - Check the **deploy output** of the latest change for a build/syntax error that aborted the deploy.
   - Redeploy: `supabase functions deploy analyze-bureau-response`
2. **CORS / OPTIONS handler.** Ensure the function short-circuits the preflight and returns CORS headers, e.g.:
   ```ts
   const corsHeaders = {
     "Access-Control-Allow-Origin": "*",
     "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
     "Access-Control-Allow-Methods": "POST, OPTIONS",
   };
   if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
   // ...and include corsHeaders on the real 200 + on any error responses too
   ```
   Missing/incorrect CORS handling will surface exactly as an OPTIONS 404/blocked preflight.
3. **Runtime timeout (the earlier 503).** Once it's reachable again, the original 503 needs handling. Edge Functions have an execution-time limit; a slow LLM call can 503. Options: trim the prompt / cap `max_tokens`, stream the response, or move the heavy call off the request path. Wrap the whole handler in try/catch and **return a JSON error with `corsHeaders`** (never let it throw bare — that yields opaque 5xx).
4. **Secrets sanity check.** Owner says it isn't the API key, but verify the function's required env (`supabase secrets list`) so a missing/renamed var isn't a second failure mode after the deploy is fixed.
5. **Slug match.** Confirm the function directory name and `serve` route exactly match the slug the frontend calls: `analyze-bureau-response`.

---

## Definition of done (how to verify)
- `OPTIONS .../functions/v1/analyze-bureau-response` → **200/204** with `Access-Control-Allow-Origin` header.
- `POST .../functions/v1/analyze-bureau-response` with a sample payload (source + bureau response text + client id) → **200** with the drafted-letter JSON, within the function's time limit.
- In the UI: uploading a report and clicking **Generate draft letter** renders a draft letter (currently nothing renders).

## Context for the function's job
The function should take the **bureau source** (Experian/TransUnion/Equifax), the **extracted bureau-response text**, and the **client's existing timeline evidence** for that source, and return a **drafted dispute/follow-up letter** for operator review. (Client used for testing: Jamal Theodore Harris, id `5ef6735a-48fc-4630-ad5c-af7c42152214`.)

---
*Once the function returns 200, the operator (Claude/Cowork) will run all three of Jamal's reports through it and review the output. No code change to the frontend appears necessary — extraction already works; the fix is server-side on this one Edge Function.*
