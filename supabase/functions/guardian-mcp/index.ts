/**
 * MCP endpoint for Cursor, Claude, and Grok.
 *
 * verify_jwt is false in config.toml ON PURPOSE. Agent secrets are not
 * Supabase JWTs; the platform JWT check would reject every legitimate call.
 * This handler rejects a missing secret, any session JWT, and CREDIT_GUARDIAN_KEY.
 */
import { handleGuardianMcpRequest, timingSafeEqual } from "../_shared/guardianMcp.ts";
import { createGuardianMcpStore, serviceClient } from "../_shared/guardianMcpSupabase.ts";

function corsHeadersFor(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = (Deno.env.get("CREDIT_GUARDIAN_ALLOWED_ORIGINS") ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type, accept, mcp-protocol-version",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

Deno.serve((req) => {
  const legacyKey = Deno.env.get("CREDIT_GUARDIAN_KEY") ?? "";
  return handleGuardianMcpRequest(req, {
    store: createGuardianMcpStore(serviceClient()),
    corsHeaders: corsHeadersFor(req),
    isForbiddenSecret: (token) => legacyKey.length > 0 && timingSafeEqual(token, legacyKey),
  });
});
