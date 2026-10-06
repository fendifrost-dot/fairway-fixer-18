/**
 * Credit Guardian MCP (phase 1).
 *
 * Agent calls authenticate with Authorization: Bearer <agent secret>.
 * The secret is stored only as a SHA-256 hash. A Supabase session JWT
 * (staff, customer, or the Capital-site subscription) is rejected.
 * CREDIT_GUARDIAN_KEY is rejected here; it stays the Control Center key.
 *
 * File reads and writes insert an mcp_audit_log row first. If that insert
 * fails, the read or write does not run.
 */

export const SERVER_NAME = "credit-guardian";
export const SERVER_VERSION = "1.0.0";

export const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export const READ_SCOPES = [
  "clients.list",
  "clients.read",
  "timeline.read",
  "letters.read",
  "tasks.read",
  "deadlines.read",
] as const;

export const WRITE_SCOPES = [
  "clients.update",
  "timeline.write",
  "letters.draft",
  "letters.finalize",
  "tasks.complete",
] as const;

export const ALL_SCOPES = [...READ_SCOPES, ...WRITE_SCOPES] as const;
export type McpScope = (typeof ALL_SCOPES)[number];

const SCOPE_SET = new Set<string>(ALL_SCOPES);

export const CLIENT_LIST_FIELDS = [
  "id",
  "legal_name",
  "preferred_name",
  "email",
  "phone",
  "status",
  "created_at",
  "updated_at",
] as const;

export const CLIENT_SUMMARY_FIELDS = [
  ...CLIENT_LIST_FIELDS,
  "legal_full_name",
  "notes",
  "campaign_label",
  "ftc_identity_theft_report_number",
] as const;

export const CLIENT_UPDATE_FIELDS = [
  "legal_name",
  "preferred_name",
  "email",
  "phone",
  "status",
  "notes",
] as const;

export const TIMELINE_FIELDS = [
  "id",
  "client_id",
  "event_date",
  "date_is_unknown",
  "category",
  "source",
  "title",
  "summary",
  "details",
  "raw_line",
  "event_kind",
  "is_draft",
  "created_at",
] as const;

export const LETTER_FIELDS = [
  "id",
  "client_id",
  "recipient_type",
  "recipient_name",
  "letter_type",
  "body_md",
  "status",
  "created_at",
  "updated_at",
] as const;

export const TASK_FIELDS = [
  "id",
  "client_id",
  "title",
  "due_date",
  "due_time",
  "priority",
  "status",
  "notes",
  "created_at",
] as const;

export const DEADLINE_FIELDS = [
  "id",
  "matter_id",
  "deadline_type",
  "start_date",
  "due_date",
  "status",
] as const;

export const EVENT_SOURCES = [
  "Experian",
  "TransUnion",
  "Equifax",
  "Innovis",
  "LexisNexis",
  "Sagestream",
  "CoreLogic",
  "ChexSystems",
  "EWS",
  "NCTUE",
  "CFPB",
  "BBB",
  "AG",
  "FTC",
  "Creditor",
  "Other",
] as const;

const EVENT_CATEGORIES = ["Action", "Response", "Outcome", "Note"] as const;
const EVENT_KINDS = ["action", "response", "outcome", "note"] as const;
const CLIENT_STATUSES = ["Active", "Inactive", "Pending"] as const;
const RECIPIENT_TYPES = ["cra", "furnisher", "collector", "regulator"] as const;

/** High-risk names from the phase 1 plan. They are not tools. */
export const BLOCKED_TOOLS = [
  "delete_client",
  "delete_clients",
  "send_mail",
  "send_letter",
  "export_all",
  "export_clients",
  "run_sql",
  "query_sql",
  "raw_sql",
] as const;

const BLOCKED_TOOL_SET = new Set<string>(BLOCKED_TOOLS);

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const AGENT_NAME_RE = /^[a-z][a-z0-9_-]{0,31}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SECRET_RE =
  /cgma_[A-Za-z0-9_-]+|CREDIT_GUARDIAN_KEY|SUPABASE_SERVICE_ROLE_KEY|service_role|sk_(?:live|test)_[A-Za-z0-9]+|rk_(?:live|test)_[A-Za-z0-9]+|pm_[A-Za-z0-9]+|eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const MAX_EXPIRY_MS = 366 * 24 * 60 * 60 * 1000;
const LIST_DEFAULT = 50;
const LIST_MAX = 200;

export interface McpAgentRecord {
  id: string;
  name: string;
  secretHash: string;
  scopes: string[];
  expiresAt: string;
  revokedAt: string | null;
}

export interface AuditInsert {
  agentId: string;
  tool: string;
  clientId: string | null;
  success: boolean;
  error: string | null;
}

export interface AuditFinish {
  id: string;
  success: boolean;
  error: string | null;
}

export type StoreResult<T> = { data: T } | { error: string } | { notFound: true };

export interface ClientSummaryPayload {
  client: Record<string, unknown>;
  open_task_count: number;
  letters: { draft: number; final: number; mailed: number };
}

export interface TimelineInsert {
  client_id: string;
  event_date: string | null;
  date_is_unknown: boolean;
  category: string;
  source: string | null;
  title: string;
  summary: string;
  details: string | null;
  raw_line: string;
  event_kind: string;
  is_draft: false;
}

