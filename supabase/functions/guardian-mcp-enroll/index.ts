/**
 * Staff enrollment for Guardian MCP agents.
 * verify_jwt is true. A valid session is not enough: the caller must be
 * admin or staff. Agent secrets and customer sessions cannot enroll.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import { bearerToken, handleGuardianMcpEnrollRequest } from "../_shared/guardianMcp.ts";
import { createEnrollStore, serviceClient } from "../_shared/guardianMcpSupabase.ts";

const STAFF_ROLES = ["admin", "staff"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve((req) =>
  handleGuardianMcpEnrollRequest(req, {
    store: createEnrollStore(serviceClient()),
    corsHeaders,
    authorize: async (request) => {
      const token = bearerToken(request);
      if (!token) return { ok: false, status: 401, error: "Unauthorized: staff session required" };

      const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: userData, error: userErr } = await authClient.auth.getUser();
      if (userErr || !userData?.user) {
        return { ok: false, status: 401, error: "Unauthorized: invalid session" };
      }

      const admin = serviceClient();
      const { data: roleRows, error: roleErr } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userData.user.id);
      if (roleErr) return { ok: false, status: 500, error: "Authorization check failed" };

      const roles = (roleRows ?? []).map((row: { role: string }) => row.role);
      if (!roles.some((role) => STAFF_ROLES.includes(role))) {
        return { ok: false, status: 403, error: "Forbidden: staff or admin role required" };
      }
      return { ok: true, userId: userData.user.id };
    },
  })
);
