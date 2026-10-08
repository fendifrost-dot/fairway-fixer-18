import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, "crypto", { value: webcrypto, configurable: true });
}
import {
  ALL_SCOPES,
  CLIENT_LIST_FIELDS,
  CLIENT_SUMMARY_FIELDS,
  DEADLINE_FIELDS,
  LETTER_FIELDS,
  READ_SCOPES,
  TASK_FIELDS,
  TIMELINE_FIELDS,
  WRITE_SCOPES,
  handleGuardianMcpEnrollRequest,
  handleGuardianMcpRequest,
  hashAgentSecret,
  looksLikeSessionToken,
  timingSafeEqual,
  type AuditInsert,
  type EnrollStore,
  type EnrolledAgentPublic,
  type GuardianMcpStore,
  type LetterDraftInsert,
  type McpAgentRecord,
  type TimelineInsert,
} from "../../supabase/functions/_shared/guardianMcp.ts";

const CLIENT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const AGENT = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const LETTER = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const TASK = "ffffffff-ffff-4fff-8fff-ffffffffffff";
const STAFF = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const NOW = new Date("2026-10-06T12:00:00.000Z");
const RAW = "  Note from the file  ";

class MemoryStore implements GuardianMcpStore {
  calls: string[] = [];
  agents: McpAgentRecord[] = [];
  audits: Array<AuditInsert & { id: string }> = [];
  auditFails = false;
  events: TimelineInsert[] = [];
  letters: Array<{ id: string; client_id: string; status: string }> = [];
  finalized = 0;

  async findAgentByHash(secretHash: string) {
    this.calls.push("findAgentByHash");
    return this.agents.find((agent) => agent.secretHash === secretHash) ?? null;
  }

  async insertAudit(row: AuditInsert) {
    this.calls.push("insertAudit");
    if (this.auditFails) return { error: "audit down" };
    const id = crypto.randomUUID();
    this.audits.push({ ...row, id });
    return { id };
  }

  async finishAudit(id: string, success: boolean, error: string | null) {
    this.calls.push("finishAudit");
    const row = this.audits.find((audit) => audit.id === id);
    if (!row) throw new Error("missing audit");
    row.success = success;
    row.error = error;
  }

  async listClients() {
    this.calls.push("listClients");
    return {
      data: [
        {
          id: CLIENT,
          legal_name: "Ada Lovelace",
          preferred_name: null,
          email: "ada@example.com",
          phone: null,
          status: "Active",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-02T00:00:00.000Z",
          notes: "staff note",
          payment_method_id: "pm_should_not_leak",
        },
      ],
    };
  }

  async getClientSummary(clientId: string) {
    this.calls.push("getClientSummary");
    if (clientId !== CLIENT) return { notFound: true as const };
    return {
      data: {
        client: {
          id: CLIENT,
          legal_name: "Ada Lovelace",
          notes: "staff note",
          payment_method_id: "pm_should_not_leak",
          stripe_customer: "cus_should_not_leak",
        },
        open_task_count: 1,
        letters: { draft: 1, final: 0, mailed: 0 },
      },
    };
  }

  async listTimeline() {
    return { data: [] };
  }
  async listLetters() {
    return { data: [] };
  }
  async listTasks() {
    return { data: [] };
  }
  async listDeadlines() {
    return { data: [] };
  }

  async clientExists(clientId: string) {
    this.calls.push("clientExists");
    return { exists: clientId === CLIENT };
  }

  async updateClient() {
    this.calls.push("updateClient");
    return { data: { id: CLIENT } };
  }

  async addTimelineEvent(row: TimelineInsert) {
    this.calls.push("addTimelineEvent");
    if (!this.audits.some((audit) => audit.tool === "add_timeline_event")) {
      throw new Error("timeline write committed before the audit row");
    }
    this.events.push(row);
    return { data: { id: crypto.randomUUID(), ...row, created_at: NOW.toISOString() } };
  }

  async saveLetterDraft(row: LetterDraftInsert) {
    this.calls.push("saveLetterDraft");
    return { data: { id: LETTER, ...row } };
  }