export interface LetterDraftInsert {
  client_id: string;
  recipient_type: string;
  recipient_name: string;
  letter_type: string;
  body_md: string;
  status: "draft";
}

export interface GuardianMcpStore {
  findAgentByHash(secretHash: string): Promise<McpAgentRecord | null>;
  insertAudit(row: AuditInsert): Promise<{ id: string } | { error: string }>;
  finishAudit(id: string, success: boolean, error: string | null): Promise<void>;
  listClients(limit: number): Promise<{ data: Record<string, unknown>[] } | { error: string }>;
  getClientSummary(clientId: string): Promise<StoreResult<ClientSummaryPayload>>;
  listTimeline(clientId: string): Promise<{ data: Record<string, unknown>[] } | { error: string }>;
  listLetters(clientId: string): Promise<{ data: Record<string, unknown>[] } | { error: string }>;
  listTasks(clientId: string): Promise<{ data: Record<string, unknown>[] } | { error: string }>;
  listDeadlines(clientId: string): Promise<{ data: Record<string, unknown>[] } | { error: string }>;
  clientExists(clientId: string): Promise<{ exists: boolean } | { error: string }>;
  updateClient(
    clientId: string,
    fields: Record<string, unknown>,
  ): Promise<StoreResult<Record<string, unknown>>>;
  addTimelineEvent(row: TimelineInsert): Promise<StoreResult<Record<string, unknown>>>;
  saveLetterDraft(row: LetterDraftInsert): Promise<StoreResult<Record<string, unknown>>>;
  getLetter(
    clientId: string,
    letterId: string,
  ): Promise<StoreResult<{ id: string; status: string; client_id: string }>>;
  finalizeLetter(clientId: string, letterId: string): Promise<StoreResult<Record<string, unknown>>>;
  completeTask(clientId: string, taskId: string): Promise<StoreResult<Record<string, unknown>>>;
}

export interface EnrolledAgentPublic {
  id: string;
  name: string;
  scopes: string[];
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AuditPublic {
  id: string;
  agent_id: string;
  agent_name: string | null;
  tool: string;
  client_id: string | null;
  success: boolean;
  error: string | null;
  created_at: string;
}

export interface EnrollStore {
  insertAgent(row: {
    name: string;
    secret_hash: string;
    scopes: string[];
    expires_at: string;
    created_by: string;
  }): Promise<{ agent: EnrolledAgentPublic } | { error: string }>;
  listAgents(): Promise<{ agents: EnrolledAgentPublic[] } | { error: string }>;
  revokeAgent(id: string): Promise<StoreResult<EnrolledAgentPublic>>;
  listAudit(limit: number): Promise<{ rows: AuditPublic[] } | { error: string }>;
}

export interface McpDeps {
  store: GuardianMcpStore;
  isForbiddenSecret?: (token: string) => boolean;
  now?: () => Date;
  corsHeaders?: Record<string, string>;
}

export interface EnrollDeps {
  store: EnrollStore;
  authorize: (req: Request) => Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }>;
  now?: () => Date;
  corsHeaders?: Record<string, string>;
}

interface ToolDef {
  name: string;
  scope: McpScope;
  description: string;
  inputSchema: Record<string, unknown>;
}

const uuidSchema = { type: "string", format: "uuid" };

const TOOLS: ToolDef[] = [
  {
    name: "list_clients",
    scope: "clients.list",
    description: "List Credit Guardian clients (name, contact, status). Does not include notes or payment data.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        limit: { type: "integer", minimum: 1, maximum: LIST_MAX },
      },
    },
  },
  {
    name: "get_client_summary",
    scope: "clients.read",
    description: "One client's summary: contact, status, staff notes, open tasks, and letter counts.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id"],
      properties: { client_id: uuidSchema },
    },
  },
  {
    name: "get_timeline",
    scope: "timeline.read",
    description: "Timeline events for one client, including the original raw_line.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id"],
      properties: { client_id: uuidSchema },
    },
  },
  {
    name: "get_letters",
    scope: "letters.read",
    description: "Dispute letters for one client, including drafts. Does not mail anything.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id"],
      properties: { client_id: uuidSchema },
    },
  },
  {
    name: "get_tasks",
    scope: "tasks.read",
    description: "Operator tasks for one client.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id"],
      properties: { client_id: uuidSchema },
    },
  },
  {
    name: "get_deadlines",
    scope: "deadlines.read",
    description: "Statutory deadlines for one client.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id"],
      properties: { client_id: uuidSchema },
    },
  },
  {
    name: "update_client",
    scope: "clients.update",
    description:
      "Update allow-listed client fields: legal_name, preferred_name, email, phone, status, notes.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id", "fields"],
      properties: {
        client_id: uuidSchema,
        fields: { type: "object" },
      },
    },
  },
  {
    name: "add_timeline_event",
    scope: "timeline.write",
    description:
      "Add one timeline event. raw_line is required and stored unchanged. Use date_is_unknown when the date is not reliable.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id", "raw_line"],
      properties: {
        client_id: uuidSchema,
        raw_line: { type: "string" },
        title: { type: "string" },
        summary: { type: "string" },
        category: { type: "string", enum: [...EVENT_CATEGORIES] },
        source: { type: "string", enum: [...EVENT_SOURCES] },
        event_date: { type: "string" },
        date_is_unknown: { type: "boolean" },
        details: { type: "string" },
        event_kind: { type: "string", enum: [...EVENT_KINDS] },
      },
    },
  },
  {
    name: "save_letter_draft",
    scope: "letters.draft",
    description: "Save a dispute letter as a draft. Cannot set status to final or mailed.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id", "recipient_type", "recipient_name", "letter_type", "body_md"],
      properties: {
        client_id: uuidSchema,
        recipient_type: { type: "string", enum: [...RECIPIENT_TYPES] },
        recipient_name: { type: "string" },
        letter_type: { type: "string" },
        body_md: { type: "string" },
      },
    },
  },
  {
    name: "finalize_letter",
    scope: "letters.finalize",
    description: "Move a draft letter to final. Refuses mailed letters and does not send mail.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id", "letter_id"],
      properties: { client_id: uuidSchema, letter_id: uuidSchema },
    },
  },
  {
    name: "complete_task",
    scope: "tasks.complete",
    description: "Mark one operator task Done for the given client.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      required: ["client_id", "task_id"],
      properties: { client_id: uuidSchema, task_id: uuidSchema },
    },
  },
];

