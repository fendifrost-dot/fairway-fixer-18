export interface ParsedInquiry {
  id: string;
  creditor: string;
  inquiry_date: string | null;
  raw_line: string;
  /** Operator sets — null until reviewed */
  dispute_as_unauthorized: boolean | null;
}

const SECTION_END =
  /\n(?:ACCOUNTS|TRADELINES|PUBLIC RECORD|PERSONAL INFORMATION|CREDIT SCORE|EMPLOYMENT|CONSUMER STATEMENT|SUMMARY)/i;

const DATE_CREDITOR_RE =
  /^(\d{1,2}\/\d{1,2}\/\d{2,4}|\d{4}-\d{2}-\d{2})\s+(.+?)\s*$/;

let inquiryIdCounter = 0;

function nextInquiryId() {
  inquiryIdCounter += 1;
  return `inq-${inquiryIdCounter}`;
}

/** Extract hard-inquiry rows from a credit report or bureau paste. */
export function parseInquiriesFromReportText(text: string): ParsedInquiry[] {
  inquiryIdCounter = 0;
  const lower = text.toLowerCase();
  const start = lower.search(/\b(?:hard\s+)?inquiries\b/);
  if (start === -1) return [];

  let section = text.slice(start);
  const endRel = section.slice(120).search(SECTION_END);
  if (endRel > 0) section = section.slice(0, 120 + endRel);

  const lines = section.split('\n').map((l) => l.trim()).filter(Boolean);
  const results: ParsedInquiry[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    if (/^inquir(y|ies)/i.test(line)) continue;
    if (/^date\b/i.test(line) && /company|creditor|name/i.test(line)) continue;

    const m = line.match(DATE_CREDITOR_RE);
    if (!m) continue;

    const creditor = m[2].replace(/\s+/g, ' ').trim();
    if (creditor.length < 2) continue;

    const key = `${m[1]}|${creditor.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);

    results.push({
      id: nextInquiryId(),
      creditor,
      inquiry_date: m[1],
      raw_line: line,
      dispute_as_unauthorized: null,
    });
  }

  return results;
}

export function flaggedUnauthorizedInquiries(inquiries: ParsedInquiry[]) {
  return inquiries.filter((i) => i.dispute_as_unauthorized === true);
}
