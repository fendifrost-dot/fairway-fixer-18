/**
 * create_client on the Credit Guardian MCP server.
 * Runs the real request handler against an in-memory store, so scope gating,
 * audit ordering, ownership, and argument validation are all exercised.
 */
import { describe, expect, it } from "vitest";
import {
  ALL_SCOPES,
  WRITE_SCOPES,
  handleGuardianMcpRequest,
  hashAgentSecret,
  parseCreateClientArgs,
  resolveScopes,
  type ClientCreateInsert,
  type GuardianMcpStore,
  type MatterCreateInsert,
  type McpAgentRecord,
} from "../../supabase/functions/_shared/guardianMcp";

const SECRET = "cgma_test-secret";
const STAFF_ID = "4b5e536e-3907-471a-ba68-8a4e4c503e98";
const NEW_CLIENT_ID = "11111111-2222-4333-8444-555555555555";
const NEW_MATTER_ID = "66666666-7777-4888-9999-aaaaaaaaaaaa";

interface FakeState {
  agent: McpAgentRecord;
  audits: Array<{ id: string; tool: string; clientId: string | null; success: boolean; error: string | null }>;
  created: Array<{ client: ClientCreateInsert; matter: MatterCreateInsert }>;
  failCreate?: boolean;
}

function fakeStore(state: FakeState): GuardianMcpStore {
  const unused = async () => ({ error: "not used in this test" });
  return {
    async findAgentByHash(hash) {
      return hash === state.agent.secretHash ? state.agent : null;
    },
    async insertAudit(row) {
      const id = `audit-${state.audits.length + 1}`;
      state.audits.push({ id, tool: row.tool, clientId: row.clientId, success: row.success, error: row.error });
      return { id };
    },
    async finishAudit(id, success, error, clientId) {
      const row = state.audits.find((item) => item.id === id);
      if (!row) throw new Error("missing audit row");
      row.success = success;
      row.error = error;
      if (clientId) row.clientId = clientId;
    },
    async createClient(client, matter) {
      if (state.failCreate) return { error: "request failed" };
      state.created.push({ client, matter });
      return {
        data: {
          client: {
            id: NEW_CLIENT_ID,
            legal_name: client.legal_name,
            preferred_name: client.preferred_name,
            email: client.email,
            phone: client.phone,
            status: client.status,
            intake_channel: client.intake_channel,
            payment_standing: client.payment_standing,
            notes: client.notes,
            ssn_last4: client.ssn_last4,
            created_at: "2026-10-15T00:00:00.000Z",
            updated_at: "2026-10-15T00:00:00.000Z",
          },
          matter_id: NEW_MATTER_ID,
        },
      };
    },
    listClients: unused,
    getClientSummary: unused,
    listTimeline: unused,
    listLetters: unused,
    listTasks: unused,
    listDeadlines: unused,
    clientExists: unused,
    updateClient: unused,
    addTimelineEvent: unused,
    saveLetterDraft: unused,
    getLetter: unused,
    finalizeLetter: unused,
    completeTask: unused,
  };
}

async function agentWith(scopes: readonly string[], createdBy: string | null = STAFF_ID): Promise<McpAgentRecord> {
  return {
    id: "agent-1",
    name: "claude",
    secretHash: await hashAgentSecret(SECRET),
    scopes: [...scopes],
    expiresAt: "2027-01-06T23:59:59.000Z",
    revokedAt: null,
    createdBy,
  };
}