const TOOL_BY_NAME = new Map(TOOLS.map((tool) => [tool.name, tool]));

export function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  let diff = ab.length ^ bb.length;
  const len = Math.max(ab.length, bb.length);
  for (let i = 0; i < len; i++) {
    diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  }
  return diff === 0;
}

export function looksLikeSessionToken(token: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  return parts.every((part) => part.length > 0 && /^[A-Za-z0-9_-]+$/.test(part));
}

export function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match ? match[1] : null;
}

export async function hashAgentSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function generateAgentSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const encoded = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  return `cgma_${encoded}`;
}

export function publicError(message: string): string {
  return message.replace(SECRET_RE, "[redacted]").replace(/\s+/g, " ").trim().slice(0, 300);
}

export function resolveScopes(input: unknown): { ok: true; scopes: McpScope[] } | { ok: false; error: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, error: "scopes must be a non-empty list" };
  }
  const chosen = new Set<string>();
  for (const entry of input) {
    if (typeof entry !== "string") return { ok: false, error: "scopes must be strings" };
    if (entry === "read") {
      READ_SCOPES.forEach((scope) => chosen.add(scope));
      continue;
    }
    if (entry === "write") {
      WRITE_SCOPES.forEach((scope) => chosen.add(scope));
      continue;
    }
    if (!SCOPE_SET.has(entry)) {
      return { ok: false, error: `unknown scope: ${entry}` };
    }
    chosen.add(entry);
  }
  const scopes = ALL_SCOPES.filter((scope) => chosen.has(scope));
  if (scopes.length === 0) return { ok: false, error: "scopes must be a non-empty list" };
  return { ok: true, scopes };
}

export function validateEnrollment(
  input: { name?: unknown; scopes?: unknown; expires_at?: unknown },
  now: Date,
): { ok: true; name: string; scopes: McpScope[]; expiresAt: string } | { ok: false; error: string } {
  if (typeof input.name !== "string") return { ok: false, error: "name is required" };
  const name = input.name.trim().toLowerCase();
  if (!AGENT_NAME_RE.test(name)) {
    return {
      ok: false,
      error: "name must be lowercase letters, digits, hyphens, or underscores, and start with a letter",
    };
  }
  const scopes = resolveScopes(input.scopes);
  if (scopes.ok !== true) return { ok: false, error: (scopes as { error: string }).error };
  if (typeof input.expires_at !== "string") return { ok: false, error: "expires_at is required" };
  const expiresMs = Date.parse(input.expires_at);
  if (!Number.isFinite(expiresMs)) return { ok: false, error: "expires_at must be a date" };
  if (expiresMs <= now.getTime()) return { ok: false, error: "expires_at must be in the future" };
  if (expiresMs > now.getTime() + MAX_EXPIRY_MS) {
    return { ok: false, error: "expires_at cannot be more than 366 days away" };
  }
  return {
    ok: true,
    name,
    scopes: (scopes as { scopes: McpScope[] }).scopes,
    expiresAt: new Date(expiresMs).toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function pick(row: Record<string, unknown>, fields: readonly string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of fields) out[field] = row[field] ?? null;
  return out;
}

function rpcId(msg: Record<string, unknown>): string | number | null {
  const id = msg.id;
  return typeof id === "string" || typeof id === "number" ? id : null;
}

function json(
  body: unknown,
  status: number,
  cors: Record<string, string>,
  extra?: Record<string, string>,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...cors,
      ...extra,
    },
  });
}

function authError(message: string, cors: Record<string, string>): Response {
  return json({ jsonrpc: "2.0", id: null, error: { code: -32001, message } }, 401, cors);
}

function wantsSse(req: Request): boolean {
  const accept = req.headers.get("accept") ?? "";
  if (!accept) return false;
  if (accept.includes("application/json") || accept.includes("*/*")) return false;
  return accept.includes("text/event-stream");
}

