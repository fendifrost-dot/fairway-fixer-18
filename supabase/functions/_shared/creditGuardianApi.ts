/**
 * Shared handler for cross-project-api and control-center-api (alias).
 * Auth: x-api-key === CREDIT_GUARDIAN_KEY. Uses service role.
 */
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type, authorization",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type EventSourceEnum =
  | "Experian"
  | "TransUnion"
  | "Equifax"
  | "Innovis"
  | "LexisNexis"
  | "Sagestream"
  | "CoreLogic"
  | "ChexSystems"
  | "EWS"
  | "NCTUE"
  | "CFPB"
  | "BBB"
  | "AG"
  | "FTC"
  | "Creditor"
  | "Other";

function mapBureau(raw: unknown): EventSourceEnum | null {
  if (raw == null || raw === "") return null;
  const s = String(raw).toLowerCase().trim();
  const map: Record<string, EventSourceEnum> = {
    experian: "Experian",
    transunion: "TransUnion",
    tu: "TransUnion",
    equifax: "Equifax",
    innovis: "Innovis",
    lexisnexis: "LexisNexis",
    sagestream: "Sagestream",
    corelogic: "CoreLogic",
    chexsystems: "ChexSystems",
    ews: "EWS",
    nctue: "NCTUE",
    cfpb: "CFPB",
    bbb: "BBB",
    ag: "AG",
    ftc: "FTC",
    creditor: "Creditor",
    other: "Other",
  };
  return map[s] ?? null;
}

function mapGeminiEventToRow(
  e: Record<string, unknown>,
  clientId: string,
  driveFolderLabel: string
): Record<string, unknown> {
  const desc = String(e.description ?? e.summary ?? "Imported event").slice(0, 2000);
  const file = String(e.source_file ?? e.sourceFile ?? "unknown-file");
  const rawLine = `[Drive import ${driveFolderLabel}] ${file}\n${desc}`.slice(0, 12000);

  const eventType = String(e.event_type ?? e.eventType ?? "other").toLowerCase();
  let event_kind = "action";
  let category: "Action" | "Response" | "Outcome" | "Note" = "Action";

  if (
    eventType.includes("response") ||
    eventType.includes("received") ||
    eventType.includes("bureau_response")
  ) {
    event_kind = "response";
    category = "Response";
  } else if (
    eventType.includes("outcome") ||
    eventType.includes("removed") ||
    eventType.includes("deleted") ||
    eventType.includes("score")
  ) {
    event_kind = "outcome";
    category = "Outcome";
  } else if (eventType.includes("note") || eventType === "other") {
    event_kind = "note";
    category = "Note";
  }

  let event_date: string | null = null;
  let date_is_unknown = true;
  const d = e.date ?? e.event_date;
  if (d && String(d).toLowerCase() !== "unknown") {
    const parsed = String(d).slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(parsed)) {
      event_date = parsed;
      date_is_unknown = false;
    }
  }

  const source = mapBureau(e.bureau ?? e.Bureau) ?? ("Other" as EventSourceEnum);

  const title = desc.length > 120 ? `${desc.slice(0, 117)}...` : desc;

  return {
    client_id: clientId,
    event_date,
    date_is_unknown,
    category,
    source,
    title,
    summary: desc.slice(0, 2000),
    details: JSON.stringify(e).slice(0, 8000),
    raw_line: rawLine,
    event_kind,
    is_draft: false,
    related_accounts: null,
  };
}