  async getLetter(clientId: string, letterId: string) {
    this.calls.push("getLetter");
    const letter = this.letters.find((item) => item.id === letterId && item.client_id === clientId);
    if (!letter) return { notFound: true as const };
    return { data: letter };
  }

  async finalizeLetter() {
    this.calls.push("finalizeLetter");
    this.finalized += 1;
    return { data: { id: LETTER, client_id: CLIENT, status: "final" } };
  }

  async completeTask() {
    this.calls.push("completeTask");
    return { data: { id: TASK, client_id: CLIENT, status: "Done" } };
  }
}

async function enrollAgent(store: MemoryStore, scopes: string[] = [...ALL_SCOPES]) {
  const secret = "cgma_test_secret_value";
  store.agents.push({
    id: AGENT,
    name: "cursor",
    secretHash: await hashAgentSecret(secret),
    scopes,
    expiresAt: "2027-01-01T00:00:00.000Z",
    revokedAt: null,
  });
  return secret;
}

function post(store: MemoryStore, token: string | null, body: unknown, forbidden?: (token: string) => boolean) {
  const headers = new Headers({ "content-type": "application/json" });
  if (token !== null) headers.set("authorization", `Bearer ${token}`);
  return handleGuardianMcpRequest(
    new Request("https://guardian.example/functions/v1/guardian-mcp", {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    }),
    { store, now: () => NOW, isForbiddenSecret: forbidden },
  );
}

async function toolText(response: Response): Promise<Record<string, unknown>> {
  const body = (await response.json()) as {
    result?: { content?: Array<{ text?: string }>; isError?: boolean };
  };
  return JSON.parse(body.result?.content?.[0]?.text ?? "{}") as Record<string, unknown>;
}

describe("guardian mcp auth", () => {
  it("rejects a call with no secret", async () => {
    const store = new MemoryStore();
    const response = await post(store, null, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.message).toMatch(/missing secret/);
    expect(store.calls).toEqual([]);
  });

  it("rejects an x-api-key with no bearer secret", async () => {
    const store = new MemoryStore();
    const response = await handleGuardianMcpRequest(
      new Request("https://guardian.example/functions/v1/guardian-mcp", {
        method: "POST",
        headers: { "content-type": "application/json", "x-api-key": "CREDIT_GUARDIAN_KEY" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
      { store, now: () => NOW },
    );
    expect(response.status).toBe(401);
    expect(store.calls).toEqual([]);
  });

  it("rejects a customer or staff session JWT", async () => {
    const store = new MemoryStore();
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiY2xpZW50In0.signature";
    expect(looksLikeSessionToken(jwt)).toBe(true);
    const response = await post(store, jwt, { jsonrpc: "2.0", id: 1, method: "tools/list" });
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.message).toMatch(/session tokens are not accepted/);
    expect(store.calls).toEqual([]);
  });

  it("rejects CREDIT_GUARDIAN_KEY even if that string was also hashed as an agent", async () => {
    const store = new MemoryStore();
    const god = "control-center-telegram-key";
    store.agents.push({
      id: AGENT,
      name: "cursor",
      secretHash: await hashAgentSecret(god),
      scopes: [...ALL_SCOPES],
      expiresAt: "2027-01-01T00:00:00.000Z",
      revokedAt: null,
    });
    const response = await post(store, god, { jsonrpc: "2.0", id: 1, method: "tools/list" }, (token) =>
      timingSafeEqual(token, god),
    );
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body.error.message).toMatch(/CREDIT_GUARDIAN_KEY/);
    expect(store.calls).toEqual([]);
  });

  it("rejects an expired agent and does not read the file", async () => {
    const store = new MemoryStore();
    const secret = "cgma_expired";
    store.agents.push({
      id: AGENT,
      name: "cursor",
      secretHash: await hashAgentSecret(secret),
      scopes: [...ALL_SCOPES],
      expiresAt: "2026-01-01T00:00:00.000Z",
      revokedAt: null,
    });
    const response = await post(store, secret, {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "list_clients", arguments: {} },
    });
    expect(response.status).toBe(401);
    expect(store.calls).not.toContain("listClients");
    expect(store.audits[0]?.success).toBe(false);
    expect(store.audits[0]?.error).toMatch(/expired/);
  });
});

