/**
 * Deterministic "maximum-strength" dispute-letter building blocks.
 *
 * Per the Credit Guardian letter-quality handoff (§3 drop-in blocks, §5 case-law
 * library, §4 scenario→statute matrix, §8 architecture): keep statute and case
 * citations as FIXED strings selected by scenario_type so the operative legal
 * text never drifts when an LLM fills the connective sentences around it.
 *
 * The one overriding rule (§0): match the basis to the truth. Identity-theft
 * framing (data-breach paragraph, §605B block) is ONLY valid when the file
 * supports identity theft. The `cra_reinsertion_or_accuracy` scenario MUST NOT
 * assert identity theft — see `allowsIdentityTheftFraming`.
 */

export type ScenarioType =
  | "cra_account_idtheft" // fraudulent tradeline on a bureau (FTC report on file)
  | "cra_inquiry" // unauthorized hard inquiry on a bureau
  | "furnisher" // data furnisher (e.g., Goldman Sachs / Apple Card)
  | "cra_reinsertion_or_accuracy"; // item may be the consumer's but is inaccurate / re-added

export const ALL_SCENARIO_TYPES: ScenarioType[] = [
  "cra_account_idtheft",
  "cra_inquiry",
  "furnisher",
  "cra_reinsertion_or_accuracy",
];

export function isScenarioType(v: unknown): v is ScenarioType {
  return typeof v === "string" && (ALL_SCENARIO_TYPES as string[]).includes(v);
}

/**
 * §0 / §7 guardrail. Identity-theft framing is unlawful when untrue — never
 * available for the accuracy/reinsertion path.
 */
export function allowsIdentityTheftFraming(scenario: ScenarioType): boolean {
  return scenario !== "cra_reinsertion_or_accuracy";
}

export function isCraScenario(scenario: ScenarioType): boolean {
  return scenario !== "furnisher";
}

// ---------------------------------------------------------------------------
// §1 / §3 — verbatim drop-in blocks (template these exactly; do NOT paraphrase)
// ---------------------------------------------------------------------------

export const CERTIFIED_MAIL_HEADER = "VIA CERTIFIED MAIL — RETURN RECEIPT REQUESTED";

export const FORMAL_DEMAND_OPENING = "This is a formal demand, not a routine dispute.";

/**
 * Universal data-breach paragraph (§3). Only emit when identity theft is the
 * truthful basis. If specific breaches are documented, the caller may append a
 * naming sentence; otherwise keep generic.
 */
export const DATA_BREACH_PARAGRAPH =
  "I am also the victim of multiple data breaches in which my personal identifying information was exposed. Those breaches are the foreseeable source of the unauthorized activity described in this letter and corroborate that the information disputed here is the product of identity theft, not any transaction initiated or authorized by me.";

/** Liability notice (§3) — §1681n willful + §1681o negligent + preservation. */
export function liabilityNotice(recipientLabel: string): string {
  return `Willful noncompliance with the FCRA exposes ${recipientLabel} to actual damages, statutory damages of $100 to $1,000 per violation, punitive damages, and attorney's fees and costs under 15 U.S.C. § 1681n. Negligent noncompliance carries liability for actual damages, fees, and costs under 15 U.S.C. § 1681o. Every communication on this matter is being preserved for that purpose.`;
}

export const RESERVATION_OF_RIGHTS =
  "I reserve all rights and remedies available to me under federal and state law.";

/** Reinsertion trap (§3) — append to CRA demands. */
export const REINSERTION_TRAP =
  "Should this item ever be reinserted, 15 U.S.C. § 1681i(a)(5)(B) requires written notice to me within five (5) business days and certification by the furnisher of its completeness and accuracy.";

// ---------------------------------------------------------------------------
// §5 — case-law library (real, on-point; cite ONLY what matches the scenario)
// ---------------------------------------------------------------------------

export const CASE_LAW = {
  cushman:
    "Cushman v. Trans Union Corp., 115 F.3d 220 (3d Cir. 1997) — a consumer reporting agency may not rely solely on the furnisher; it must conduct its own reasonable reinvestigation.",
  hinkle:
    "Hinkle v. Midland Credit Mgmt., Inc., 827 F.3d 1295 (11th Cir. 2016) — reinvestigation must be meaningful, not a mechanical parroting of the furnisher's verification.",
  stevenson:
    "Stevenson v. TRW Inc., 987 F.2d 288 (5th Cir. 1993) — a reasonable reinvestigation requires deleting information that cannot be verified.",
  saunders:
    "Saunders v. Branch Banking & Trust Co. of Va., 526 F.3d 142 (4th Cir. 2008) — information that is technically present but materially misleading is still inaccurate.",
} as const;

/** §5 rule: bureau letters → Cushman + Hinkle; furnisher letters → Saunders. */
export function caseLawForScenario(scenario: ScenarioType): string[] {
  if (scenario === "furnisher") return [CASE_LAW.saunders];
  return [CASE_LAW.cushman, CASE_LAW.hinkle];
}

// ---------------------------------------------------------------------------
// §4 — violation matrix: scenario → statutes to stack
// ---------------------------------------------------------------------------