function rpcResponse(
  req: Request,
  id: string | number | null,
  payload: { result?: unknown; error?: { code: number; message: string } },
  cors: Record<string, string>,
  protocol: string,
): Response {
  const body = { jsonrpc: "2.0", id, ...payload };
  const extra = { "MCP-Protocol-Version": protocol };
  if (!wantsSse(req)) return json(body, payload.error ? 200 : 200, cors, extra);
  const sse = `event: message\ndata: ${JSON.stringify(body)}\n\n`;
  return new Response(sse, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      ...cors,
      ...extra,
    },
  });
}

function toolResult(isError: boolean, value: unknown): Record<string, unknown> {
  return {
    content: [{ type: "text", text: JSON.stringify(value) }],
    isError,
  };
}

function unknownField(args: Record<string, unknown>, allowed: readonly string[]): string | null {
  for (const key of Object.keys(args)) {
    if (!allowed.includes(key)) return key;
  }
  return null;
}

function requireUuid(value: unknown, field: string): string | { error: string } {
  if (typeof value !== "string" || !UUID_RE.test(value)) return { error: `${field} must be a uuid` };
  return value;
}

function optionalBoundedString(
  value: unknown,
  field: string,
  max: number,
): string | null | { error: string } {
  if (value == null) return null;
  if (typeof value !== "string") return { error: `${field} must be text` };
  if (value.length > max) return { error: `${field} is too long` };
  return value;
}

function clientIdOf(args: Record<string, unknown>): string | null {
  const id = args.client_id;
  return typeof id === "string" && UUID_RE.test(id) ? id : null;
}

async function requireClient(
  store: GuardianMcpStore,
  clientId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const found = await store.clientExists(clientId);
  if ("error" in found) return { ok: false, error: found.error };
  if (!found.exists) return { ok: false, error: "client not found" };
  return { ok: true };
}

async function withAudit(
  store: GuardianMcpStore,
  row: AuditInsert,
  run: () => Promise<{ ok: true; value: unknown } | { ok: false; error: string }>,
): Promise<{ isError: boolean; value: unknown }> {
  const inserted = await store.insertAudit({
    ...row,
    error: publicError(row.error ?? "pending"),
    success: false,
  });
  if ("error" in inserted) {
    return {
      isError: true,
      value: { error: "Audit log did not record this call, so it was refused." },
    };
  }
  let outcome: { ok: true; value: unknown } | { ok: false; error: string };
  try {
    outcome = await run();
  } catch (err) {
    console.error("guardian-mcp tool failed", err instanceof Error ? err.name : "error");
    outcome = { ok: false, error: "request failed" };
  }
  const failed = outcome.ok !== true;
  const error = failed ? publicError((outcome as { error: string }).error) : null;
  try {
    await store.finishAudit(inserted.id, !failed, error);
  } catch (err) {
    console.error("guardian-mcp audit finish failed", err instanceof Error ? err.name : "error");
  }
  if (failed) return { isError: true, value: { error } };
  return { isError: false, value: (outcome as { value: unknown }).value };
}

function parseLimit(value: unknown): number | { error: string } {
  if (value == null) return LIST_DEFAULT;
  if (typeof value !== "number" || !Number.isInteger(value)) return { error: "limit must be an integer" };
  if (value < 1 || value > LIST_MAX) return { error: `limit must be from 1 to ${LIST_MAX}` };
  return value;
}

