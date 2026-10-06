/**
 * Service-role adapter for the Guardian MCP tables.
 * The service-role key stays in this process. Tool results are field-picked
 * again in guardianMcp.ts before they are returned.
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";
import {
  CLIENT_LIST_FIELDS,
  CLIENT_SUMMARY_FIELDS,
  DEADLINE_FIELDS,
  LETTER_FIELDS,
  TASK_FIELDS,
  TIMELINE_FIELDS,
  type AuditInsert,
  type AuditPublic,
  type EnrollStore,
  type EnrolledAgentPublic,
  type GuardianMcpStore,
  type LetterDraftInsert,
  type McpAgentRecord,
  type TimelineInsert,
} from "./guardianMcp.ts";

function columns(fields: readonly string[]): string {
  return fields.join(", ");
}

const AGENT_PUBLIC = "id, name, scopes, expires_at, revoked_at, created_at, created_by";

function dbFail(error: { message?: string; code?: string } | null): { error: string } {
  console.error("guardian-mcp db", error?.code ?? "", error?.message ?? "");
  const code = error?.code ?? "";
  if (code === "PGRST116") return { error: "not found" };
  if (code === "23503") return { error: "client not found" };
  if (code === "23514" || code === "22P02" || code === "23502") return { error: "invalid value" };
  return { error: "request failed" };
}

export function serviceClient(): SupabaseClient {
  return createClient(Deno.env.get("SUPABASE_URL") ?? "", Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asAgent(row: Record<string, unknown>): EnrolledAgentPublic {
  return {
    id: String(row.id),
    name: String(row.name),
    scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
    expires_at: String(row.expires_at),
    revoked_at: row.revoked_at == null ? null : String(row.revoked_at),
    created_at: String(row.created_at),
    created_by: row.created_by == null ? null : String(row.created_by),
  };
}

export function createGuardianMcpStore(supabase: SupabaseClient): GuardianMcpStore {
  return {
    async findAgentByHash(secretHash) {
      const { data, error } = await supabase
        .from("mcp_agents")
        .select("id, name, secret_hash, scopes, expires_at, revoked_at")
        .eq("secret_hash", secretHash)
        .maybeSingle();
      if (error) throw new Error("agent lookup failed");
      if (!data) return null;
      const row = asRecord(data);
      return {
        id: String(row.id),
        name: String(row.name),
        secretHash: String(row.secret_hash),
        scopes: Array.isArray(row.scopes) ? row.scopes.map(String) : [],
        expiresAt: String(row.expires_at),
        revokedAt: row.revoked_at == null ? null : String(row.revoked_at),
      } satisfies McpAgentRecord;
    },

    async insertAudit(row: AuditInsert) {
      const { data, error } = await supabase
        .from("mcp_audit_log")
        .insert({
          agent_id: row.agentId,
          tool: row.tool,
          client_id: row.clientId,
          success: row.success,
          error: row.error,
        })
        .select("id")
        .single();
      if (error || !data) return dbFail(error);
      return { id: String(asRecord(data).id) };
    },

    async finishAudit(id, success, errorText) {
      const { error } = await supabase
        .from("mcp_audit_log")
        .update({ success, error: errorText })
        .eq("id", id);
      if (error) throw new Error("audit finish failed");
    },

    async listClients(limit) {
      const { data, error } = await supabase
        .from("clients")
        .select(columns(CLIENT_LIST_FIELDS))
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return dbFail(error);
      return { data: (data ?? []).map((row) => asRecord(row)) };
    },

    async getClientSummary(clientId) {
      const [client, openTasks, draft, finalCount, mailed] = await Promise.all([
        supabase.from("clients").select(columns(CLIENT_SUMMARY_FIELDS)).eq("id", clientId).maybeSingle(),
        supabase
          .from("operator_tasks")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("status", "Open"),
        supabase
          .from("dispute_letters")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("status", "draft"),
        supabase
          .from("dispute_letters")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("status", "final"),
        supabase
          .from("dispute_letters")
          .select("id", { count: "exact", head: true })
          .eq("client_id", clientId)
          .eq("status", "mailed"),
      ]);
      if (client.error) return dbFail(client.error);
      if (!client.data) return { notFound: true };
      if (openTasks.error || draft.error || finalCount.error || mailed.error) {
        return { error: "request failed" };
      }
      return {
        data: {
          client: asRecord(client.data),
          open_task_count: openTasks.count ?? 0,
          letters: {
            draft: draft.count ?? 0,
            final: finalCount.count ?? 0,
            mailed: mailed.count ?? 0,
          },
        },
      };
    },

    async listTimeline(clientId) {
      const { data, error } = await supabase
        .from("timeline_events")
        .select(columns(TIMELINE_FIELDS))
        .eq("client_id", clientId)
        .order("event_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return dbFail(error);
      return { data: (data ?? []).map((row) => asRecord(row)) };
    },

    async listLetters(clientId) {
      const { data, error } = await supabase
        .from("dispute_letters")
        .select(columns(LETTER_FIELDS))
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return dbFail(error);
      return { data: (data ?? []).map((row) => asRecord(row)) };
    },

    async listTasks(clientId) {
      const { data, error } = await supabase
        .from("operator_tasks")
        .select(columns(TASK_FIELDS))
        .eq("client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) return dbFail(error);
      return { data: (data ?? []).map((row) => asRecord(row)) };
    },

    async listDeadlines(clientId) {
      const { data, error } = await supabase
        .from("deadlines")
        .select(`${columns(DEADLINE_FIELDS)}, matters!inner(client_id)`)
        .eq("matters.client_id", clientId)
        .order("due_date", { ascending: true })
        .limit(200);
      if (error) return dbFail(error);
      return { data: (data ?? []).map((row) => asRecord(row)) };
    },

    async clientExists(clientId) {
      const { data, error } = await supabase.from("clients").select("id").eq("id", clientId).maybeSingle();
      if (error) return dbFail(error);
      return { exists: !!data };
    },

    async updateClient(clientId, fields) {
      const { data, error } = await supabase
        .from("clients")
        .update(fields)
        .eq("id", clientId)
        .select(`${columns(CLIENT_LIST_FIELDS)}, notes`)
        .maybeSingle();
      if (error) return dbFail(error);
      if (!data) return { notFound: true };
      return { data: asRecord(data) };
    },

    async addTimelineEvent(row: TimelineInsert) {
      const { data, error } = await supabase
        .from("timeline_events")
        .insert(row)
        .select(columns(TIMELINE_FIELDS))
        .single();
      if (error || !data) return dbFail(error);
      return { data: asRecord(data) };
    },

    async saveLetterDraft(row: LetterDraftInsert) {
      const { data, error } = await supabase
        .from("dispute_letters")
        .insert({
          client_id: row.client_id,
          recipient_type: row.recipient_type,
          recipient_name: row.recipient_name,
          letter_type: row.letter_type,
          body_md: row.body_md,
          status: "draft",
        })
        .select(columns(LETTER_FIELDS))
        .single();
      if (error || !data) return dbFail(error);
      return { data: asRecord(data) };
    },

    async getLetter(clientId, letterId) {
      const { data, error } = await supabase
        .from("dispute_letters")
        .select("id, status, client_id")
        .eq("id", letterId)
        .eq("client_id", clientId)
        .maybeSingle();
      if (error) return dbFail(error);
      if (!data) return { notFound: true };
      const row = asRecord(data);
      return { data: { id: String(row.id), status: String(row.status), client_id: String(row.client_id) } };
    },

    async finalizeLetter(clientId, letterId) {
      const { data, error } = await supabase
        .from("dispute_letters")
        .update({ status: "final" })
        .eq("id", letterId)
        .eq("client_id", clientId)
        .eq("status", "draft")
        .select("id, client_id, status")
        .maybeSingle();
      if (error) return dbFail(error);
      if (!data) return { notFound: true };
      return { data: asRecord(data) };
    },

    async completeTask(clientId, taskId) {
      const { data, error } = await supabase
        .from("operator_tasks")
        .update({ status: "Done" })
        .eq("id", taskId)
        .eq("client_id", clientId)
        .select("id, client_id, status")
        .maybeSingle();
      if (error) return dbFail(error);
      if (!data) return { notFound: true };
      return { data: asRecord(data) };
    },
  };
}

export function createEnrollStore(supabase: SupabaseClient): EnrollStore {
  return {
    async insertAgent(row) {
      const { data, error } = await supabase
        .from("mcp_agents")
        .insert({
          name: row.name,
          secret_hash: row.secret_hash,
          scopes: row.scopes,
          expires_at: row.expires_at,
          created_by: row.created_by,
        })
        .select(AGENT_PUBLIC)
        .single();
      if (error || !data) return dbFail(error);
      return { agent: asAgent(asRecord(data)) };
    },

    async listAgents() {
      const { data, error } = await supabase
        .from("mcp_agents")
        .select(AGENT_PUBLIC)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) return dbFail(error);
      return { agents: (data ?? []).map((row) => asAgent(asRecord(row))) };
    },

    async revokeAgent(id) {
      const { data, error } = await supabase
        .from("mcp_agents")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", id)
        .select(AGENT_PUBLIC)
        .maybeSingle();
      if (error) return dbFail(error);
      if (!data) return { notFound: true };
      return { data: asAgent(asRecord(data)) };
    },

    async listAudit(limit) {
      const { data, error } = await supabase
        .from("mcp_audit_log")
        .select("id, agent_id, tool, client_id, success, error, created_at, mcp_agents(name)")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) return dbFail(error);
      const rows: AuditPublic[] = (data ?? []).map((item) => {
        const row = asRecord(item);
        const related = row.mcp_agents;
        let agentName: string | null = null;
        if (Array.isArray(related)) {
          const first = asRecord(related[0]);
          agentName = typeof first.name === "string" ? first.name : null;
        } else if (related && typeof related === "object") {
          const name = asRecord(related).name;
          agentName = typeof name === "string" ? name : null;
        }
        return {
          id: String(row.id),
          agent_id: String(row.agent_id),
          agent_name: agentName,
          tool: String(row.tool),
          client_id: row.client_id == null ? null : String(row.client_id),
          success: row.success === true,
          error: row.error == null ? null : String(row.error),
          created_at: String(row.created_at),
        };
      });
      return { rows };
    },
  };
}