describe("guardian mcp tools", () => {
  it("lists a client and hides payment fields and staff notes", async () => {
    const store = new MemoryStore();
    const secret = await enrollAgent(store);
    const response = await post(store, secret, {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: "list_clients", arguments: {} },
    });
    expect(response.status).toBe(200);
    const payload = await toolText(response);
    const clients = payload.clients as Array<Record<string, unknown>>;
    expect(clients[0]?.legal_name).toBe("Ada Lovelace");
    expect(clients[0]?.notes).toBeUndefined();
    const encoded = JSON.stringify(payload);
    expect(encoded).not.toContain("pm_should_not_leak");
    expect(encoded).not.toContain("staff note");
    expect(store.audits.at(-1)?.success).toBe(true);
    expect(store.audits.at(-1)?.tool).toBe("list_clients");
  });

  it("returns staff notes on the summary and still hides payment ids", async () => {
    const store = new MemoryStore();
    const secret = await enrollAgent(store);
    const response = await post(store, secret, {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "get_client_summary", arguments: { client_id: CLIENT } },
    });
    const payload = await toolText(response);
    const client = payload.client as Record<string, unknown>;
    expect(client.notes).toBe("staff note");
    const encoded = JSON.stringify(payload);
    expect(encoded).not.toContain("pm_should_not_leak");
    expect(encoded).not.toContain("cus_should_not_leak");
  });

  it("adds a timeline note only after the audit row exists", async () => {
    const store = new MemoryStore();
    const secret = await enrollAgent(store);
    const response = await post(store, secret, {
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "add_timeline_event",
        arguments: { client_id: CLIENT, raw_line: RAW },
      },
    });
    expect(response.status).toBe(200);
    const payload = await toolText(response);
    const event = payload.event as Record<string, unknown>;
    expect(event.raw_line).toBe(RAW);
    expect(event.date_is_unknown).toBe(true);
    expect(event.event_kind).toBe("note");
    expect(store.events).toHaveLength(1);
    expect(store.events[0]?.raw_line).toBe(RAW);
    const auditAt = store.calls.indexOf("insertAudit");
    const writeAt = store.calls.indexOf("addTimelineEvent");
    expect(auditAt).toBeGreaterThanOrEqual(0);
    expect(writeAt).toBeGreaterThan(auditAt);
    const audit = store.audits.at(-1);
    expect(audit?.success).toBe(true);
    expect(audit?.clientId).toBe(CLIENT);
    expect(audit?.agentId).toBe(AGENT);
    expect(audit?.tool).toBe("add_timeline_event");
  });

  it("does not write a timeline note when the audit insert fails", async () => {
    const store = new MemoryStore();
    store.auditFails = true;
    const secret = await enrollAgent(store);
    const response = await post(store, secret, {
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: {
        name: "add_timeline_event",
        arguments: { client_id: CLIENT, raw_line: RAW },
      },
    });
    const body = (await response.json()) as { result?: { isError?: boolean } };
    expect(body.result?.isError).toBe(true);
    expect(store.calls).not.toContain("addTimelineEvent");
    expect(store.calls).not.toContain("clientExists");
    expect(store.events).toHaveLength(0);
  });

  it("refuses a timeline note without raw_line and does not write", async () => {
    const store = new MemoryStore();
    const secret = await enrollAgent(store);
    const response = await post(store, secret, {
      jsonrpc: "2.0",
      id: 6,
      method: "tools/call",
      params: { name: "add_timeline_event", arguments: { client_id: CLIENT } },
    });
    const payload = await toolText(response);
    expect(String(payload.error)).toMatch(/raw_line/);
    expect(store.events).toHaveLength(0);
    expect(store.calls).not.toContain("addTimelineEvent");
    expect(store.audits.at(-1)?.success).toBe(false);
  });

  it("does not expose delete, mail, or sql tools", async () => {
    const store = new MemoryStore();
    const secret = await enrollAgent(store);
    const listed = await post(store, secret, { jsonrpc: "2.0", id: 7, method: "tools/list" });
    const body = (await listed.json()) as { result?: { tools?: Array<{ name: string }> } };
    const names = (body.result?.tools ?? []).map((tool) => tool.name);
    expect(names).toContain("list_clients");
    expect(names).toContain("add_timeline_event");
    expect(names).not.toContain("delete_client");
    expect(names).not.toContain("send_mail");
    expect(names).not.toContain("run_sql");

    for (const name of ["delete_client", "send_mail", "run_sql"]) {
      const response = await post(store, secret, {
        jsonrpc: "2.0",
        id: name,
        method: "tools/call",
        params: { name, arguments: { client_id: CLIENT } },
      });
      const payload = await toolText(response);
      expect(String(payload.error)).toMatch(/not available/);
    }
    expect(store.events).toHaveLength(0);
    expect(store.finalized).toBe(0);
  });

  it("does not update a client when the field is outside the allow list", async () => {
    const store = new MemoryStore();
    const secret = await enrollAgent(store);
    const response = await post(store, secret, {
      jsonrpc: "2.0",
      id: 8,
      method: "tools/call",
      params: {
        name: "update_client",
        arguments: { client_id: CLIENT, fields: { payment_method_id: "pm_123" } },
      },
    });
    const payload = await toolText(response);
    expect(String(payload.error)).toMatch(/not allow-listed/);
    expect(store.calls).not.toContain("updateClient");
  });

  it("refuses to move a mailed letter and refuses a draft that tries to set mailed", async () => {
    const store = new MemoryStore();
    store.letters.push({ id: LETTER, client_id: CLIENT, status: "mailed" });
    const secret = await enrollAgent(store);
    const mailed = await post(store, secret, {
      jsonrpc: "2.0",
      id: 9,
      method: "tools/call",
      params: { name: "finalize_letter", arguments: { client_id: CLIENT, letter_id: LETTER } },
    });
    const mailedPayload = await toolText(mailed);
    expect(String(mailedPayload.error)).toMatch(/mailed/);
    expect(store.finalized).toBe(0);

    const draft = await post(store, secret, {
      jsonrpc: "2.0",
      id: 10,
      method: "tools/call",
      params: {
        name: "save_letter_draft",
        arguments: {
          client_id: CLIENT,
          recipient_type: "cra",
          recipient_name: "Equifax",
          letter_type: "611",
          body_md: "Please investigate.",
          status: "mailed",
        },
      },
    });
    const draftPayload = await toolText(draft);
    expect(String(draftPayload.error)).toMatch(/status cannot be set/);
    expect(store.calls).not.toContain("saveLetterDraft");
  });

  it("rejects a write outside the agent scope", async () => {
    const store = new MemoryStore();
    const secret = await enrollAgent(store, ["clients.list"]);
    const response = await post(store, secret, {
      jsonrpc: "2.0",
      id: 11,
      method: "tools/call",
      params: { name: "add_timeline_event", arguments: { client_id: CLIENT, raw_line: RAW } },
    });
    const payload = await toolText(response);
    expect(String(payload.error)).toMatch(/not allowed/);
    expect(store.events).toHaveLength(0);
    expect(store.audits.at(-1)?.success).toBe(false);
  });
});