async function executeTool(
  store: GuardianMcpStore,
  name: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  if (name === "list_clients") {
    const extra = unknownField(args, ["limit"]);
    if (extra) return { ok: false, error: `unknown field: ${extra}` };
    const limit = parseLimit(args.limit);
    if (typeof limit !== "number") return { ok: false, error: limit.error };
    const listed = await store.listClients(limit);
    if ("error" in listed) return { ok: false, error: listed.error };
    return {
      ok: true,
      value: { clients: listed.data.slice(0, limit).map((row) => pick(row, CLIENT_LIST_FIELDS)) },
    };
  }

  const clientUuid = requireUuid(args.client_id, "client_id");
  if (typeof clientUuid !== "string") return { ok: false, error: clientUuid.error };
  const client = await requireClient(store, clientUuid);
  if (client.ok !== true) return { ok: false, error: (client as { error: string }).error };

  if (name === "get_client_summary") {
    const extra = unknownField(args, ["client_id"]);
    if (extra) return { ok: false, error: `unknown field: ${extra}` };
    const summary = await store.getClientSummary(clientUuid);
    if ("error" in summary) return { ok: false, error: summary.error };
    if ("notFound" in summary) return { ok: false, error: "client not found" };
    return {
      ok: true,
      value: {
        client: pick(summary.data.client, CLIENT_SUMMARY_FIELDS),
        open_task_count: summary.data.open_task_count,
        letters: {
          draft: summary.data.letters.draft,
          final: summary.data.letters.final,
          mailed: summary.data.letters.mailed,
        },
      },
    };
  }

  if (name === "get_timeline" || name === "get_letters" || name === "get_tasks" || name === "get_deadlines") {
    const extra = unknownField(args, ["client_id"]);
    if (extra) return { ok: false, error: `unknown field: ${extra}` };
    const loaded =
      name === "get_timeline"
        ? await store.listTimeline(clientUuid)
        : name === "get_letters"
          ? await store.listLetters(clientUuid)
          : name === "get_tasks"
            ? await store.listTasks(clientUuid)
            : await store.listDeadlines(clientUuid);
    if ("error" in loaded) return { ok: false, error: loaded.error };
    const fields =
      name === "get_timeline"
        ? TIMELINE_FIELDS
        : name === "get_letters"
          ? LETTER_FIELDS
          : name === "get_tasks"
            ? TASK_FIELDS
            : DEADLINE_FIELDS;
    const key =
      name === "get_timeline" ? "events" : name === "get_letters" ? "letters" : name === "get_tasks" ? "tasks" : "deadlines";
    return { ok: true, value: { [key]: loaded.data.slice(0, LIST_MAX).map((row) => pick(row, fields)) } };
  }

  if (name === "update_client") {
    const extra = unknownField(args, ["client_id", "fields"]);
    if (extra) return { ok: false, error: `unknown field: ${extra}` };
    if (!isRecord(args.fields)) return { ok: false, error: "fields must be an object" };
    const fieldKeys = Object.keys(args.fields);
    if (fieldKeys.length === 0) return { ok: false, error: "fields must include at least one allow-listed field" };
    const unexpected = fieldKeys.find((key) => !(CLIENT_UPDATE_FIELDS as readonly string[]).includes(key));
    if (unexpected) return { ok: false, error: `field is not allow-listed: ${unexpected}` };
    const safe: Record<string, unknown> = {};
    for (const key of fieldKeys) {
      const value = args.fields[key];
      if (key === "legal_name") {
        if (typeof value !== "string" || value.trim() === "" || value.length > 300) {
          return { ok: false, error: "legal_name must be non-empty text" };
        }
        safe.legal_name = value;
      } else if (key === "status") {
        if (typeof value !== "string" || !(CLIENT_STATUSES as readonly string[]).includes(value)) {
          return { ok: false, error: "status must be Active, Inactive, or Pending" };
        }
        safe.status = value;
      } else if (key === "email" || key === "phone" || key === "preferred_name" || key === "notes") {
        const max = key === "notes" ? 20000 : key === "email" ? 320 : key === "phone" ? 40 : 300;
        const parsed = optionalBoundedString(value, key, max);
        if (parsed && typeof parsed === "object") return { ok: false, error: parsed.error };
        if (typeof parsed === "string" && parsed.trim() === "") {
          safe[key] = null;
          continue;
        }
        if (typeof parsed === "string" && (parsed.includes("\n") || parsed.includes("\r")) && key !== "notes") {
          return { ok: false, error: `${key} must be a single line` };
        }
        safe[key] = parsed;
      }
    }
    const updated = await store.updateClient(clientUuid, safe);
    if ("error" in updated) return { ok: false, error: updated.error };
    if ("notFound" in updated) return { ok: false, error: "client not found" };
    return { ok: true, value: { client: pick(updated.data, [...CLIENT_LIST_FIELDS, "notes"]) } };
  }

  if (name === "add_timeline_event") {
    const allowed = [
      "client_id",
      "raw_line",
      "title",
      "summary",
      "category",
      "source",
      "event_date",
      "date_is_unknown",
      "details",
      "event_kind",
    ];
    const extra = unknownField(args, allowed);
    if (extra) return { ok: false, error: `unknown field: ${extra}` };
    if (typeof args.raw_line !== "string" || args.raw_line.trim() === "") {
      return { ok: false, error: "raw_line is required" };
    }
    if (args.raw_line.length > 100000) return { ok: false, error: "raw_line is too long" };
    const rawLine = args.raw_line;

    let title: string;
    if (args.title == null) {
      const line = rawLine.split("\n")[0]?.trim() || "Timeline note";
      title = line.length > 120 ? `${line.slice(0, 117)}...` : line;
    } else if (typeof args.title !== "string" || args.title.trim() === "" || args.title.length > 300) {
      return { ok: false, error: "title must be non-empty text" };
    } else {
      title = args.title;
    }

    let summary: string;
    if (args.summary == null) {
      const trimmed = rawLine.trim();
      summary = trimmed.length > 2000 ? trimmed.slice(0, 2000) : trimmed;
    } else if (typeof args.summary !== "string" || args.summary.trim() === "" || args.summary.length > 8000) {
      return { ok: false, error: "summary must be non-empty text" };
    } else {
      summary = args.summary;
    }

    let category = "Note";
    if (args.category != null) {
      if (typeof args.category !== "string" || !(EVENT_CATEGORIES as readonly string[]).includes(args.category)) {
        return { ok: false, error: "category must be Action, Response, Outcome, or Note" };
      }
      category = args.category;
    }

    let eventKind = "note";
    if (args.event_kind != null) {
      if (typeof args.event_kind !== "string" || !(EVENT_KINDS as readonly string[]).includes(args.event_kind)) {
        return { ok: false, error: "event_kind must be action, response, outcome, or note" };
      }
      eventKind = args.event_kind;
    }

    let source: string | null = null;
    if (args.source != null) {
      if (typeof args.source !== "string" || !(EVENT_SOURCES as readonly string[]).includes(args.source)) {
        return { ok: false, error: "source is not a recognized bureau or furnisher" };
      }
      source = args.source;
    }

    let eventDate: string | null = null;
    if (args.event_date != null) {
      if (typeof args.event_date !== "string" || !DATE_RE.test(args.event_date)) {
        return { ok: false, error: "event_date must be YYYY-MM-DD" };
      }
      const [year, month, day] = args.event_date.split("-").map(Number);
      const utc = new Date(Date.UTC(year, month - 1, day));
      if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
        return { ok: false, error: "event_date must be YYYY-MM-DD" };
      }
      eventDate = args.event_date;
    }

    let dateIsUnknown = eventDate == null;
    if (args.date_is_unknown != null) {
      if (typeof args.date_is_unknown !== "boolean") return { ok: false, error: "date_is_unknown must be true or false" };
      dateIsUnknown = args.date_is_unknown;
    }

    const detailsResult = optionalBoundedString(args.details, "details", 8000);
    if (detailsResult && typeof detailsResult === "object") {
      return { ok: false, error: detailsResult.error };
    }
    const details: string | null = typeof detailsResult === "string" ? detailsResult : null;

    const inserted = await store.addTimelineEvent({
      client_id: clientUuid,
      event_date: eventDate,
      date_is_unknown: dateIsUnknown,
      category,
      source,
      title,
      summary,
      details,
      raw_line: rawLine,
      event_kind: eventKind,
      is_draft: false,
    });
    if ("error" in inserted) return { ok: false, error: inserted.error };
    if ("notFound" in inserted) return { ok: false, error: "client not found" };
    return { ok: true, value: { event: pick(inserted.data, TIMELINE_FIELDS) } };
  }

  if (name === "save_letter_draft") {
    if ("status" in args) return { ok: false, error: "status cannot be set here" };
    const extra = unknownField(args, ["client_id", "recipient_type", "recipient_name", "letter_type", "body_md"]);
    if (extra) return { ok: false, error: `unknown field: ${extra}` };
    if (
      typeof args.recipient_type !== "string" ||
      !(RECIPIENT_TYPES as readonly string[]).includes(args.recipient_type)
    ) {
      return { ok: false, error: "recipient_type must be cra, furnisher, collector, or regulator" };
    }
    if (typeof args.recipient_name !== "string" || args.recipient_name.trim() === "" || args.recipient_name.length > 200) {
      return { ok: false, error: "recipient_name is required" };
    }
    if (typeof args.letter_type !== "string" || args.letter_type.trim() === "" || args.letter_type.length > 120) {
      return { ok: false, error: "letter_type is required" };
    }
    if (typeof args.body_md !== "string" || args.body_md.trim() === "" || args.body_md.length > 100000) {
      return { ok: false, error: "body_md is required" };
    }
    const saved = await store.saveLetterDraft({
      client_id: clientUuid,
      recipient_type: args.recipient_type,
      recipient_name: args.recipient_name,
      letter_type: args.letter_type,
      body_md: args.body_md,
      status: "draft",
    });
    if ("error" in saved) return { ok: false, error: saved.error };
    if ("notFound" in saved) return { ok: false, error: "client not found" };
    return { ok: true, value: { letter: pick({ ...saved.data, status: "draft" }, LETTER_FIELDS) } };
  }

  if (name === "finalize_letter") {
    const extra = unknownField(args, ["client_id", "letter_id"]);
    if (extra) return { ok: false, error: `unknown field: ${extra}` };
    const letterId = requireUuid(args.letter_id, "letter_id");
    if (typeof letterId !== "string") return { ok: false, error: letterId.error };
    const current = await store.getLetter(clientUuid, letterId);
    if ("error" in current) return { ok: false, error: current.error };
    if ("notFound" in current) return { ok: false, error: "letter not found" };
    if (current.data.status === "mailed") return { ok: false, error: "a mailed letter cannot be changed" };
    if (current.data.status !== "draft") return { ok: false, error: "only a draft letter can be moved to final" };
    const updated = await store.finalizeLetter(clientUuid, letterId);
    if ("error" in updated) return { ok: false, error: updated.error };
    if ("notFound" in updated) return { ok: false, error: "only a draft letter can be moved to final" };
    return { ok: true, value: { letter: pick(updated.data, ["id", "client_id", "status"]) } };
  }

  if (name === "complete_task") {
    const extra = unknownField(args, ["client_id", "task_id"]);
    if (extra) return { ok: false, error: `unknown field: ${extra}` };
    const taskId = requireUuid(args.task_id, "task_id");
    if (typeof taskId !== "string") return { ok: false, error: taskId.error };
    const updated = await store.completeTask(clientUuid, taskId);
    if ("error" in updated) return { ok: false, error: updated.error };
    if ("notFound" in updated) return { ok: false, error: "task not found" };
    return { ok: true, value: { task: pick(updated.data, ["id", "client_id", "status"]) } };
  }

  return { ok: false, error: "unknown tool" };
}

