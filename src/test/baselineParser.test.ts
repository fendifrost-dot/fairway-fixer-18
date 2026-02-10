import { describe, it, expect } from 'vitest';
import { parseBaselineText } from '@/lib/baselineParser';

describe('baselineParser', () => {
  // ── Bureau & Section Detection ──

  describe('bureau and section detection', () => {
    it('parses bureau headers with ## prefix', () => {
      const input = `## Experian
Addresses
123 Main St - Apt 4 - Reported 2024
## TransUnion
Addresses
456 Oak Ave - Unit B - Reported 2023`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].bureau).toBe('Experian');
      expect(result.items[1].bureau).toBe('TransUnion');
    });

    it('parses bureau headers without prefix', () => {
      const input = `Experian
Addresses
123 Main St - Apt 4 - Reported 2024`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].bureau).toBe('Experian');
    });

    it('resets section on new bureau', () => {
      const input = `## Experian
Addresses
123 Main St - extra - info
## Equifax
some orphan line`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.warnings.some(w => w.reason === 'No bureau or section context')).toBe(true);
    });

    it('warns for lines before any bureau/section', () => {
      const input = `random line before context
## Experian
Accounts
Bank - 1234 - 2020-01-01`;
      const result = parseBaselineText(input);
      expect(result.warnings[0].reason).toBe('No bureau or section context');
      expect(result.items).toHaveLength(1);
    });
  });

  // ── Dash-Delimited Format ──

  describe('dash-delimited format', () => {
    it('parses address lines', () => {
      const input = `## Experian
Addresses
123 Main St - Apt 4 - Reported 2024`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].item_type).toBe('address');
      expect(result.items[0].raw_fields.address).toBe('123 Main St');
    });

    it('parses inquiry lines (3-part)', () => {
      const input = `## TransUnion
Inquiries
ABC Bank - 01/15/2024 - Hard Pull`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].item_type).toBe('inquiry');
      expect(result.items[0].raw_fields.subscriber).toBe('ABC Bank');
      expect(result.items[0].raw_fields.date_inquired).toBe('01/15/2024');
    });

    it('parses inquiry lines (2-part, most common)', () => {
      const input = `## Experian
Inquiries
ABC Bank - 01/15/2024`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].item_type).toBe('inquiry');
      expect(result.items[0].raw_fields.subscriber).toBe('ABC Bank');
      expect(result.items[0].raw_fields.date_inquired).toBe('01/15/2024');
    });

    it('parses account lines (4-part)', () => {
      const input = `## Equifax
Accounts
Chase Bank - ****1234 - 2020-05-10 - Open`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].item_type).toBe('account');
      expect(result.items[0].raw_fields.furnisher).toBe('Chase Bank');
      expect(result.items[0].raw_fields.account_mask).toBe('****1234');
      expect(result.items[0].raw_fields.date_opened).toBe('2020');
    });

    it('parses account lines (2-part, most common)', () => {
      const input = `## Equifax
Accounts
PNC BANK - 448915XXXXXX`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].item_type).toBe('account');
      expect(result.items[0].raw_fields.furnisher).toBe('PNC BANK');
      expect(result.items[0].raw_fields.account_mask).toBe('448915XXXXXX');
      expect(result.items[0].label).toBe('PNC BANK (448915XXXXXX)');
    });
  });

  // ── Pipe-Delimited Format ──

  describe('pipe-delimited format', () => {
    it('parses address lines', () => {
      const input = `## Experian
Addresses
123 Main St | Apt 4 | Reported 2024`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].raw_fields.address).toBe('123 Main St');
    });

    it('parses inquiry lines (2-part pipe)', () => {
      const input = `## Experian
Inquiries
ABC Bank | 01/15/2024`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].raw_fields.subscriber).toBe('ABC Bank');
      expect(result.items[0].raw_fields.date_inquired).toBe('01/15/2024');
    });

    it('parses inquiry lines (3-part pipe)', () => {
      const input = `## Experian
Inquiries
ABC Bank | 01/15/2024 | Hard Pull`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].raw_fields.subscriber).toBe('ABC Bank');
    });

    it('parses account lines (pipe)', () => {
      const input = `## Equifax
Accounts
Chase Bank | ****1234 | 2020-05-10 | Open`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].raw_fields.furnisher).toBe('Chase Bank');
      expect(result.items[0].raw_fields.account_mask).toBe('****1234');
      expect(result.items[0].raw_fields.date_opened).toBe('2020-05-10');
    });
  });

  // ── Single-line Addresses ──

  describe('single-line addresses', () => {
    it('parses a plain address with no delimiter', () => {
      const input = `## Experian
Addresses
742 Evergreen Terrace`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.items[0].item_type).toBe('address');
      expect(result.items[0].label).toBe('742 Evergreen Terrace');
    });
  });

  // ── Fingerprint Stability ──

  describe('fingerprint stability', () => {
    it('address fingerprint is case and whitespace invariant', () => {
      const input = `## Experian
Addresses
123  Main  ST - extra - info
123 main st - extra - info`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.warnings.some(w => w.reason === 'Duplicate fingerprint (skipped)')).toBe(true);
    });

    it('inquiry fingerprint is case and whitespace invariant', () => {
      const input = `## Experian
Inquiries
ABC  Bank - 01/15/2024 - pull
abc bank - 01/15/2024 - pull`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.warnings.some(w => w.reason === 'Duplicate fingerprint (skipped)')).toBe(true);
    });

    it('account fingerprint is case and whitespace invariant', () => {
      const input = `## Equifax
Accounts
Chase  Bank - ****1234 - 2020-05-10
chase bank - ****1234 - 2020-05-10`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      expect(result.warnings.some(w => w.reason === 'Duplicate fingerprint (skipped)')).toBe(true);
    });

    it('different accounts produce different fingerprints', () => {
      const input = `## Equifax
Accounts
Chase Bank - ****1234 - 2020-05-10
Chase Bank - ****5678 - 2020-05-10`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].fingerprint).not.toBe(result.items[1].fingerprint);
    });
  });

  // ── Dedupe Warnings ──

  describe('dedupe warnings', () => {
    it('emits warning for duplicate fingerprint within same bureau', () => {
      const input = `## Experian
Addresses
123 Main St - Apt 4 - X
123 MAIN ST - Apt 4 - Y`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(1);
      const dupeWarnings = result.warnings.filter(w => w.reason === 'Duplicate fingerprint (skipped)');
      expect(dupeWarnings).toHaveLength(1);
      expect(dupeWarnings[0].line).toContain('123 MAIN ST');
    });

    it('same address in different bureaus is NOT a duplicate', () => {
      const input = `## Experian
Addresses
123 Main St - Apt 4 - X
## TransUnion
Addresses
123 Main St - Apt 4 - Y`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(2);
      expect(result.warnings.filter(w => w.reason === 'Duplicate fingerprint (skipped)')).toHaveLength(0);
    });
  });

  // ── Unparseable Lines ──

  describe('unparseable lines', () => {
    it('warns for non-delimited lines in inquiry section', () => {
      const input = `## Experian
Inquiries
just some random text`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].reason).toBe('Unparseable line format');
    });

    it('warns for single-part account line', () => {
      const input = `## Experian
Accounts
JustAName`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(0);
      expect(result.warnings).toHaveLength(1);
      expect(result.warnings[0].reason).toBe('Unparseable line format');
    });
  });

  // ── Minimum Parts Enforcement ──

  describe('minimum parts enforcement', () => {
    it('inquiry with 1 part after split is rejected', () => {
      // Single word with a leading dash — splits to 1 part
      const input = `## Experian
Inquiries
-OnlyOneToken`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(0);
    });

    it('account with 1 part after split is rejected', () => {
      const input = `## Experian
Accounts
-OnlyOneToken`;
      const result = parseBaselineText(input);
      expect(result.items).toHaveLength(0);
    });
  });

  // ── No DB writes (structural guarantee) ──

  describe('no side effects', () => {
    it('parseBaselineText returns pure data with no DB interaction', () => {
      const result = parseBaselineText('## Experian\nAddresses\n123 Main St - x - y');
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('warnings');
      expect(Array.isArray(result.items)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });
  });
});