describe("guardian mcp field lists", () => {
  it("does not select vault, card, or service-role columns", () => {
    const banned = ["password", "secret", "stripe", "payment", "service_role", "vault", "card"];
    const fields = [
      ...CLIENT_LIST_FIELDS,
      ...CLIENT_SUMMARY_FIELDS,
      ...TIMELINE_FIELDS,
      ...LETTER_FIELDS,
      ...TASK_FIELDS,
      ...DEADLINE_FIELDS,
    ];
    for (const field of fields) {
      for (const word of banned) {
        expect(field.toLowerCase()).not.toContain(word);
      }
    }
    expect(READ_SCOPES).not.toContain("clients.update" as never);
    expect(WRITE_SCOPES).toContain("timeline.write");
  });

  it("hashes with sha-256 and does not mint a dotted secret", async () => {
    expect(await hashAgentSecret("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});

describe("guardian mcp enrollment", () => {
  function enrollStore(): EnrollStore & { saved: Array<Record<string, unknown>> } {
    const saved: Array<Record<string, unknown>> = [];
    return {
      saved,
      async insertAgent(row) {
        saved.push({ ...row });
        const agent: EnrolledAgentPublic = {
          id: AGENT,
          name: row.name,
          scopes: row.scopes,
          expires_at: row.expires_at,
          revoked_at: null,
          created_at: NOW.toISOString(),
          created_by: row.created_by,
        };
        return { agent };
      },
      async listAgents() {
        return { agents: [] };
      },
      async revokeAgent() {
        return { notFound: true };
      },
      async listAudit() {
        return { rows: [] };
      },
    };
  }

  function enroll(token: string | null, body: unknown, authorize?: EnrollStore extends never ? never : (req: Request) => Promise<{ ok: true; userId: string } | { ok: false; status: number; error: string }>) {
    const headers = new Headers({ "content-type": "application/json" });
    if (token) headers.set("authorization", `Bearer ${token}`);
    const store = enrollStore();
    const response = handleGuardianMcpEnrollRequest(
      new Request("https://guardian.example/functions/v1/guardian-mcp-enroll", {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      }),
      {
        store,
        now: () => NOW,
        authorize: authorize ?? (async () => ({ ok: true, userId: STAFF })),
      },
    );
    return { response, store };
  }

  it("rejects a missing secret and an agent secret", async () => {
    const missing = enroll(null, { action: "list" });
    expect((await missing.response).status).toBe(401);
    expect(missing.store.saved).toHaveLength(0);

    const agent = enroll("cgma_not_a_session", { action: "create", name: "cursor", scopes: ["read"], expires_at: "2027-01-01T00:00:00.000Z" });
    expect((await agent.response).status).toBe(401);
    expect(agent.store.saved).toHaveLength(0);
  });

  it("rejects a session that is not staff", async () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiY2xpZW50In0.signature";
    const { response, store } = enroll(jwt, { action: "list" }, async () => ({
      ok: false,
      status: 403,
      error: "Forbidden: staff or admin role required",
    }));
    expect((await response).status).toBe(403);
    expect(store.saved).toHaveLength(0);
  });

  it("returns a secret once and stores only the hash", async () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic3RhZmYifQ.signature";
    const { response, store } = enroll(jwt, {
      action: "create",
      name: "Cursor",
      scopes: ["read"],
      expires_at: "2027-01-01T00:00:00.000Z",
    });
    const body = (await (await response).json()) as { secret?: string; agent?: { scopes?: string[]; name?: string } };
    expect(body.secret?.startsWith("cgma_")).toBe(true);
    expect(body.secret?.includes(".")).toBe(false);
    expect(looksLikeSessionToken(body.secret ?? "")).toBe(false);
    expect(body.agent?.name).toBe("cursor");
    expect(body.agent?.scopes).toEqual([...READ_SCOPES]);
    expect(body.agent?.scopes).not.toContain("timeline.write");
    const saved = store.saved[0];
    expect(saved?.secret_hash).toBe(await hashAgentSecret(body.secret ?? ""));
    expect(JSON.stringify(body)).not.toContain(String(saved?.secret_hash));
    expect(saved?.secret).toBeUndefined();
  });

  it("rejects a scope that is not on the phase 1 list", async () => {
    const jwt = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic3RhZmYifQ.signature";
    const { response, store } = enroll(jwt, {
      action: "create",
      name: "claude",
      scopes: ["delete_client"],
      expires_at: "2027-01-01T00:00:00.000Z",
    });
    expect((await response).status).toBe(400);
    expect(store.saved).toHaveLength(0);
  });
});