function negotiatedProtocol(requested: unknown): string | null {
  if (typeof requested !== "string") return null;
  return (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested) ? requested : null;
}

async function handleMessage(
  agent: McpAgentRecord,
  msg: Record<string, unknown>,
  store: GuardianMcpStore,
  req: Request,
  cors: Record<string, string>,
): Promise<Response> {
  const id = rpcId(msg);
  const method = msg.method;
  if (typeof method !== "string" || method.length === 0) {
    return rpcResponse(req, id, { error: { code: -32600, message: "Invalid request" } }, cors, "2025-03-26");
  }
  const headerProtocol = negotiatedProtocol(req.headers.get("mcp-protocol-version")) ?? "2025-03-26";

  if (method.startsWith("notifications/")) {
    return new Response(null, { status: 202, headers: { "Cache-Control": "no-store", ...cors } });
  }

  const params = isRecord(msg.params) ? msg.params : {};
  let tool = method;
  let clientId: string | null = null;
  if (method === "tools/call") {
    tool = typeof params.name === "string" ? params.name.slice(0, 80) : "tools/call";
    const args = isRecord(params.arguments) ? params.arguments : {};
    clientId = clientIdOf(args);
  }

  const outcome = await withAudit(store, { agentId: agent.id, tool, clientId, success: false, error: "pending" }, async () => {
    if (method === "initialize") {
      const protocol = negotiatedProtocol(params.protocolVersion);
      if (!protocol) {
        return { ok: false, error: "unsupported protocol version" };
      }
      return {
        ok: true,
        value: {
          protocolVersion: protocol,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          instructions:
            "Credit Guardian staff file. Every read and write is audited. This server cannot delete a client, send mail, run SQL, or return payment methods.",
        },
      };
    }
    if (method === "ping") return { ok: true, value: {} };
    if (method === "tools/list") {
      const tools = TOOLS.filter((item) => agent.scopes.includes(item.scope)).map((item) => ({
        name: item.name,
        description: item.description,
        inputSchema: item.inputSchema,
      }));
      return { ok: true, value: { tools } };
    }
    if (method === "tools/call") {
      const name = params.name;
      if (typeof name !== "string" || !TOOL_BY_NAME.has(name)) {
        const blocked = typeof name === "string" && BLOCKED_TOOL_SET.has(name);
        return { ok: false, error: blocked ? "not available on an agent token" : "unknown tool" };
      }
      const def = TOOL_BY_NAME.get(name)!;
      if (!agent.scopes.includes(def.scope)) {
        return { ok: false, error: "agent is not allowed to use this tool" };
      }
      const args = isRecord(params.arguments) ? params.arguments : {};
      return executeTool(store, name, args);
    }
    return { ok: false, error: "unknown method" };
  });

  if (method === "initialize" || method === "ping" || method === "tools/list") {
    if (outcome.isError) {
      return rpcResponse(
        req,
        id,
        { error: { code: -32603, message: String((outcome.value as { error?: string }).error ?? "request failed") } },
        cors,
        headerProtocol,
      );
    }
    const protocol =
      method === "initialize" && isRecord(outcome.value) && typeof outcome.value.protocolVersion === "string"
        ? outcome.value.protocolVersion
        : headerProtocol;
    return rpcResponse(req, id, { result: outcome.value }, cors, protocol);
  }

  if (method !== "tools/call") {
    return rpcResponse(
      req,
      id,
      { error: { code: -32601, message: "Method not found" } },
      cors,
      headerProtocol,
    );
  }

  return rpcResponse(req, id, { result: toolResult(outcome.isError, outcome.value) }, cors, headerProtocol);
}