export function statuteStackForScenario(scenario: ScenarioType): string[] {
  switch (scenario) {
    case "cra_account_idtheft":
      return [
        "15 U.S.C. § 1681c-2 (§605B) — block identity-theft information within 4 business days (recite the four elements)",
        "15 U.S.C. § 1681e(b) — maximum possible accuracy",
        "15 U.S.C. § 1681i — reasonable reinvestigation",
        "15 U.S.C. § 1681n / § 1681o — willful and negligent noncompliance",
        "15 U.S.C. § 1681i(a)(5)(B) — reinsertion notice + certification",
      ];
    case "cra_inquiry":
      return [
        "15 U.S.C. § 1681b — permissible purpose (none existed; consumer initiated no transaction)",
        "15 U.S.C. § 1681c-2 (§605B) — block identity-theft inquiry within 4 business days (when identity theft)",
        "15 U.S.C. § 1681n / § 1681o — willful and negligent noncompliance",
      ];
    case "furnisher":
      return [
        "15 U.S.C. § 1681s-2(a)(1)(A) — no furnishing information known or believed to be inaccurate",
        "15 U.S.C. § 1681s-2(a)(6) — cease furnishing once notified the item is identity theft",
        "15 U.S.C. § 1681s-2(b) — reasonable investigation upon CRA notice",
        "15 U.S.C. § 1681n / § 1681o — willful and negligent noncompliance",
      ];
    case "cra_reinsertion_or_accuracy":
      return [
        "15 U.S.C. § 1681i(a)(5)(B) — reinsertion notice + furnisher certification",
        "15 U.S.C. § 1681e(b) — maximum possible accuracy",
        "15 U.S.C. § 1681i — reasonable reinvestigation",
        "15 U.S.C. § 1681n / § 1681o — willful and negligent noncompliance",
      ];
  }
}

/**
 * Controlling-statute quote + running deadline clock (§1 item 4, §6). The clock
 * is expressed as already started on receipt. Only the §605B path carries the
 * 4-business-day clock; other scenarios use the 30-day reinvestigation clock.
 */
export function controllingStatuteQuote(scenario: ScenarioType): string {
  if (scenario === "cra_account_idtheft" || scenario === "cra_inquiry") {
    return 'Under 15 U.S.C. § 1681c-2(a), a consumer reporting agency "shall block the reporting of any information in the file of a consumer that the consumer identifies as information that resulted from an alleged identity theft" not later than four (4) business days after receipt of the required identification, identity-theft report, and statement that the information is not the consumer\'s. The four-business-day clock began upon your receipt of this letter.';
  }
  if (scenario === "furnisher") {
    return 'Upon receiving notice of a dispute from a consumer reporting agency, 15 U.S.C. § 1681s-2(b) provides that a furnisher "shall" conduct an investigation, review all relevant information, and report the results — and modify, delete, or permanently block any information found to be inaccurate, incomplete, or unverifiable. That investigation clock has begun.';
  }
  // cra_reinsertion_or_accuracy
  return 'Under 15 U.S.C. § 1681e(b), a consumer reporting agency "shall follow reasonable procedures to assure maximum possible accuracy" of the information it reports, and under § 1681i it must complete a reasonable reinvestigation within thirty (30) days. That 30-day clock began upon your receipt of this letter.';
}

/** §1 item 8 — the permanent-deletion demand verb. */
export const PERMANENT_DELETION_DEMAND =
  "block and permanently delete the disputed information (not merely suppress or temporarily exclude it)";

export interface ScenarioStrengthBundle {
  scenario: ScenarioType;
  allows_identity_theft: boolean;
  is_cra: boolean;
  certified_mail_header: string;
  formal_demand_opening: string;
  data_breach_paragraph: string | null;
  controlling_statute_quote: string;
  statute_stack: string[];
  case_law: string[];
  liability_notice: string;
  reservation_of_rights: string;
  reinsertion_trap: string | null;
  permanent_deletion_demand: string;
}

/**
 * One call assembles every deterministic block for a scenario, honoring the
 * identity-theft guardrail. `recipientLabel` is spliced into the liability
 * notice (e.g. "Equifax", "Goldman Sachs Bank USA").
 */
export function buildScenarioStrengthBundle(
  scenario: ScenarioType,
  recipientLabel: string,
): ScenarioStrengthBundle {
  const allowsIdTheft = allowsIdentityTheftFraming(scenario);
  const cra = isCraScenario(scenario);
  return {
    scenario,
    allows_identity_theft: allowsIdTheft,
    is_cra: cra,
    certified_mail_header: CERTIFIED_MAIL_HEADER,
    formal_demand_opening: FORMAL_DEMAND_OPENING,
    data_breach_paragraph: allowsIdTheft ? DATA_BREACH_PARAGRAPH : null,
    controlling_statute_quote: controllingStatuteQuote(scenario),
    statute_stack: statuteStackForScenario(scenario),
    case_law: caseLawForScenario(scenario),
    liability_notice: liabilityNotice(recipientLabel || (cra ? "the bureau" : "the furnisher")),
    reservation_of_rights: RESERVATION_OF_RIGHTS,
    reinsertion_trap: cra ? REINSERTION_TRAP : null,
    permanent_deletion_demand: PERMANENT_DELETION_DEMAND,
  };
}
