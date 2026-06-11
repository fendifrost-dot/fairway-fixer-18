/**
 * Shared branded document constants — W2 letters + W3 weekly update.
 * Tokens from Weekly_Update_Corey_Hunter.docx / directive 2026-06-05.
 */

export const BRAND = {
  name: 'CONTINUUM CAPITAL GROUP',
  tagline: 'Credit Restoration & Consumer Advocacy',
  colors: {
    navy: '1F3864',
    gray: '595959',
    accent: '2E75B6',
    tableAlt: 'F1F4F9',
    border: 'BFBFBF',
    white: 'FFFFFF',
  },
  font: 'Calibri',
  sizes: {
    h1: 36, // 18pt
    h2: 26, // 13pt
    client: 24, // 12pt
    body: 22, // 11pt
    subtitle: 22,
    brand: 28, // 14pt
  },
  page: {
    width: 12240,
    height: 15840,
    marginTop: 1080,
    marginBottom: 1080,
    marginLeft: 1440,
    marginRight: 1440,
    header: 708,
    footer: 708,
  },
  tableWidth: 9360,
  logoSize: 762000, // EMU (~80px square)
} as const;

export const FCRA_STATUTES = {
  reasonableReinvestigation: '15 U.S.C. §1681i(a)(1)',
  deleteUnverifiable: '15 U.S.C. §1681i(a)(5)(A)',
  methodOfVerification: '15 U.S.C. §1681i(a)(6)-(7)',
  maximumAccuracy: '15 U.S.C. §1681e(b)',
  furnisherAccuracy: '15 U.S.C. §1681s-2(a)(1)(A)',
  furnisherCorrection: '15 U.S.C. §1681s-2(a)(2)',
  furnisherReinvestigation: '15 U.S.C. §1681s-2(b)',
  historicalAccuracy: '15 U.S.C. §1681c(a)',
  willfulNoncompliance: '15 U.S.C. §1681n',
  negligentNoncompliance: '15 U.S.C. §1681o',
  fdcpaValidation: '15 U.S.C. §1692g',
  metro2: 'Metro 2 / CDIA format compatibility',
} as const;

export const CASE_LAW = {
  cushman: 'Cushman v. Trans Union, 115 F.3d 220 (3d Cir. 1997)',
  safeco: 'Safeco Ins. Co. v. Burr, 551 U.S. 47 (2007)',
} as const;

export const WEEKLY_ESCALATION_ROWS = [
  {
    step: 'Current Stage',
    action:
      'We are within the bureaus\' and furnishers\' response window for the most recent round of dispute letters. We are monitoring for substantive responses, partial deletions, or boilerplate verification.',
  },
  {
    step: 'Next Action — If Bureaus Respond Substantively',
    action:
      'We will analyze each response against your file, document any remaining inaccuracies, and escalate with method-of-verification demands or furnisher-direct disputes as warranted.',
  },
  {
    step: 'Next Action — If Responses Are Boilerplate or Non-Responsive',
    action:
      'We will escalate to the next tier: CFPB complaint, regulator correspondence, and/or reinsertion/willful-noncompliance framing with preserved evidence from prior rounds.',
  },
] as const;

export const STATUS_SUMMARY_OPENER =
  'Below is your weekly update covering the work completed on your file and the planned next steps now that we are within the bureaus\' and furnishers\' response window for the most recent round of dispute letters. Our position remains that every disputed item on your three credit reports is the product of identity theft, is unverifiable under the Fair Credit Reporting Act, and must be blocked, deleted, or — at minimum — properly reinvestigated.';
