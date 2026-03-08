/**
 * JSON Array Import Validator
 * 
 * Validates and prepares a JSON array of pre-structured timeline events
 * for direct commit, bypassing the deterministic parser and AI fallback.
 */

import { EventSource, EventCategory, ALL_SOURCES, EVENT_CATEGORIES } from '@/types/operator';

// The required shape of each JSON event object
export interface JsonImportEvent {
  event_date: string | null;
  date_is_unknown: boolean;
  category: string;
  source: string | null;
  title: string;
  summary: string;
  raw_line: string;
  event_kind: string;
  // Optional fields
  details?: string | null;
  related_accounts?: Array<{ name: string }> | null;
  is_draft?: boolean;
}

export interface ValidatedJsonEvent {
  event_date: string | null;
  date_is_unknown: boolean;
  category: EventCategory;
  source: EventSource | null;
  title: string;
  summary: string;
  raw_line: string;
  event_kind: string;
  details: string | null;
  related_accounts: Array<{ name: string }> | null;
  is_draft: boolean;
}

export interface JsonValidationRow {
  index: number;
  raw: JsonImportEvent;
  valid: boolean;
  validated: ValidatedJsonEvent | null;
  errors: string[];
  warnings: string[];
}

export interface JsonValidationResult {
  rows: JsonValidationRow[];
  validCount: number;
  invalidCount: number;
  totalCount: number;
}

const VALID_CATEGORIES: Set<string> = new Set(['Action', 'Response', 'Outcome', 'Note']);
const VALID_EVENT_KINDS: Set<string> = new Set(['action', 'response', 'outcome', 'note']);
const VALID_SOURCES_SET: Set<string> = new Set(ALL_SOURCES);

const REQUIRED_FIELDS = ['event_date', 'date_is_unknown', 'category', 'source', 'title', 'summary', 'raw_line', 'event_kind'] as const;

/**
 * Parse and validate a JSON string as an array of timeline events.
 * Returns null if the input is not a valid JSON array.
 */
export function parseJsonImportArray(input: string): JsonImportEvent[] | null {
  try {
    const parsed = JSON.parse(input.trim());
    if (!Array.isArray(parsed)) return null;
    if (parsed.length === 0) return null;
    // Basic check: first element should be an object
    if (typeof parsed[0] !== 'object' || parsed[0] === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Validate each event object individually, flagging invalid rows
 * without rejecting the entire batch.
 */
export function validateJsonImportBatch(events: JsonImportEvent[]): JsonValidationResult {
  const rows: JsonValidationRow[] = events.map((raw, index) => {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check required fields exist
    for (const field of REQUIRED_FIELDS) {
      if (field === 'event_date' || field === 'source') {
        // These can be null but must be present as keys
        if (!(field in raw)) {
          errors.push(`Missing field: ${field}`);
        }
      } else if (field === 'date_is_unknown') {
        if (!(field in raw)) {
          errors.push(`Missing field: ${field}`);
        } else if (typeof raw[field] !== 'boolean') {
          errors.push(`${field} must be boolean`);
        }
      } else {
        const val = (raw as any)[field];
        if (val === undefined || val === null || (typeof val === 'string' && val.trim() === '')) {
          errors.push(`Missing or empty: ${field}`);
        }
      }
    }

    // Validate category
    if (raw.category && !VALID_CATEGORIES.has(raw.category)) {
      errors.push(`Unsupported category: "${raw.category}" (valid: ${[...VALID_CATEGORIES].join(', ')})`);
    }

    // Validate event_kind  
    if (raw.event_kind && !VALID_EVENT_KINDS.has(raw.event_kind)) {
      errors.push(`Unsupported event_kind: "${raw.event_kind}" (valid: ${[...VALID_EVENT_KINDS].join(', ')})`);
    }

    // Validate source
    if (raw.source !== null && raw.source !== undefined && !VALID_SOURCES_SET.has(raw.source)) {
      warnings.push(`Unknown source "${raw.source}" → will be set to "Other"`);
    }

    // Validate event_date format if present
    if (raw.event_date !== null && raw.event_date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(raw.event_date)) {
        errors.push(`Invalid event_date format: "${raw.event_date}" (expected YYYY-MM-DD)`);
      }
    }

    // Build validated event if no errors
    let validated: ValidatedJsonEvent | null = null;
    if (errors.length === 0) {
      const sourceValue = raw.source && VALID_SOURCES_SET.has(raw.source) 
        ? raw.source as EventSource 
        : (raw.source ? 'Other' as EventSource : null);

      validated = {
        event_date: raw.event_date || null,
        date_is_unknown: raw.date_is_unknown,
        category: raw.category as EventCategory,
        source: sourceValue,
        title: raw.title,
        summary: raw.summary,
        raw_line: raw.raw_line,
        event_kind: raw.event_kind,
        details: raw.details || null,
        related_accounts: raw.related_accounts || null,
        is_draft: raw.is_draft ?? false,
      };
    }

    return {
      index,
      raw,
      valid: errors.length === 0,
      validated,
      errors,
      warnings,
    };
  });

  return {
    rows,
    validCount: rows.filter(r => r.valid).length,
    invalidCount: rows.filter(r => !r.valid).length,
    totalCount: rows.length,
  };
}

/**
 * Convert validated events to DB insert format.
 */
export function mapValidatedToDb(events: ValidatedJsonEvent[], clientId: string) {
  return events.map(e => ({
    client_id: clientId,
    event_date: e.event_date,
    date_is_unknown: e.date_is_unknown,
    category: e.category,
    source: e.source,
    title: e.title,
    summary: e.summary,
    details: e.details,
    related_accounts: e.related_accounts,
    raw_line: e.raw_line,
    event_kind: e.event_kind,
    is_draft: e.is_draft,
  }));
}