async function rpc(store: GuardianMcpStore, method: string, params: Record<string, unknown>) {
  const req = new Request("https://example.test/guardian-mcp", {
    method: "POST",
    headers: { authorization: `Bearer ${SECRET}`, "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const res = await handleGuardianMcpRequest(req, { store });
  return (await res.json()) as { result?: Record<string, unknown>; error?: { message: string } };
}

function toolText(result: Record<string, unknown> | undefined): Record<string, unknown> {
  const content = (result?.content as Array<{ text: string }>) ?? [];
  return JSON.parse(content[0]?.text ?? "{}");
}

describe("create_client scope", () => {
  it("is a write scope and part of the write alias", () => {
    expect(WRITE_SCOPES).toContain("clients.create");
    expect(ALL_SCOPES).toContain("clients.create");
    const resolved = resolveScopes(["write"]);
    expect(resolved.ok).toBe(true);
    expect((resolved as { scopes: string[] }).scopes).toContain("clients.create");
  });

  it("lists create_client only for agents holding clients.create", async () => {
    const withScope = fakeStore({ agent: await agentWith(["clients.list", "clients.create"]), audits: [], created: [] });
    const listed = await rpc(withScope, "tools/list", {});
    const names = (listed.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(names).toContain("create_client");

    const without = fakeStore({ agent: await agentWith(["clients.list", "clients.update"]), audits: [], created: [] });
    const hidden = await rpc(without, "tools/list", {});
    const hiddenNames = (hidden.result?.tools as Array<{ name: string }>).map((tool) => tool.name);
    expect(hiddenNames).not.toContain("create_client");
  });

  it("refuses the call without the scope and audits the refusal", async () => {
    const state: FakeState = { agent: await agentWith(["clients.list", "clients.update"]), audits: [], created: [] };
    const res = await rpc(fakeStore(state), "tools/call", { name: "create_client", arguments: { legal_name: "Deajah Newman" } });
    expect(res.result?.isError).toBe(true);
    expect(toolText(res.result).error).toBe("agent is not allowed to use this tool");
    expect(state.created).toHaveLength(0);
    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].success).toBe(false);
  });
});

describe("create_client call", () => {
  it("creates the client and matter owned by the enrolling staff member", async () => {
    const state: FakeState = { agent: await agentWith(["clients.create"]), audits: [], created: [] };
    const res = await rpc(fakeStore(state), "tools/call", {
      name: "create_client",
      arguments: {
        legal_name: "  Deajah Newman ",
        notes: "Name variations: Deajah Newman / Deajah S Newman",
        date_of_birth: "1995-06-01",
        current_address: "Dolton, IL",
        email: "Deajah@Example.com",
        experian_score: 612,
        equifax_score: 598,
        transunion_score: 605,
        ssn_last4: "1234",
      },
    });
    expect(res.result?.isError).toBe(false);
    const payload = toolText(res.result);
    expect(payload.matter_id).toBe(NEW_MATTER_ID);
    const client = payload.client as Record<string, unknown>;
    expect(client.id).toBe(NEW_CLIENT_ID);
    expect(client.legal_name).toBe("Deajah Newman");
    expect(client.email).toBe("deajah@example.com");
    expect(client.intake_channel).toBe("agent");
    expect(client.payment_standing).toBe("unknown");
    expect(client).not.toHaveProperty("ssn_last4");

    expect(state.created).toHaveLength(1);
    const { client: inserted, matter } = state.created[0];
    expect(inserted.owner_id).toBe(STAFF_ID);
    expect(matter.owner_id).toBe(STAFF_ID);
    expect(matter.matter_type).toBe("Credit");
    expect(matter.intake_source).toBe("MCP");
    expect(inserted.status).toBe("Active");
    expect(inserted.intake_channel).toBe("agent");
    expect(inserted.payment_standing).toBe("unknown");
    expect(inserted.ssn_last4).toBe("1234");
    expect(inserted.experian_score).toBe(612);

    expect(state.audits).toHaveLength(1);
    expect(state.audits[0].tool).toBe("create_client");
    expect(state.audits[0].success).toBe(true);
    expect(state.audits[0].clientId).toBe(NEW_CLIENT_ID);
  });

  it("refuses when the agent has no enrolling staff member", async () => {
    const state: FakeState = { agent: await agentWith(["clients.create"], null), audits: [], created: [] };
    const res = await rpc(fakeStore(state), "tools/call", { name: "create_client", arguments: { legal_name: "X" } });
    expect(res.result?.isError).toBe(true);
    expect(String(toolText(res.result).error)).toContain("re-enroll");
    expect(state.created).toHaveLength(0);
  });

  it("records a failed audit row when the store fails", async () => {
    const state: FakeState = { agent: await agentWith(["clients.create"]), audits: [], created: [], failCreate: true };
    const res = await rpc(fakeStore(state), "tools/call", { name: "create_client", arguments: { legal_name: "X" } });
    expect(res.result?.isError).toBe(true);
    expect(state.audits[0].success).toBe(false);
    expect(state.audits[0].error).toBe("request failed");
  });
});

describe("parseCreateClientArgs", () => {
  const ok = (args: Record<string, unknown>) => {
    const parsed = parseCreateClientArgs(args, STAFF_ID);
    expect(parsed.ok).toBe(true);
    return parsed as { client: ClientCreateInsert; matter: MatterCreateInsert };
  };
  const bad = (args: Record<string, unknown>) => {
    const parsed = parseCreateClientArgs(args, STAFF_ID);
    expect(parsed.ok).toBe(false);
    return (parsed as { error: string }).error;
  };

  it("requires legal_name", () => {
    expect(bad({})).toBe("legal_name must be non-empty text");
    expect(bad({ legal_name: "   " })).toBe("legal_name must be non-empty text");
  });

  it("rejects fields outside the allow-list", () => {
    expect(bad({ legal_name: "A", owner_id: STAFF_ID })).toBe("unknown field: owner_id");
    expect(bad({ legal_name: "A", id: NEW_CLIENT_ID })).toBe("unknown field: id");
  });

  it("validates identity fields", () => {
    expect(bad({ legal_name: "A", ssn_last4: "12a4" })).toBe("ssn_last4 must be exactly 4 digits");
    expect(bad({ legal_name: "A", date_of_birth: "1995-02-30" })).toBe("date_of_birth must be YYYY-MM-DD");
    expect(bad({ legal_name: "A", experian_score: 900 })).toContain("experian_score");
    expect(bad({ legal_name: "A", status: "Closed" })).toBe("status must be Active, Inactive, or Pending");
    expect(bad({ legal_name: "A", matter_type: "Tax" })).toBe("matter_type must be Credit, Consulting, or Both");
    expect(bad({ legal_name: "A", email: "a@b\nc" })).toBe("email must be a single line");
    expect(bad({ legal_name: "A", payment_standing: "free" })).toContain("payment_standing must be one of");
    expect(bad({ legal_name: "A", intake_channel: "staff" })).toBe("unknown field: intake_channel");
  });

  it("records the payment standing the agent was told and always stamps the agent channel", () => {
    const { client } = ok({ legal_name: "A", payment_standing: "paid_in_full" });
    expect(client.payment_standing).toBe("paid_in_full");
    expect(client.intake_channel).toBe("agent");
  });

  it("normalizes optional fields", () => {
    const { client, matter } = ok({
      legal_name: "A",
      alternate_addresses: ["  123 Main ", "", "456 Elm"],
      matter_type: "Both",
      intake_raw_text: "pasted report",
      intake_source: "Telegram",
      notes: "   ",
    });
    expect(client.alternate_addresses).toEqual(["123 Main", "456 Elm"]);
    expect(client.notes).toBeNull();
    expect(matter.matter_type).toBe("Both");
    expect(matter.intake_raw_text).toBe("pasted report");
    expect(matter.intake_source).toBe("Telegram");
  });
});