export async function handleGuardianMcpRequest(req: Request, deps: McpDeps): Promise<Response> {
  const cors = deps.corsHeaders ?? {};
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { "Cache-Control": "no-store", ...cors } });
  }
  if (req.method !== "POST") {
    return json({ jsonrpc: "2.0", id: null, error: { code: -32600, message: "Method not allowed" } }, 405, cors);
  }

  const token = bearerToken(req);
  if (!token) return authError("Unauthorized: missing secret", cors);
  if (looksLikeSessionToken(token)) return authError("Unauthorized: session tokens are not accepted", cors);
  if (deps.isForbiddenSecret?.(token)) {
    return authError("Unauthorized: CREDIT_GUARDIAN_KEY is not an MCP secret", cors);
  }

  const now = deps.now ?? (() => new Date());
  let agent: McpAgentRecord | null = null;
  try {
    agent = await deps.store.findAgentByHash(await hashAgentSecret(token));
  } catch (err) {
    console.error("guardian-mcp agent lookup failed", err instanceof Error ? err.name : "error");
    return json({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "request failed" } }, 500, cors);
  }
  if (!agent) return authError("Unauthorized: unknown agent secret", cors);

  const expiresMs = Date.parse(agent.expiresAt);
  const active = !agent.revokedAt && Number.isFinite(expiresMs) && expiresMs > now().getTime();

  let parsed: unknown;
  try {
    parsed = JSON.parse(await req.text());
  } catch {
    parsed = null;
  }

  if (!active) {
    const peek = isRecord(parsed) ? parsed : {};
    const method = typeof peek.method === "string" ? peek.method.slice(0, 80) : "(unparsed)";
    const params = isRecord(peek.params) ? peek.params : {};
    const args = isRecord(params.arguments) ? params.arguments : {};
    try {
      await deps.store.insertAudit({
        agentId: agent.id,
        tool: method === "tools/call" && typeof params.name === "string" ? params.name.slice(0, 80) : method,
        clientId: clientIdOf(args),
        success: false,
        error: "expired or revoked",
      });
    } catch (err) {
      console.error("guardian-mcp expired audit failed", err instanceof Error ? err.name : "error");
    }
    return authError("Unauthorized: agent secret is expired or revoked", cors);
  }

  if (Array.isArray(parsed)) {
    return json(
      { jsonrpc: "2.0", id: null, error: { code: -32600, message: "batch requests are not supported" } },
      400,
      cors,
    );
  }
  if (!isRecord(parsed)) {
    try {
      await deps.store.insertAudit({
        agentId: agent.id,
        tool: "(unparsed)",
        clientId: null,
        success: false,
        error: "invalid json",
      });
    } catch (err) {
      console.error("guardian-mcp parse audit failed", err instanceof Error ? err.name : "error");
    }
    return json({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } }, 400, cors);
  }
  if (parsed.jsonrpc !== "2.0") {
    return rpcResponse(req, rpcId(parsed), { error: { code: -32600, message: "Invalid request" } }, cors, "2025-03-26");
  }

  return handleMessage(agent, parsed, deps.store, req, cors);
}

