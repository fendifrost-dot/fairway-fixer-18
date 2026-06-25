import { describe, it, expect } from 'vitest';
import { parseInquiriesFromReportText, flaggedUnauthorizedInquiries } from '@/lib/inquiryParse';
import { suggestLetterMode } from '@/lib/letterAnalyzerHelpers';
import type { TimelineEvent } from '@/types/operator';

describe('inquiryParse', () => {
  it('extracts inquiry rows from a report inquiries section', () => {
    const text = `
CREDIT REPORT
INQUIRIES
Date       Company
02/23/26   CHASE BANK USA
02/20/26   NORTHSTAR LOCATION SERVICES
ACCOUNTS
Some account here
`;
    const rows = parseInquiriesFromReportText(text);
    expect(rows).toHaveLength(2);
    expect(rows[0].creditor).toContain('CHASE');
    expect(rows[1].creditor).toContain('NORTHSTAR');
  });

  it('returns empty when no inquiries section', () => {
    expect(parseInquiriesFromReportText('TRADELINES\nFoo bar')).toHaveLength(0);
  });

  it('flags unauthorized inquiries', () => {
    const rows = parseInquiriesFromReportText(`INQUIRIES\n02/23/26 CHASE`);
    const flagged = rows.map((r) => ({ ...r, dispute_as_unauthorized: true }));
    expect(flaggedUnauthorizedInquiries(flagged)).toHaveLength(1);
  });
});

describe('suggestLetterMode', () => {
  const base = (partial: Partial<TimelineEvent>): TimelineEvent => ({
    id: '1',
    client_id: 'c',
    category: 'Action',
    source: 'Experian',
    title: 't',
    summary: 's',
    details: null,
    related_accounts: null,
    event_date: null,
    created_at: '2025-01-01',
    ...partial,
  });

  it('suggests initial when no evidence for source', () => {
    expect(suggestLetterMode([], 'Experian')).toBe('initial');
  });

  it('suggests follow_up when response exists for source', () => {
    const events = [base({ event_kind: 'response', source: 'Experian' })];
    expect(suggestLetterMode(events, 'Experian')).toBe('follow_up');
  });
});
