import { createClient } from "https://esm.sh/@supabase/supabase-js@2.91.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // Authenticate via shared secret
  const apiKey = req.headers.get("x-api-key");
  const expectedKey = Deno.env.get("CREDIT_GUARDIAN_KEY");
  if (!expectedKey || apiKey !== expectedKey) {
    return json({ error: "Unauthorized" }, 401);
  }

  // Service-role client bypasses RLS for cross-project access
  const supabase = createClient(
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

  let body: {
    action?: string;
    params?: Record<string, unknown>;
    client_name?: string;
    events?: any[];
    accounts?: any[];
    report?: any;
    response?: any;
    summary?: any;
    score?: any;
  };
  try {
    body = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const { action, params } = body;

  // ── 1. get_clients ──────────────────────────────────────────────
  if (action === "get_clients") {
    const { data, error } = await supabase
      .from("clients")
      .select(
        "id, legal_name, preferred_name, email, phone, status, created_at, updated_at, equifax_score, experian_score, transunion_score, dispute_count, active_disputes"
      )
      .order("created_at", { ascending: false });

    return json({ data, error });
  }

  // ── 2. get_client_detail ────────────────────────────────────────
  if (action === "get_client_detail") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const [client, matters, events, tasks, accounts, scoreHistory, creditReports, bureauResponses, summaries] =
      await Promise.all([
        supabase.from("clients").select("*").eq("id", clientId).single(),
        supabase.from("matters").select("*").eq("client_id", clientId),
        supabase
          .from("timeline_events")
          .select("*")
          .eq("client_id", clientId)
          .order("event_date", { ascending: false })
          .limit(50),
        supabase.from("operator_tasks").select("*").eq("client_id", clientId),
        supabase
          .from("client_accounts")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false }),
        supabase
          .from("score_history")
          .select("*")
          .eq("client_id", clientId)
          .order("score_date", { ascending: false })
          .limit(30),
        supabase
          .from("credit_reports")
          .select("*")
          .eq("client_id", clientId)
          .order("report_date", { ascending: false })
          .limit(10),
        supabase
          .from("bureau_responses")
          .select("*")
          .eq("client_id", clientId)
          .order("response_date", { ascending: false })
          .limit(20),
        supabase
          .from("client_summaries")
          .select("*")
          .eq("client_id", clientId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    return json({
      client: client.data,
      matters: matters.data,
      events: events.data,
      tasks: tasks.data,
      accounts: accounts.data,
      score_history: scoreHistory.data,
      credit_reports: creditReports.data,
      bureau_responses: bureauResponses.data,
      summaries: summaries.data,
      errors: {
        client: client.error,
        matters: matters.error,
        events: events.error,
        tasks: tasks.error,
        accounts: accounts.error,
        score_history: scoreHistory.error,
        credit_reports: creditReports.error,
        bureau_responses: bureauResponses.error,
        summaries: summaries.error,
      },
    });
  }

  // ── 3. update_client_record ─────────────────────────────────────
  if (action === "update_client_record") {
    const p = params as Record<string, unknown> | undefined;
    const clientId = p?.client_id as string;
    const fields = p?.fields as Record<string, unknown> | undefined;

    if (!clientId || !fields) {
      return json({ error: "client_id and fields required" }, 400);
    }

    const allowed = [
      "legal_name", "preferred_name", "email", "phone", "status", "notes",
      "ssn_last4", "date_of_birth", "address_line1", "address_line2",
      "city", "state", "zip_code", "equifax_score", "experian_score",
      "transunion_score", "scores_updated_at", "dispute_count",
      "active_disputes", "last_report_date", "intake_date",
    ];

    const safe: Record<string, unknown> = {};
    for (const k of Object.keys(fields)) {
      if (allowed.includes(k)) safe[k] = fields[k];
    }

    if (Object.keys(safe).length === 0) {
      return json({ error: "No valid fields provided" }, 400);
    }

    const { data, error } = await supabase
      .from("clients")
      .update(safe)
      .eq("id", clientId)
      .select()
      .single();

    return json({ data, error });
  }

  // ── 4. get_documents ────────────────────────────────────────────
  if (action === "get_documents") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const { data: matterRows } = await supabase
      .from("matters")
      .select("id")
      .eq("client_id", clientId);

    const ids = (matterRows ?? []).map((m: { id: string }) => m.id);
    if (ids.length === 0) return json({ actions: [], responses: [] });

    const [actions, responses] = await Promise.all([
      supabase
        .from("actions")
        .select(
          "id, matter_id, action_type, summary, attachment_url, action_date"
        )
        .in("matter_id", ids)
        .not("attachment_url", "is", null),
      supabase
        .from("responses")
        .select(
          "id, matter_id, response_type, summary, attachment_url, received_date"
        )
        .in("matter_id", ids)
        .not("attachment_url", "is", null),
    ]);

    return json({ actions: actions.data, responses: responses.data });
  }

  // ── 5. get_recent_activity ──────────────────────────────────────
  if (action === "get_recent_activity") {
    const limit =
      ((params as Record<string, unknown>)?.limit as number) ?? 25;
    const { data, error } = await supabase
      .from("timeline_events")
      .select(
        "id, client_id, event_date, category, source, summary, title, event_kind, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(Math.min(limit, 100));

    return json({ data, error });
  }

  // ── 6. import_timeline_events ───────────────────────────────────
  if (action === "import_timeline_events") {
    const clientName = body.client_name;
    const events = body.events;

    if (!clientName || !Array.isArray(events) || events.length === 0) {
      return json(
        { error: "client_name and non-empty events array required" },
        400
      );
    }

    let clientId: string;
    const { data: existingClient } = await supabase
      .from("clients")
      .select("id")
      .ilike("legal_name", clientName)
      .maybeSingle();

    if (existingClient) {
      clientId = existingClient.id;
    } else {
      const { data: byPreferred } = await supabase
        .from("clients")
        .select("id")
        .ilike("preferred_name", clientName)
        .maybeSingle();

      if (byPreferred) {
        clientId = byPreferred.id;
      } else {
        const { data: newClient, error: createErr } = await supabase
          .from("clients")
          .insert({
            legal_name: clientName,
            preferred_name: clientName,
            status: "active",
          })
          .select("id")
          .single();
        if (createErr)
          return json(
            { error: `Failed to create client: ${createErr.message}` },
            500
          );
        clientId = newClient.id;
      }
    }

    const validCategories = ["Action", "Note", "Outcome", "Response"];
    const validSources = [
      "AG", "BBB", "CFPB", "ChexSystems", "CoreLogic", "Creditor",
      "Equifax", "EWS", "Experian", "FTC", "Innovis", "LexisNexis",
      "NCTUE", "Other", "Sagestream", "TransUnion",
    ];

    const rows = events.map((e: any) => {
      const rawCategory =
        e.category ||
        (e.event_type?.includes("response")
          ? "Response"
          : e.event_type?.includes("dispute")
            ? "Action"
            : "Note");
      const rawSource = e.bureau || e.source || "Other";
      const dateIsUnknown = !e.date || e.date === "unknown";

      return {
        client_id: clientId,
        event_date: dateIsUnknown ? null : e.date,
        event_kind: e.event_type || e.event_kind || "other",
        category: validCategories.includes(rawCategory) ? rawCategory : "Note",
        source: validSources.includes(rawSource) ? rawSource : "Other",
        summary: e.description || e.summary || "",
        title:
          e.account_name || e.description?.slice(0, 80) || "Imported Event",
        date_is_unknown: dateIsUnknown,
        raw_line:
          e.raw_line ||
          e.description ||
          e.summary ||
          "Imported from Control Center",
        is_draft: true,
      };
    });

    let importedCount = 0;
    const errors: string[] = [];
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50);
      const { error: insertErr } = await supabase
        .from("timeline_events")
        .insert(batch);
      if (insertErr) {
        errors.push(`Batch ${Math.floor(i / 50) + 1}: ${insertErr.message}`);
      } else {
        importedCount += batch.length;
      }
    }

    return json({
      imported_count: importedCount,
      total_events: events.length,
      client_id: clientId,
      client_name: clientName,
      errors: errors.length > 0 ? errors : undefined,
    });
  }

  // ── 7. get_client_accounts ──────────────────────────────────────
  if (action === "get_client_accounts") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const bureau = (params as Record<string, unknown>)?.bureau as string;
    let query = supabase
      .from("client_accounts")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (bureau) query = query.eq("bureau", bureau);

    const { data, error } = await query;
    return json({ data, error });
  }

  // ── 8. upsert_client_accounts ───────────────────────────────────
  if (action === "upsert_client_accounts") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    const accounts = body.accounts;

    if (!clientId || !Array.isArray(accounts) || accounts.length === 0) {
      return json({ error: "client_id and non-empty accounts array required" }, 400);
    }

    const rows = accounts.map((a: any) => ({
      client_id: clientId,
      creditor_name: a.creditor_name,
      account_number: a.account_number || null,
      account_type: a.account_type || null,
      balance: a.balance ?? null,
      credit_limit: a.credit_limit ?? null,
      payment_status: a.payment_status || null,
      date_opened: a.date_opened || null,
      reported_date: a.reported_date || null,
      bureau: a.bureau || null,
      dispute_status: a.dispute_status || "none",
      dispute_reason: a.dispute_reason || null,
      dispute_date: a.dispute_date || null,
      dispute_result: a.dispute_result || null,
      notes: a.notes || null,
      is_negative: a.is_negative ?? false,
    }));

    const { data, error } = await supabase
      .from("client_accounts")
      .upsert(rows, { onConflict: "id" })
      .select();

    return json({ data, error, upserted_count: data?.length ?? 0 });
  }

  // ── 9. get_score_history ────────────────────────────────────────
  if (action === "get_score_history") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const { data, error } = await supabase
      .from("score_history")
      .select("*")
      .eq("client_id", clientId)
      .order("score_date", { ascending: false })
      .limit(60);

    return json({ data, error });
  }

  // ── 10. add_score_entry ─────────────────────────────────────────
  if (action === "add_score_entry") {
    const s = body.score;
    if (!s?.client_id || !s?.bureau || !s?.score || !s?.score_date) {
      return json({ error: "score object with client_id, bureau, score, score_date required" }, 400);
    }

    const { data, error } = await supabase
      .from("score_history")
      .upsert(
        {
          client_id: s.client_id,
          bureau: s.bureau,
          score: s.score,
          score_date: s.score_date,
          source: s.source || "manual",
        },
        { onConflict: "client_id,bureau,score_date" }
      )
      .select()
      .single();

    // Also update the client's current score
    const scoreField =
      s.bureau === "Equifax"
        ? "equifax_score"
        : s.bureau === "Experian"
          ? "experian_score"
          : "transunion_score";

    await supabase
      .from("clients")
      .update({
        [scoreField]: s.score,
        scores_updated_at: new Date().toISOString(),
      })
      .eq("id", s.client_id);

    return json({ data, error });
  }

  // ── 11. get_credit_reports ──────────────────────────────────────
  if (action === "get_credit_reports") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const bureau = (params as Record<string, unknown>)?.bureau as string;
    let query = supabase
      .from("credit_reports")
      .select("*")
      .eq("client_id", clientId)
      .order("report_date", { ascending: false });

    if (bureau) query = query.eq("bureau", bureau);

    const { data, error } = await query.limit(10);
    return json({ data, error });
  }

  // ── 12. save_credit_report ──────────────────────────────────────
  if (action === "save_credit_report") {
    const r = body.report;
    if (!r?.client_id || !r?.report_date || !r?.bureau) {
      return json({ error: "report object with client_id, report_date, bureau required" }, 400);
    }

    // Find most recent previous report for diff
    const { data: prevReports } = await supabase
      .from("credit_reports")
      .select("id")
      .eq("client_id", r.client_id)
      .eq("bureau", r.bureau)
      .order("report_date", { ascending: false })
      .limit(1);

    const previousReportId = prevReports?.[0]?.id || null;

    const { data, error } = await supabase
      .from("credit_reports")
      .insert({
        client_id: r.client_id,
        report_date: r.report_date,
        bureau: r.bureau,
        source_file_url: r.source_file_url || null,
        source_file_name: r.source_file_name || null,
        parsed_data: r.parsed_data || null,
        score_at_report: r.score_at_report ?? null,
        account_count: r.account_count ?? 0,
        negative_count: r.negative_count ?? 0,
        inquiry_count: r.inquiry_count ?? 0,
        analysis_result: r.analysis_result || null,
        previous_report_id: previousReportId,
        diff_summary: r.diff_summary || null,
      })
      .select()
      .single();

    // Update client's last_report_date
    if (!error) {
      await supabase
        .from("clients")
        .update({ last_report_date: r.report_date })
        .eq("id", r.client_id);
    }

    return json({ data, error, previous_report_id: previousReportId });
  }

  // ── 13. get_bureau_responses ────────────────────────────────────
  if (action === "get_bureau_responses") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const bureau = (params as Record<string, unknown>)?.bureau as string;
    let query = supabase
      .from("bureau_responses")
      .select("*")
      .eq("client_id", clientId)
      .order("response_date", { ascending: false });

    if (bureau) query = query.eq("bureau", bureau);

    const { data, error } = await query.limit(20);
    return json({ data, error });
  }

  // ── 14. save_bureau_response ────────────────────────────────────
  if (action === "save_bureau_response") {
    const r = body.response;
    if (!r?.client_id || !r?.bureau || !r?.response_date) {
      return json({ error: "response object with client_id, bureau, response_date required" }, 400);
    }

    const violations = r.violations_detected || [];
    const { data, error } = await supabase
      .from("bureau_responses")
      .insert({
        client_id: r.client_id,
        bureau: r.bureau,
        response_date: r.response_date,
        response_type: r.response_type || "investigation_results",
        source_file_url: r.source_file_url || null,
        source_file_name: r.source_file_name || null,
        items_disputed: r.items_disputed ?? 0,
        items_deleted: r.items_deleted ?? 0,
        items_updated: r.items_updated ?? 0,
        items_verified: r.items_verified ?? 0,
        violations_detected: violations,
        violation_count: violations.length,
        analysis_result: r.analysis_result || null,
        follow_up_action: r.follow_up_action || null,
      })
      .select()
      .single();

    return json({ data, error });
  }

  // ── 15. get_client_summaries ────────────────────────────────────
  if (action === "get_client_summaries") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const summaryType = (params as Record<string, unknown>)?.summary_type as string;
    let query = supabase
      .from("client_summaries")
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });

    if (summaryType) query = query.eq("summary_type", summaryType);

    const { data, error } = await query.limit(10);
    return json({ data, error });
  }

  // ── 16. save_client_summary ─────────────────────────────────────
  if (action === "save_client_summary") {
    const s = body.summary;
    if (!s?.client_id || !s?.summary_type || !s?.title || !s?.content) {
      return json({ error: "summary object with client_id, summary_type, title, content required" }, 400);
    }

    const { data, error } = await supabase
      .from("client_summaries")
      .insert({
        client_id: s.client_id,
        summary_type: s.summary_type,
        title: s.title,
        content: s.content,
        generated_by: s.generated_by || "ai",
        metadata: s.metadata || null,
      })
      .select()
      .single();

    return json({ data, error });
  }

  // ── 17. get_dispute_stats ───────────────────────────────────────
  if (action === "get_dispute_stats") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const [accounts, responses] = await Promise.all([
      supabase
        .from("client_accounts")
        .select("dispute_status, is_negative, bureau")
        .eq("client_id", clientId),
      supabase
        .from("bureau_responses")
        .select("bureau, items_disputed, items_deleted, items_updated, items_verified, violation_count")
        .eq("client_id", clientId),
    ]);

    const accts = accounts.data || [];
    const resps = responses.data || [];

    const stats = {
      total_accounts: accts.length,
      negative_accounts: accts.filter((a: any) => a.is_negative).length,
      disputed_accounts: accts.filter((a: any) => a.dispute_status !== "none").length,
      resolved_accounts: accts.filter((a: any) => ["resolved", "deleted"].includes(a.dispute_status)).length,
      pending_accounts: accts.filter((a: any) => ["pending", "in_progress"].includes(a.dispute_status)).length,
      total_responses: resps.length,
      total_items_deleted: resps.reduce((sum: number, r: any) => sum + (r.items_deleted || 0), 0),
      total_items_updated: resps.reduce((sum: number, r: any) => sum + (r.items_updated || 0), 0),
      total_violations: resps.reduce((sum: number, r: any) => sum + (r.violation_count || 0), 0),
      by_bureau: {} as Record<string, any>,
    };

    for (const bureau of ["Equifax", "Experian", "TransUnion"]) {
      const bAccts = accts.filter((a: any) => a.bureau === bureau);
      const bResps = resps.filter((r: any) => r.bureau === bureau);
      stats.by_bureau[bureau] = {
        accounts: bAccts.length,
        negative: bAccts.filter((a: any) => a.is_negative).length,
        disputed: bAccts.filter((a: any) => a.dispute_status !== "none").length,
        deleted: bResps.reduce((s: number, r: any) => s + (r.items_deleted || 0), 0),
        violations: bResps.reduce((s: number, r: any) => s + (r.violation_count || 0), 0),
      };
    }

    return json({ stats });
  }

  // ── 18. get_bureau_narrative ─────────────────────────────────────
  // Returns timeline events grouped by bureau for narrative view
  if (action === "get_bureau_narrative") {
    const clientId = (params as Record<string, unknown>)?.client_id as string;
    if (!clientId) return json({ error: "client_id required" }, 400);

    const bureau = (params as Record<string, unknown>)?.bureau as string;

    const [events, responses, accounts] = await Promise.all([
      supabase
        .from("timeline_events")
        .select("*")
        .eq("client_id", clientId)
        .eq("source", bureau || "Equifax")
        .order("event_date", { ascending: true }),
      supabase
        .from("bureau_responses")
        .select("*")
        .eq("client_id", clientId)
        .eq("bureau", bureau || "Equifax")
        .order("response_date", { ascending: true }),
      supabase
        .from("client_accounts")
        .select("*")
        .eq("client_id", clientId)
        .eq("bureau", bureau || "Equifax"),
    ]);

    return json({
      bureau: bureau || "Equifax",
      events: events.data,
      responses: responses.data,
      accounts: accounts.data,
    });
  }

  return json({ error: "Unknown action" }, 400);
});