function publicAgent(agent: EnrolledAgentPublic): EnrolledAgentPublic {
  return {
    id: agent.id,
    name: agent.name,
    scopes: agent.scopes,
    expires_at: agent.expires_at,
    revoked_at: agent.revoked_at,
    created_at: agent.created_at,
    created_by: agent.created_by,
  };
}

export async function handleGuardianMcpEnrollRequest(req: Request, deps: EnrollDeps): Promise<Response> {
  const cors = deps.corsHeaders ?? {};
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: { "Cache-Control": "no-store", ...cors } });
  }
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);

  const token = bearerToken(req);
  if (!token) return json({ error: "Unauthorized: missing secret" }, 401, cors);
  if (!looksLikeSessionToken(token)) {
    return json({ error: "Unauthorized: staff session required" }, 401, cors);
  }

  const auth = await deps.authorize(req);
  if (auth.ok !== true) {
    const denied = auth as { status: number; error: string };
    return json({ error: denied.error }, denied.status, cors);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (!isRecord(parsed)) return json({ error: "Invalid JSON body" }, 400, cors);
    body = parsed;
  } catch {
    return json({ error: "Invalid JSON body" }, 400, cors);
  }

  const action = body.action;
  const now = deps.now ?? (() => new Date());

  if (action === "list") {
    const listed = await deps.store.listAgents();
    if ("error" in listed) return json({ error: listed.error }, 500, cors);
    return json({ agents: listed.agents.map(publicAgent) }, 200, cors);
  }

  if (action === "audit") {
    const limit = parseLimit(body.limit);
    const resolved = typeof limit === "number" ? Math.min(limit, 100) : 50;
    if (typeof limit !== "number" && body.limit != null) {
      return json({ error: (limit as { error: string }).error }, 400, cors);
    }
    const rows = await deps.store.listAudit(resolved);
    if ("error" in rows) return json({ error: rows.error }, 500, cors);
    return json({
      rows: rows.rows.map((row) => ({
        id: row.id,
        agent_id: row.agent_id,
        agent_name: row.agent_name,
        tool: row.tool,
        client_id: row.client_id,
        success: row.success,
        error: row.error == null ? null : publicError(row.error),
        created_at: row.created_at,
      })),
    }, 200, cors);
  }

  if (action === "revoke") {
    const id = requireUuid(body.agent_id, "agent_id");
    if (typeof id !== "string") return json({ error: id.error }, 400, cors);
    const revoked = await deps.store.revokeAgent(id);
    if ("error" in revoked) return json({ error: revoked.error }, 500, cors);
    if ("notFound" in revoked) return json({ error: "agent not found" }, 404, cors);
    return json({ agent: publicAgent(revoked.data) }, 200, cors);
  }

  if (action === "create") {
    const parsed = validateEnrollment(
      { name: body.name, scopes: body.scopes, expires_at: body.expires_at },
      now(),
    );
    if (parsed.ok !== true) return json({ error: (parsed as { error: string }).error }, 400, cors);
    const enrolled = parsed as { name: string; scopes: string[]; expiresAt: string };
    const secret = generateAgentSecret();
    const secretHash = await hashAgentSecret(secret);
    const inserted = await deps.store.insertAgent({
      name: enrolled.name,
      secret_hash: secretHash,
      scopes: enrolled.scopes,
      expires_at: enrolled.expiresAt,
      created_by: auth.userId,
    });
    if ("error" in inserted) return json({ error: inserted.error }, 500, cors);
    return json({ agent: publicAgent(inserted.agent), secret }, 200, cors);
  }

  return json({ error: "unknown action" }, 400, cors);
}
