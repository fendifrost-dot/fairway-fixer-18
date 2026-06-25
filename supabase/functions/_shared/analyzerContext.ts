/**
 * Load structured dispute history + profile for Response Analyzer prompts.
 */
import {
  analyzeTradelineViolations,
  buildAnalyzerStrengthFloor,
  type LetterViolation,
  type StrengthChecklist,
} from "./disputeLetterGenerator.ts";

const MAX_BODY_SNIPPET = 400;

function trimSnippet(text: string, max = MAX_BODY_SNIPPET): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max)}…[truncated]`;
}

export function bureauSourceToDb(source: string): string | null {
  const map: Record<string, string> = {
    Experian: "experian",
    Equifax: "equifax",
    TransUnion: "transunion",
  };
  return map[source] ?? null;
}

export interface ProfileTradeline {
  id: string;
  furnisher_raw: string;
  account_mask: string | null;
  date_opened: string | null;
  operator_disputed: boolean;
  states: {
    bureau: string;
    present: boolean;
    absent_in_latest: boolean;
    status_on_bureau: string | null;
    balance: number | null;
    pay_status: string | null;
    account_status: string | null;
    two_year_payment_grid: { month: string; status: string }[];
  }[];
  reinsertion_signal: boolean;
}

export interface AnalyzerHistoryDigest {
  prior_round_count: number;
  prior_round_exists: boolean;
  dispute_rounds: { round_number: number; started_at: string | null; status: string }[];
  prior_letters: {
    letter_type: string;
    recipient_name: string;
    status: string;
    created_at: string;
    body_snippet: string;
  }[];
  bureau_responses: {
    bureau: string | null;
    response_date: string | null;
    result: string;
    free_text_snippet: string;
  }[];
  ftc_identity_theft_report_number: string | null;
  cfpb_or_ag_tasks: { title: string; status: string; notes: string }[];
  has_verified_without_docs: boolean;
  has_reinsertion_signal: boolean;
}

export interface AnalyzerProfileDigest {
  tradelines: ProfileTradeline[];
  tradeline_violations: LetterViolation[];
  credit_report_violations: LetterViolation[];
  baseline_summary_snippet: string | null;
}

// deno-lint-ignore no-explicit-any
type SupabaseClient = { from: (table: string) => any };

export async function loadAnalyzerContext(
  supabase: SupabaseClient,
  clientId: string,
  bureauSource: string,
): Promise<{
  clientLabel: string;
  ftcReportNumber: string | null;
  history: AnalyzerHistoryDigest;
  profile: AnalyzerProfileDigest;
  strength_floor: StrengthChecklist;
}> {
  const bureauDb = bureauSourceToDb(bureauSource);

  const [
    clientRes,
    roundsRes,
    lettersRes,
    responsesRes,
    tradelinesRes,
    analysisRes,
    tasksRes,
  ] = await Promise.all([
    supabase
      .from("clients")
      .select("legal_name, preferred_name, legal_full_name, ftc_identity_theft_report_number")
      .eq("id", clientId)
      .maybeSingle(),
    supabase
      .from("dispute_rounds")
      .select("round_number, started_at, status")
      .eq("client_id", clientId)
      .order("round_number", { ascending: true }),
    supabase
      .from("dispute_letters")
      .select("letter_type, recipient_name, status, created_at, statutes, body_md")
      .eq("client_id", clientId)
      .order("created_at", { ascending: true })
      .limit(20),
    supabase
      .from("bureau_responses")
      .select("bureau, response_date, result, free_text")
      .eq("client_id", clientId)
      .order("response_date", { ascending: true })
      .limit(30),
    supabase
      .from("tradelines")
      .select(`
        id, furnisher_raw, account_mask, date_opened,
        tradeline_bureau_states (
          bureau, present, absent_in_latest, status_on_bureau, balance,
          pay_status, account_status, two_year_payment_grid, operator_disputed
        )
      `)
      .eq("client_id", clientId),
    supabase
      .from("credit_report_analyses")
      .select("violations, baseline_summary, analyzed_at")
      .eq("client_id", clientId)
      .order("analyzed_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("operator_tasks")
      .select("title, notes, status")
      .eq("client_id", clientId)
      .in("status", ["Open", "Done"])
      .limit(25),
  ]);

  const client = clientRes.data;
  if (!client) {
    throw new Error("CLIENT_NOT_FOUND");
  }
  const clientLabel = [
    client?.preferred_name,
    client?.legal_full_name,
    client?.legal_name,
  ].filter(Boolean).join(" / ") || "Not provided";
  const ftcReportNumber = (client?.ftc_identity_theft_report_number as string | null) ?? null;

  const disputeRounds = (roundsRes.data ?? []) as {
    round_number: number;
    started_at: string | null;
    status: string;
  }[];

  const allLetters = (lettersRes.data ?? []) as {
    letter_type: string;
    recipient_name: string;
    status: string;
    created_at: string;
    body_md: string;
  }[];
  const priorLetters = allLetters
    .filter((l) =>
      !bureauSource ||
      l.recipient_name.toLowerCase().includes(bureauSource.toLowerCase()) ||
      l.letter_type.toLowerCase().includes(bureauSource.toLowerCase())
    )
    .map((l) => ({
      letter_type: l.letter_type,
      recipient_name: l.recipient_name,
      status: l.status,
      created_at: l.created_at,
      body_snippet: trimSnippet(l.body_md ?? ""),
    }));

  const allResponses = (responsesRes.data ?? []) as {
    bureau: string | null;
    response_date: string | null;
    result: string;
    free_text: string | null;
  }[];
  const bureauResponses = allResponses
    .filter((r) => !bureauDb || r.bureau === bureauDb)
    .map((r) => ({
      bureau: r.bureau,
      response_date: r.response_date,
      result: r.result,
      free_text_snippet: trimSnippet(r.free_text ?? ""),
    }));

  const hasVerifiedWithoutDocs = bureauResponses.some(
    (r) => r.result === "verified" && /no.?doc|without doc|unable to provide/i.test(r.free_text_snippet),
  ) || allResponses.some(
    (r) => r.result === "verified" && /no.?doc|without doc|unable to provide/i.test(r.free_text ?? ""),
  );

  const profileTradelines: ProfileTradeline[] = (tradelinesRes.data ?? []).map((tl: Record<string, unknown>) => {
    const states = ((tl.tradeline_bureau_states as Record<string, unknown>[]) ?? []).map((s) => ({
      bureau: String(s.bureau ?? ""),
      present: Boolean(s.present),
      absent_in_latest: Boolean(s.absent_in_latest),
      status_on_bureau: (s.status_on_bureau as string | null) ?? null,
      balance: s.balance as number | null,
      pay_status: (s.pay_status as string | null) ?? null,
      account_status: (s.account_status as string | null) ?? null,
      two_year_payment_grid: (s.two_year_payment_grid as { month: string; status: string }[]) ?? [],
      operator_disputed: Boolean(s.operator_disputed),
    }));
    const bureauStates = bureauDb
      ? states.filter((s) => s.bureau === bureauDb)
      : states;
    const reinsertion_signal = bureauStates.some((s) => s.absent_in_latest) &&
      bureauStates.some((s) => s.present && !s.absent_in_latest);
    return {
      id: tl.id as string,
      furnisher_raw: tl.furnisher_raw as string,
      account_mask: (tl.account_mask as string | null) ?? null,
      date_opened: (tl.date_opened as string | null) ?? null,
      operator_disputed: bureauStates.some((s) => s.operator_disputed),
      states: bureauStates,
      reinsertion_signal,
    };
  });

  const hasReinsertionSignal = profileTradelines.some((t) => t.reinsertion_signal);

  const tradelinesForViolations = profileTradelines.map((tl) => ({
    id: tl.id,
    furnisher_raw: tl.furnisher_raw,
    account_mask: tl.account_mask ?? undefined,
    date_opened: tl.date_opened ?? undefined,
    two_year_payment_grid: tl.states.flatMap((s) => s.two_year_payment_grid),
  }));
  const tradelineViolations = analyzeTradelineViolations(tradelinesForViolations);

  const analysisRow = analysisRes.data as {
    violations?: LetterViolation[];
    baseline_summary?: string | null;
  } | null;
  const creditReportViolations = (analysisRow?.violations ?? []) as LetterViolation[];

  const cfpbOrAgTasks = ((tasksRes.data ?? []) as { title: string; notes: string | null; status: string }[])
    .filter((t) => /cfpb|ag complaint|attorney general|file complaint/i.test(`${t.title} ${t.notes ?? ""}`))
    .map((t) => ({
      title: t.title,
      status: t.status,
      notes: trimSnippet(t.notes ?? "", 200),
    }));

  const priorRoundCount = disputeRounds.length;
  const priorRoundExists = priorRoundCount > 0;

  const history: AnalyzerHistoryDigest = {
    prior_round_count: priorRoundCount,
    prior_round_exists: priorRoundExists,
    dispute_rounds: disputeRounds,
    prior_letters: priorLetters.length > 0 ? priorLetters : allLetters.slice(-5).map((l) => ({
      letter_type: l.letter_type,
      recipient_name: l.recipient_name,
      status: l.status,
      created_at: l.created_at,
      body_snippet: trimSnippet(l.body_md ?? ""),
    })),
    bureau_responses: bureauResponses,
    ftc_identity_theft_report_number: ftcReportNumber,
    cfpb_or_ag_tasks: cfpbOrAgTasks,
    has_verified_without_docs: hasVerifiedWithoutDocs,
    has_reinsertion_signal: hasReinsertionSignal,
  };

  const profile: AnalyzerProfileDigest = {
    tradelines: profileTradelines,
    tradeline_violations: tradelineViolations,
    credit_report_violations: creditReportViolations,
    baseline_summary_snippet: analysisRow?.baseline_summary
      ? trimSnippet(analysisRow.baseline_summary, 600)
      : null,
  };

  const strength_floor = buildAnalyzerStrengthFloor({
    violations: [...tradelineViolations, ...creditReportViolations],
    priorRoundExists: priorRoundExists || priorLetters.length > 0 || bureauResponses.length > 0,
    hasReinsertionSignal,
    hasFtcReport: Boolean(ftcReportNumber),
    evidenceTitles: priorLetters.map((l) => l.letter_type),
  });

  return { clientLabel, ftcReportNumber, history, profile, strength_floor };
}

export function resolveEffectiveLetterMode(
  requested: "initial" | "follow_up",
  history: AnalyzerHistoryDigest,
): "initial" | "follow_up" {
  const hasHistory =
    history.prior_round_exists ||
    history.prior_letters.length > 0 ||
    history.bureau_responses.length > 0;
  if (hasHistory) return "follow_up";
  return requested;
}