export async function handleCreditGuardianRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("CREDIT_GUARDIAN_KEY");

  if (!expectedKey || apiKey !== expectedKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  const supabase: SupabaseClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  );

  let raw: Record<string, unknown>;
  try {
    raw = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const action = raw.action as string | undefined;
  const params = (raw.params as Record<string, unknown> | undefined) ?? {};

  const clientIdFromBody = (raw.client_id ?? params.client_id) as string | undefined;

  if (!action) {
    return json({ error: "action required" }, 400);
  }

  const p = params;

  if (action === "get_clients") {
    const { data, error } = await supabase
      .from("clients")
      .select("id, legal_name, preferred_name, email, phone, status, created_at, updated_at")
      .order("created_at", { ascending: false });
    return json({ data, error });
  }

  if (action === "get_client_detail") {
    const clientId = (p.client_id as string) || clientIdFromBody;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const [client, matters, events, tasks] = await Promise.all([
      supabase.from("clients").select("*").eq("id", clientId).single(),
      supabase.from("matters").select("*").eq("client_id", clientId),
      supabase
        .from("timeline_events")
        .select("*")
        .eq("client_id", clientId)
        .order("event_date", { ascending: false })
        .limit(50),
      supabase.from("operator_tasks").select("*").eq("client_id", clientId),
    ]);

    return json({
      client: client.data,
      matters: matters.data,
      events: events.data,
      tasks: tasks.data,
      errors: {
        client: client.error,
        matters: matters.error,
        events: events.error,
        tasks: tasks.error,
      },
    });
  }

  if (action === "update_client_record") {
    const clientId = (p.client_id as string) || clientIdFromBody;
    const fields = p.fields as Record<string, unknown> | undefined;
    if (!clientId || !fields) {
      return json({ error: "client_id and fields required" }, 400);
    }
    const allowed = ["legal_name", "preferred_name", "email", "phone", "status", "notes"];
    const safe: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) {
      if (allowed.includes(k)) safe[k] = fields[k];
    }
    if (Object.keys(safe).length === 0) {
      return json({ error: "No valid fields provided" }, 400);
    }
    const { data, error } = await supabase.from("clients").update(safe).eq("id", clientId).select().single();
    return json({ data, error });
  }

  if (action === "get_documents") {
    const clientId = (p.client_id as string) || clientIdFromBody;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const { data: matterRows } = await supabase.from("matters").select("id").eq("client_id", clientId);
    const ids = (matterRows ?? []).map((m: { id: string }) => m.id);
    if (ids.length === 0) return json({ actions: [], responses: [] });

    const [actions, responses] = await Promise.all([
      supabase
        .from("actions")
        .select("id, matter_id, action_type, summary, attachment_url, action_date")
        .in("matter_id", ids)
        .not("attachment_url", "is", null),
      supabase
        .from("responses")
        .select("id, matter_id, response_type, summary, attachment_url, received_date")
        .in("matter_id", ids)
        .not("attachment_url", "is", null),
    ]);
    return json({ actions: actions.data, responses: responses.data });
  }

  if (action === "get_recent_activity") {
    const limit = Math.min(Number(p.limit ?? raw.limit ?? 25) || 25, 100);
    const scopeClientId = (p.client_id as string) || clientIdFromBody;

    let q = supabase
      .from("timeline_events")
      .select("id, client_id, event_date, category, source, summary, title, event_kind, created_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (scopeClientId) {
      q = q.eq("client_id", scopeClientId);
    }

    const { data, error } = await q;
    return json({ data, error, scoped_to_client_id: scopeClientId ?? null });
  }

  if (action === "import_timeline_events") {
    const clientName = String(raw.client_name ?? "").trim();
    const eventsIn = Array.isArray(raw.events) ? raw.events : [];
    if (!clientName) {
      return json({ error: "client_name required" }, 400);
    }
    if (eventsIn.length === 0) {
      return json({ imported_count: 0, message: "no events" });
    }

    const esc = (s: string) => s.replace(/[%_\\]/g, "\\$&");
    const { data: exactRows, error: findErr } = await supabase
      .from("clients")
      .select("id, legal_name")
      .ilike("legal_name", esc(clientName))
      .limit(10);

    if (findErr) {
      return json({ error: findErr.message }, 500);
    }

    const lower = clientName.toLowerCase();
    let clientRow =
      (exactRows ?? []).find((c) => (c.legal_name as string).trim().toLowerCase() === lower) ??
      (exactRows ?? [])[0];

    if (!clientRow) {
      const { data: fuzzy } = await supabase
        .from("clients")
        .select("id, legal_name")
        .ilike("legal_name", `%${esc(clientName)}%`)
        .limit(1);
      clientRow = fuzzy?.[0];
    }

    if (!clientRow) {
      const ownerId = Deno.env.get("CREDIT_GUARDIAN_DEFAULT_OWNER_ID");
      if (!ownerId) {
        return json(
          {
            error: `No client matching "${clientName}". Create the client in Fairway Fixer first, or set CREDIT_GUARDIAN_DEFAULT_OWNER_ID for auto-create.`,
          },
          404
        );
      }
      const { data: created, error: insErr } = await supabase
        .from("clients")
        .insert({
          legal_name: clientName,
          owner_id: ownerId,
          status: "Active",
        })
        .select("id")
        .single();
      if (insErr || !created) {
        return json({ error: insErr?.message ?? "insert failed" }, 500);
      }
      clientRow = created;
    }

    const clientId = clientRow.id as string;
    const rows = (eventsIn as Record<string, unknown>[]).map((ev) =>
      mapGeminiEventToRow(ev, clientId, clientName)
    );

    const { data: inserted, error: insErr } = await supabase.from("timeline_events").insert(rows).select("id");
    if (insErr) {
      return json({ error: insErr.message, partial: false }, 500);
    }
    return json({
      imported_count: inserted?.length ?? rows.length,
      client_id: clientId,
      event_ids: (inserted ?? []).map((r: { id: string }) => r.id),
    });
  }

  return json({ error: "Unknown action", hint: "Supported: get_clients, get_client_detail, update_client_record, get_documents, get_recent_activity, import_timeline_events" }, 400);
}
