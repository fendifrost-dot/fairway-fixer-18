/**
 * Baseline Credit Analysis Parser
 * Deterministic extraction from pasted notes (dash or pipe delimited).
 * No AI inference. No DB writes.
 */

export type BaselineBureau = 'Experian' | 'TransUnion' | 'Equifax';
export type BaselineItemType = 'address' | 'inquiry' | 'account';

export interface BaselineItem {
  bureau: BaselineBureau;
  item_type: BaselineItemType;
  label: string;
  fingerprint: string;
  raw_fields: Record<string, string>;
}

export interface BaselineWarning {
  line: string;
  reason: string;
}

export interface BaselineParseResult {
  items: BaselineItem[];
  warnings: BaselineWarning[];
}

export interface BaselineParseOptions {
  strict?: boolean;
}

// ── Strict-mode Validators ──

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const ACCOUNT_MASK_PATTERN = /^[\dX*x#_\-]{4,}$/;

function assertStrict(condition: boolean, message: string, line: string): void {
  if (!condition) {
    throw new Error(`[baselineParser] ${message} → line: "${line}"`);
  }
}

// ── Helpers ──

/** Normalize for fingerprinting: lowercase, collapse whitespace, trim */
function normalize(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

/** Detect bureau from a header line like "## Experian" or "Experian:" */
const BUREAU_PATTERN = /^(?:#{1,3}\s*)?(Experian|TransUnion|Equifax)\s*:?\s*$/i;

/** Detect section headers */
const SECTION_PATTERN = /^(?:#{1,4}\s*)?(Addresses|Inquiries|Accounts)\s*:?\s*$/i;

function matchBureau(line: string): BaselineBureau | null {
  const m = line.match(BUREAU_PATTERN);
  if (!m) return null;
  const name = m[1].toLowerCase();
  if (name === 'experian') return 'Experian';
  if (name === 'transunion') return 'TransUnion';
  if (name === 'equifax') return 'Equifax';
  return null;
}

function matchSection(line: string): BaselineItemType | null {
  const m = line.match(SECTION_PATTERN);
  if (!m) return null;
  const name = m[1].toLowerCase();
  if (name === 'addresses') return 'address';
  if (name === 'inquiries') return 'inquiry';
  if (name === 'accounts') return 'account';
  return null;
}

// ── Fingerprinting ──

function fingerprintAddress(rawFields: Record<string, string>): string {
  const addr = rawFields.address || rawFields.label || '';
  return normalize(addr);
}

function fingerprintInquiry(rawFields: Record<string, string>): string {
  const subscriber = normalize(rawFields.subscriber || rawFields.name || rawFields.label || '');
  const date = normalize(rawFields.date_inquired || rawFields.date || '');
  return `${subscriber}|${date}`;
}

function fingerprintAccount(rawFields: Record<string, string>): string {
  const furnisher = normalize(rawFields.furnisher || rawFields.name || rawFields.label || '');
  const mask = normalize(rawFields.account_mask || rawFields.mask || '');
  const opened = normalize(rawFields.date_opened || rawFields.opened || '');
  return `${furnisher}|${mask}|${opened}`;
}

function computeFingerprint(itemType: BaselineItemType, rawFields: Record<string, string>): string {
  switch (itemType) {
    case 'address': return fingerprintAddress(rawFields);
    case 'inquiry': return fingerprintInquiry(rawFields);
    case 'account': return fingerprintAccount(rawFields);
  }
}

// ── Line Parsing ──

/** Split a data line by pipe or dash delimiter (tolerant) */
function splitLine(line: string): string[] | null {
  // Pipe-delimited: if line contains any |
  if (line.includes('|')) {
    return line.split('|').map(s => s.trim()).filter(Boolean);
  }
  // Dash-delimited: only split on separator dashes (NOT date hyphens)
  if (line.includes(' - ')) {
    return line.split(' - ').map(s => s.trim()).filter(Boolean);
  }
  // No delimiters found
  return null;
}

function parseDataLine(
  line: string,
  bureau: BaselineBureau,
  section: BaselineItemType,
  strict: boolean = false
): BaselineItem | null {
  const parts = splitLine(line);

  if (!parts) {
    // For addresses, a single non-empty line IS the address
    if (section === 'address' && line.trim().length > 0) {
      const rawFields: Record<string, string> = { address: line.trim() };
      return {
        bureau,
        item_type: 'address',
        label: line.trim(),
        fingerprint: computeFingerprint('address', rawFields),
        raw_fields: rawFields,
      };
    }
    if (strict) {
      assertStrict(false, 'Unparseable line format', line);
    }
    return null;
  }

  // Enforce minimum parts by section
  if (section === 'inquiry' && parts.length < 2) {
    if (strict) assertStrict(false, 'Inquiry requires at least 2 parts (subscriber + date)', line);
    return null;
  }
  if (section === 'account' && parts.length < 2) {
    if (strict) assertStrict(false, 'Account requires at least 2 parts', line);
    return null;
  }

  // Strict account validation: exactly 4 parts, valid ISO date, valid mask
  if (strict && section === 'account') {
    assertStrict(parts.length === 4, `Account requires exactly 4 parts (got ${parts.length})`, line);
    assertStrict(ACCOUNT_MASK_PATTERN.test(parts[1]), `Invalid account mask: "${parts[1]}"`, line);
    assertStrict(ISO_DATE_PATTERN.test(parts[2]), `Invalid ISO date: "${parts[2]}"`, line);
  }

  let rawFields: Record<string, string>;
  let label: string;

  switch (section) {
    case 'address':
      rawFields = { address: parts[0] };
      if (parts[1]) rawFields.reported = parts[1];
      label = parts[0];
      break;

    case 'inquiry': {
      rawFields = {
        subscriber: parts[0],
        date_inquired: parts[1] || '',
      };
      if (parts[2]) rawFields.extra = parts[2];
      label = `${parts[0]} (${parts[1] || 'no date'})`;
      break;
    }

    case 'account': {
      rawFields = {
        furnisher: parts[0],
        account_mask: parts[1] || '',
      };
      if (parts[2]) rawFields.date_opened = parts[2];
      if (parts[3]) rawFields.extra = parts[3];
      label = `${parts[0]} (${parts[1] || 'no mask'})`;
      break;
    }
  }

  return {
    bureau,
    item_type: section,
    label,
    fingerprint: computeFingerprint(section, rawFields),
    raw_fields: rawFields,
  };
}

// ── Main Parser ──

export function parseBaselineText(text: string, options?: BaselineParseOptions): BaselineParseResult {
  const strict = options?.strict ?? false;
  const lines = text.split('\n');
  const items: BaselineItem[] = [];
  const warnings: BaselineWarning[] = [];
  const seenFingerprints: Set<string> = new Set<string>();

  let currentBureau: BaselineBureau | null = null;
  let currentSection: BaselineItemType | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Check bureau header
    const bureau = matchBureau(line);
    if (bureau) {
      currentBureau = bureau;
      currentSection = null;
      continue;
    }

    // Check section header
    const section = matchSection(line);
    if (section) {
      currentSection = section;
      continue;
    }

    // In strict mode, unknown headers and orphan lines throw
    if (strict) {
      assertStrict(currentBureau !== null && currentSection !== null, 'Line outside bureau/section context', line);
    }

    // Skip lines before any bureau/section context
    if (!currentBureau || !currentSection) {
      warnings.push({ line: rawLine, reason: 'No bureau or section context' });
      continue;
    }

    // Try to parse data line
    const item = parseDataLine(line, currentBureau, currentSection, strict);
    if (!item) {
      warnings.push({ line: rawLine, reason: 'Unparseable line format' });
      continue;
    }

    // Dedupe by fingerprint within this parse
    const fpKey = `${item.bureau}:${item.item_type}:${item.fingerprint}`;
    if (seenFingerprints.has(fpKey)) {
      warnings.push({ line: rawLine, reason: 'Duplicate fingerprint (skipped)' });
      continue;
    }
    seenFingerprints.add(fpKey);

    items.push(item);
  }

  return { items, warnings };
}
